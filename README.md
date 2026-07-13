# Artists Hub

Music discovery landing page: browse/filter artists, open details with albums & tracks, YouTube mini-player, Mix Radio, and local feedback.

## Stack

- **Frontend:** Vanilla JS (ES modules), Vite, HTML partials
- **Backend:** Express proxy to [TheAudioDB](https://www.theaudiodb.com/) (`server.js`)
- **Deploy (primary):** [Vercel](https://vercel.com) — static + `/api/*` via `api/[...path].js`

> GitHub Pages can host the static `dist/` build only. Without a separate API host, artist data will not load. Prefer Vercel for the full app.

## Develop

```bash
npm install
npm run dev:full   # Express :3000 + Vite (proxies /api)
```

Or separately: `npm run server` and `npm run dev`.

```bash
npm run lint
npm test
npm run build
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `AUDIODB_API_KEY` | `2` (free tier) | TheAudioDB API key |
| `CORS_ORIGINS` | localhost Vite ports | Comma-separated allowed origins (`*` allowed) |
| `PORT` | `3000` | Local Express port |

On Vercel, set these in project settings if needed. Same-origin frontend+API usually needs no CORS tweaks; `*.vercel.app` is allowed by default.

## Notes

- Feedback/comments are stored **locally in the browser** (seeded from `src/data/feedbacks.json`).
- Popular artists and album responses are cached in server memory (TTL) to cut TheAudioDB round-trips.
