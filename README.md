<div align="center">
  <img src="public/black-rada-mark.svg" width="140" alt="Black Rada crest" />
  <h1>Black Rada</h1>
  <p>Live webcam Mafia for 7–16 friends, with a dedicated Moderator console. Ukrainian &amp; English.</p>
</div>

## Run locally

Requires Node.js 22.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # game-logic tests
```

## Deploy

The repo includes `render.yaml`, so on [Render](https://render.com) choose **New + → Blueprint**, pick this repo and click **Apply**.

For smooth video with more than ~6 players, create a free project at [LiveKit Cloud](https://cloud.livekit.io) and set these environment variables on your host:

- `LIVEKIT_URL` (`wss://...`)
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Without them the app falls back to peer-to-peer WebRTC. Visit `/api/health` on your deployed site: `"sfuEnabled": true` means LiveKit is active.

See [HOSTING.md](HOSTING.md) for Koyeb, Railway and self-hosting with Docker.
