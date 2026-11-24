#!/usr/bin/env bash
# Black Rada — one-command server setup for an Ubuntu VM (built for Oracle Cloud Always Free).
#
# Installs and runs, on ONE server:
#   * the Black Rada game (this repo)            -> https://YOUR-DOMAIN/
#   * a LiveKit video server (webcams + audio)   -> wss://YOUR-DOMAIN/livekit
#   * Caddy, which gets and renews the free HTTPS certificate
#
# First run:
#   curl -fsSL https://raw.githubusercontent.com/ugimugi008/BlackRada/main/deploy/oracle/setup.sh -o setup.sh
#   sudo bash setup.sh --domain blackrada.duckdns.org --duckdns-token YOUR-DUCKDNS-TOKEN
#
# Later (pull the newest code and rebuild):   sudo blackrada update
# Other helpers:                              sudo blackrada status | logs [app|livekit|caddy] | restart
#
# Safe to run again: it keeps your LiveKit keys and settings.

set -euo pipefail

REPO_URL="https://github.com/ugimugi008/BlackRada.git"
BASE_DIR="/opt/blackrada-server"
APP_DIR="$BASE_DIR/app"
SETTINGS_FILE="$BASE_DIR/settings.env"
SECRETS_FILE="$BASE_DIR/.env"
TCP_PORTS=(80 443 7881)
UDP_RANGE_START=7882
UDP_RANGE_END=7892

say()  { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[1;32m✔ %s\033[0m\n' "$*"; }
warn() { printf '    \033[1;31m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: sudo bash setup.sh --domain NAME.duckdns.org --duckdns-token TOKEN [--email you@example.com]

  --domain          The web address friends will open (e.g. blackrada.duckdns.org).
  --duckdns-token   Your DuckDNS token (shown at the top of duckdns.org after you sign in).
                    Only needed when the domain ends in .duckdns.org. The server then keeps
                    the DuckDNS address pointed at itself automatically.
  --email           Optional. Used only for HTTPS certificate expiry notices.
  --reuse           Re-run with the settings saved by a previous run (used by "blackrada update").
EOF
}

# ---------------------------------------------------------------- arguments
DOMAIN=""; DUCKDNS_TOKEN=""; ACME_EMAIL=""; REUSE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --duckdns-token) DUCKDNS_TOKEN="${2:-}"; shift 2 ;;
    --email) ACME_EMAIL="${2:-}"; shift 2 ;;
    --reuse) REUSE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage; die "Unknown option: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "Run this with sudo:  sudo bash setup.sh ..."

if [[ $REUSE -eq 1 ]]; then
  [[ -f "$SETTINGS_FILE" ]] || die "No saved settings yet. Run the full command with --domain first."
  # shellcheck disable=SC1090
  source "$SETTINGS_FILE"
fi

DOMAIN="$(echo "$DOMAIN" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#/.*$##')"
[[ -n "$DOMAIN" ]] || { usage; die "--domain is required."; }
[[ "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "\"$DOMAIN\" does not look like a domain name."

IS_DUCKDNS=0
if [[ "$DOMAIN" == *.duckdns.org ]]; then
  IS_DUCKDNS=1
  DUCK_SUB="${DOMAIN%.duckdns.org}"
  [[ "$DUCK_SUB" != *.* ]] || die "Use your DuckDNS name exactly, e.g. blackrada.duckdns.org"
  [[ -n "$DUCKDNS_TOKEN" ]] || die "--duckdns-token is required for a .duckdns.org domain."
fi

. /etc/os-release 2>/dev/null || true
[[ "${ID:-}" == "ubuntu" ]] || warn "This script is tested for Ubuntu; you are on ${PRETTY_NAME:-unknown}. Continuing."

mkdir -p "$BASE_DIR"
chmod 700 "$BASE_DIR"
umask 077
cat > "$SETTINGS_FILE" <<EOF
DOMAIN='$DOMAIN'
DUCKDNS_TOKEN='$DUCKDNS_TOKEN'
ACME_EMAIL='$ACME_EMAIL'
EOF
umask 022

# ---------------------------------------------------------------- public IP
say "Finding this server's public IP address"
PUBLIC_IP=""
for url in https://api.ipify.org https://ifconfig.me/ip https://icanhazip.com; do
  PUBLIC_IP="$(curl -4 -fsS --max-time 8 "$url" 2>/dev/null | tr -d '[:space:]' || true)"
  [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && break
  PUBLIC_IP=""
done
[[ -n "$PUBLIC_IP" ]] || die "Could not detect the public IP. Is this server connected to the internet?"
ok "Public IP: $PUBLIC_IP"

# ---------------------------------------------------------------- DuckDNS
if [[ $IS_DUCKDNS -eq 1 ]]; then
  say "Pointing $DOMAIN at this server (DuckDNS)"
  RESP="$(curl -fsS --max-time 15 "https://www.duckdns.org/update?domains=${DUCK_SUB}&token=${DUCKDNS_TOKEN}&ip=${PUBLIC_IP}" || true)"
  [[ "$RESP" == "OK" ]] || die "DuckDNS said \"${RESP:-no answer}\". Check the name ($DUCK_SUB) and token on duckdns.org."
  ok "DuckDNS updated"

  # Keep it updated every 5 minutes, in case the IP ever changes.
  install -m 700 /dev/null /usr/local/bin/blackrada-duckdns
  cat > /usr/local/bin/blackrada-duckdns <<'EOF'
#!/usr/bin/env bash
source /opt/blackrada-server/settings.env
curl -fsS --max-time 15 "https://www.duckdns.org/update?domains=${DOMAIN%.duckdns.org}&token=${DUCKDNS_TOKEN}&ip=" >/dev/null 2>&1 || true
EOF
  echo "*/5 * * * * root /usr/local/bin/blackrada-duckdns" > /etc/cron.d/blackrada-duckdns
  chmod 644 /etc/cron.d/blackrada-duckdns
  ok "Auto-update every 5 minutes installed"
fi

say "Checking that $DOMAIN points to $PUBLIC_IP"
for _ in $(seq 1 24); do
  RESOLVED="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
  [[ "$RESOLVED" == "$PUBLIC_IP" ]] && break
  sleep 5
done
if [[ "${RESOLVED:-}" == "$PUBLIC_IP" ]]; then
  ok "$DOMAIN -> $PUBLIC_IP"
else
  warn "$DOMAIN currently points to '${RESOLVED:-nothing}', not $PUBLIC_IP."
  warn "HTTPS will fail until the domain points here. Fix the DNS, then run: sudo blackrada update"
fi

# ---------------------------------------------------------------- packages
say "Installing Docker and tools (takes a minute or two the first time)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl cron >/dev/null
if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y -qq docker.io >/dev/null
fi
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y -qq docker-compose-v2 >/dev/null 2>&1 || apt-get install -y -qq docker-compose-plugin >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
systemctl enable --now cron >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || die "Docker Compose did not install."
ok "$(docker --version)"

# ---------------------------------------------------------------- firewall
# Oracle's Ubuntu images block every port except SSH inside the server itself
# (on top of the cloud "security list" you edit in the web console).
say "Opening ports on the server's own firewall"
add_rule() { # $1 = proto, $2 = port or range a:b
  local spec=(-p "$1" -m state --state NEW -m "$1" --dport "$2" -j ACCEPT)
  iptables -C INPUT "${spec[@]}" 2>/dev/null || iptables -I INPUT 1 "${spec[@]}"
  local line="-A INPUT ${spec[*]}"
  if [[ -f /etc/iptables/rules.v4 ]] && ! grep -qF -- "$line" /etc/iptables/rules.v4; then
    if grep -q -- '^-A INPUT -j REJECT' /etc/iptables/rules.v4; then
      sed -i "0,/^-A INPUT -j REJECT/s//${line//\//\\/}\n&/" /etc/iptables/rules.v4
    fi
  fi
}
for p in "${TCP_PORTS[@]}"; do add_rule tcp "$p"; done
add_rule udp "${UDP_RANGE_START}:${UDP_RANGE_END}"
ok "TCP ${TCP_PORTS[*]} and UDP ${UDP_RANGE_START}-${UDP_RANGE_END} open"

# ---------------------------------------------------------------- code
say "Downloading the newest Black Rada code"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch -q --depth 1 origin main
  git -C "$APP_DIR" reset -q --hard origin/main
else
  git clone -q --depth 1 "$REPO_URL" "$APP_DIR"
fi
ok "Code at $(git -C "$APP_DIR" log -1 --format='%h %s')"

# ---------------------------------------------------------------- secrets
if [[ ! -f "$SECRETS_FILE" ]]; then
  say "Creating private LiveKit keys"
  umask 077
  {
    echo "LIVEKIT_API_KEY=BR$(openssl rand -hex 8)"
    echo "LIVEKIT_API_SECRET=$(openssl rand -hex 24)"
  } > "$SECRETS_FILE"
  umask 022
  ok "Saved to $SECRETS_FILE (only root can read it)"
fi
# shellcheck disable=SC1090
source "$SECRETS_FILE"

# ---------------------------------------------------------------- config files
say "Writing server configuration"
cat > "$BASE_DIR/livekit.yaml" <<EOF
# Generated by setup.sh — re-running the script rewrites this file.
port: 7880
rtc:
  tcp_port: 7881
  udp_port: ${UDP_RANGE_START}-${UDP_RANGE_END}
  # Discover the public IP via STUN; if that check fails behind Oracle's NAT,
  # LiveKit falls back to node_ip (the public IP this script detected).
  use_external_ip: true
  node_ip: ${PUBLIC_IP}
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
room:
  auto_create: true
  empty_timeout: 300
  departure_timeout: 20
  max_participants: 30
logging:
  level: info
EOF
chmod 644 "$BASE_DIR/livekit.yaml"  # the folder itself is root-only (700)

{
  echo "# Generated by setup.sh — re-running the script rewrites this file."
  if [[ -n "$ACME_EMAIL" ]]; then printf '{\n\temail %s\n}\n\n' "$ACME_EMAIL"; fi
  cat <<EOF
${DOMAIN} {
	# Video server (LiveKit) lives under /livekit
	handle_path /livekit/* {
		reverse_proxy 127.0.0.1:7880
	}
	# Everything else is the game
	handle {
		reverse_proxy 127.0.0.1:3000
	}
}
EOF
} > "$BASE_DIR/Caddyfile"

cat > "$BASE_DIR/docker-compose.yml" <<EOF
# Generated by setup.sh — re-running the script rewrites this file.
name: blackrada
services:
  app:
    build:
      context: ./app
      network: host
    image: blackrada-app:latest
    network_mode: host
    environment:
      NODE_ENV: production
      PORT: "3000"
      LIVEKIT_URL: wss://${DOMAIN}/livekit
      LIVEKIT_API_KEY: \${LIVEKIT_API_KEY}
      LIVEKIT_API_SECRET: \${LIVEKIT_API_SECRET}
    restart: unless-stopped

  livekit:
    image: livekit/livekit-server:latest
    network_mode: host
    command: --config /etc/livekit.yaml
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml:ro
    restart: unless-stopped

  caddy:
    image: caddy:2
    network_mode: host
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
EOF
ok "livekit.yaml, Caddyfile, docker-compose.yml"

# ---------------------------------------------------------------- helper command
cat > /usr/local/bin/blackrada <<'EOF'
#!/usr/bin/env bash
set -e
cd /opt/blackrada-server
case "${1:-status}" in
  update)  exec bash /opt/blackrada-server/app/deploy/oracle/setup.sh --reuse ;;
  restart) docker compose restart ;;
  logs)    docker compose logs --tail 200 -f ${2:-} ;;
  stop)    docker compose stop ;;
  status)
    docker compose ps
    source settings.env
    echo
    echo -n "Game:  "; curl -fsS --max-time 5 http://127.0.0.1:3000/api/health || echo "not responding"
    echo
    echo -n "Video: "; curl -fsS --max-time 5 http://127.0.0.1:7880 || echo "not responding"
    echo
    echo "Open:  https://${DOMAIN}"
    ;;
  *) echo "Usage: sudo blackrada [status|update|restart|logs [app|livekit|caddy]|stop]" ;;
esac
EOF
chmod 755 /usr/local/bin/blackrada

# ---------------------------------------------------------------- start
say "Building and starting everything (first build takes 2–5 minutes)"
cd "$BASE_DIR"
docker compose pull -q livekit caddy
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null 2>&1 || true

say "Checking that it all works"
wait_for() { # $1 = description, rest = command
  local desc="$1"; shift
  for _ in $(seq 1 40); do
    if "$@" >/dev/null 2>&1; then ok "$desc"; return 0; fi
    sleep 3
  done
  warn "$desc — not ready after 2 minutes"; return 1
}
FAILED=0
wait_for "Game server is running"   curl -fsS --max-time 5 http://127.0.0.1:3000/api/health || FAILED=1
wait_for "Video server is running"  curl -fsS --max-time 5 http://127.0.0.1:7880 || FAILED=1
wait_for "HTTPS certificate issued, https://${DOMAIN} works" \
  curl -fsS --max-time 8 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health" || FAILED=1
wait_for "Video server reachable at wss://${DOMAIN}/livekit" \
  curl -fsS --max-time 8 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/livekit/" || FAILED=1

HEALTH="$(curl -fsS --max-time 8 --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/api/health" 2>/dev/null || true)"

echo
if [[ $FAILED -eq 0 && "$HEALTH" == *'"sfuEnabled":true'* ]]; then
  printf '\033[1;32m%s\033[0m\n' "============================================================"
  printf '\033[1;32m  Black Rada is live:  https://%s\033[0m\n' "$DOMAIN"
  printf '\033[1;32m%s\033[0m\n' "============================================================"
  echo "  Video server: on (LiveKit, unlimited)"
  echo "  Update later: sudo blackrada update"
  echo "  Check health: sudo blackrada status"
else
  printf '\033[1;31m%s\033[0m\n' "Something is not ready yet. Most common causes:"
  echo "  1. Ports 80/443 not opened in the Oracle security list  -> HTTPS certificate fails"
  echo "  2. The domain does not point to $PUBLIC_IP yet          -> wait 2 min, run: sudo blackrada update"
  echo "  3. See details with:  sudo blackrada logs caddy   (or app / livekit)"
  exit 1
fi
