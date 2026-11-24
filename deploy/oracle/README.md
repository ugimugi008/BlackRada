# Self-hosting Black Rada on Oracle Cloud (free)

One free Oracle Cloud VM runs everything:

| Part | Address |
| --- | --- |
| The game | `https://YOUR-NAME.duckdns.org` |
| LiveKit video server | `wss://YOUR-NAME.duckdns.org/livekit` |
| HTTPS certificate | automatic (Caddy + Let's Encrypt) |

## Ports to open in the Oracle security list (Ingress, source `0.0.0.0/0`)

| Protocol | Port(s) | Used for |
| --- | --- | --- |
| TCP | 80 | HTTPS certificate check |
| TCP | 443 | The website and video signalling |
| TCP | 7881 | Video fallback when UDP is blocked |
| UDP | 7882-7892 | Video (main path) |

## Install (on the VM, Ubuntu 24.04)

```bash
curl -fsSL https://raw.githubusercontent.com/ugimugi008/BlackRada/main/deploy/oracle/setup.sh -o setup.sh
sudo bash setup.sh --domain YOUR-NAME.duckdns.org --duckdns-token YOUR-DUCKDNS-TOKEN
```

## Afterwards

```bash
sudo blackrada status            # is everything running?
sudo blackrada update            # pull the newest code from GitHub and rebuild
sudo blackrada logs livekit      # or: app, caddy
```

Settings and LiveKit keys live in `/opt/blackrada-server` (root-only). Re-running the script keeps them.
