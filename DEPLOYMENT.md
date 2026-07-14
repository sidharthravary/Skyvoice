# Deploying SkyVoice to the cloud

Architecture: **Vercel** serves the Next.js frontend and proxies `/api/*` and
`/socket.io/*` to the **Render** backend (see `frontend/vercel.json`). The app
is a single HTTPS origin, so auth cookies, CORS, and the microphone all work
with no special configuration — on any phone, on any network.

## 1. Backend → Render (~5 min)

1. Sign in at https://render.com (GitHub login).
2. **New → Blueprint** → select the `sidharthravary/Skyvoice` repo.
   Render reads `render.yaml` automatically.
3. When prompted for environment variables, paste:
   - `MONGODB_URI` — your Atlas connection string (same as local `.env`)
   - `GEMINI_API_KEY` — your Gemini key
   - `FRONTEND_URL` — leave blank for now; fill in after step 2
4. Deploy. Note the URL, e.g. `https://skyvoice-backend.onrender.com`.
5. In **MongoDB Atlas → Network Access**, add `0.0.0.0/0` (allow from anywhere)
   so Render can reach the database.

## 2. Frontend → Vercel (~5 min)

1. Sign in at https://vercel.com (GitHub login).
2. **Add New → Project** → import `sidharthravary/Skyvoice`.
3. Set **Root Directory** to `frontend`. Framework auto-detects as Next.js.
4. If your Render URL differs from `https://skyvoice-backend.onrender.com`,
   edit `frontend/vercel.json` first so both rewrites point at your URL.
5. Deploy. You get e.g. `https://skyvoice.vercel.app`.

## 3. Connect the two

1. Back in Render, set `FRONTEND_URL=https://skyvoice.vercel.app`
   (your actual Vercel URL) and redeploy the backend.
2. Open the Vercel URL on your phone — trusted certificate, mic works,
   installable via "Add to Home Screen" (PWA).

## Notes

- **Render free tier sleeps** after 15 min idle; the first request after that
  takes ~50 s. Upgrade the plan (or ping `/api/health` on a schedule) to avoid.
- The voice socket runs over polling through Vercel's proxy (WebSocket upgrade
  falls back automatically). For direct WebSockets, set
  `NEXT_PUBLIC_BACKEND_URL` in Vercel to the Render URL instead — but then
  cookies become cross-site; keep the proxy setup unless you know you need it.
- Local dev is unaffected: `npm run dev` still runs everything on your PC.
