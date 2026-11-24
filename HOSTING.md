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

## Self-Host on Any Laptop / VPS (Docker + LiveKit + HTTPS Tunnel)

```bash
export LIVEKIT_API_KEY="your-key"
export LIVEKIT_API_SECRET="your-32-char-random-secret"
docker compose --profile sfu --profile tunnel up --build
```

For quick peer-to-peer games (~2–6 friends) without LiveKit:

```bash
docker compose --profile tunnel up --build
```
