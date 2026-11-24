# Hosting Guide (GitHub Click-to-Deploy & Free Tiers)

Because Black Rada runs real-time **Socket.io game rooms** in memory, it needs a host with persistent Node.js & WebSockets. **Vercel does not support long-lived Socket.io servers**, so use **Render** or **Koyeb** (both free and connect directly to your GitHub repo in clicks).

---

## Easiest Method: Push to GitHub + Render (Free, Zero CLI)

1. **Create a free LiveKit Cloud account** (optional for <= 6 players, recommended for **7–16 players**):
   - Open [cloud.livekit.io](https://cloud.livekit.io), create a project, and copy:
     - `LIVEKIT_URL` (`wss://...`)
     - `LIVEKIT_API_KEY`
     - `LIVEKIT_API_SECRET`
2. **Upload this folder to a GitHub repository** (even via GitHub.com -> *Upload files* or GitHub Desktop).
3. **Connect to Render**:
   - Sign up free at [render.com](https://render.com) with GitHub.
   - Click **New + -> Blueprint** (uses the included `render.yaml` automatically!) **or** **New + -> Web Service**.
   - Select your GitHub repo. Render fills in:
     - **Build Command:** `npm install --include=dev && npm run build`
     - **Start Command:** `npm start`
   - Paste your 3 `LIVEKIT_*` values when prompted (or leave blank to start on peer-to-peer WebRTC) and click **Deploy**.
4. You get a permanent `https://your-app.onrender.com` link to share with friends on phones and laptops.

*(Note: Render's free tier sleeps after 15 minutes of zero traffic and takes ~30–50 seconds to wake up on the first visit before game night—once open, it stays awake while you play.)*

---

## Alternative Free GitHub-Connected Hosts

- **Koyeb (Free tier, doesn't sleep as aggressively):** Connect your GitHub repo -> Builder: **Buildpack** (or Dockerfile) -> Build: `npm install && npm run build` -> Run: `npm start` -> Port `3000` -> Add `LIVEKIT_*` env vars.
- **Railway (Trial / ~$5/mo usage credit, instant wake):** New Project -> Deploy from GitHub repo -> automatically detects Node/Dockerfile -> Generate Domain -> Add `LIVEKIT_*` variables.

---

## Recommended for long nights: your own free server (Oracle Cloud)

LiveKit Cloud's free plan (5,000 participant-minutes and 50 GB a month) runs out during a single 16-player, 8-hour night.
For unlimited nights, run the game **and** your own LiveKit video server on one free Oracle Cloud VM:

```bash
curl -fsSL https://raw.githubusercontent.com/ugimugi008/BlackRada/main/deploy/oracle/setup.sh -o setup.sh
sudo bash setup.sh --domain YOUR-NAME.duckdns.org --duckdns-token YOUR-DUCKDNS-TOKEN
```

See [deploy/oracle/README.md](deploy/oracle/README.md) for the full walkthrough (account, VM, firewall ports).

## Quick local test with Docker (peer-to-peer video only)

```bash
docker compose --profile tunnel up --build
```

This prints a temporary `https://...trycloudflare.com` link. Video is peer-to-peer (fine for ~2–6 players).
A Cloudflare quick tunnel cannot carry LiveKit's video traffic, so don't combine it with the `sfu` profile for remote friends.
