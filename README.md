# Sentient Roundtable

Sentient Roundtable is a multi-agent deliberation system with a React SPA frontend and FastAPI backend.

## V1 Features

- Fixed-round orchestration (`rounds` chosen by user, no early stop).
- Sequential rotating turn order per round.
- Real-time SSE discussion stream with replay/resume.
- Two model access flows:
  - `system` (default): uses server key, free models only.
  - `byok`: user key allows paid + free models; key kept in backend RAM only for session lifetime.
- Post-discussion voting and synthesis.
- PDF export (`POST /api/export`) only.

## Monorepo Structure

```text
backend/   FastAPI + orchestration + Redis + OpenRouter + PDF export
frontend/  React + Vite + Zustand + SSE live UI
```

## Environment

Copy `.env.example` to `.env` and set values:

- `OPENROUTER_API_KEY` for system flow.
- `REDIS_URL` for backend Redis connection.

## Local Development

### 1) Start backend + Redis

```bash
docker-compose up -d --build
```

Backend API: `http://localhost:8000`  
Health: `http://localhost:8000/healthz`

### 2) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Hosting (Recommended: Vercel + Render + Upstash)

This repo is a monorepo, but you deploy each part separately:
- `frontend/` -> Vercel (static React app)
- `backend/` -> Render (Docker web service)
- Redis -> Upstash (managed Redis)

### 1) Create Upstash Redis

1. Create a Redis database in Upstash.
2. Copy the TLS connection string and use `rediss://` (not `redis://`).
3. Keep this value for backend `REDIS_URL`.

### 2) Deploy Backend on Render

1. In Render, create a new **Web Service** from this GitHub repo.
2. Set:
- `Root Directory`: `backend`
- `Environment`: `Docker`
- `Health Check Path`: `/healthz`
3. Add environment variables:
- `OPENROUTER_API_KEY=...` (system flow key)
- `REDIS_URL=rediss://default:<password>@<endpoint>:6379`
- `SESSION_TTL_SECONDS=14400`
- `MODEL_CACHE_TTL_SECONDS=3600`
- `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `OPENROUTER_HTTP_REFERER=https://<your-frontend-domain>`
- `CORS_ORIGINS=https://<your-frontend-domain>,http://localhost:5173`
4. Deploy and copy the backend URL, for example `https://<backend>.onrender.com`.

Note: `backend/Dockerfile` is configured to bind to `${PORT}` for cloud platforms.

### 3) Deploy Frontend on Vercel

1. In Vercel, import the same GitHub repo.
2. Set:
- `Root Directory`: `frontend`
- `Build Command`: `npm run build`
- `Output Directory`: `dist`
3. Add environment variable:
- `VITE_API_BASE=https://<backend>.onrender.com`
4. Deploy.

Note: `frontend/vercel.json` includes SPA rewrites so routes like `/session/:id` resolve correctly.

### 4) Final CORS Check

After you get your final Vercel production URL, update backend `CORS_ORIGINS` to include it, then redeploy backend.

### 5) Smoke Test

1. Open frontend URL.
2. Start a session in `system` mode.
3. Confirm real-time stream is visible.
4. Confirm PDF export works after synthesis.
5. Test `BYOK` with a valid OpenRouter key.

## Key API Endpoints

- `POST /api/roundtable/start`
- `GET /api/roundtable/stream/{session_id}`
- `GET /api/models`
- `POST /api/models/byok`
- `POST /api/export` (`format: "pdf"`)

## Security Notes (BYOK)

- BYOK keys are never stored in Redis or files.
- BYOK keys are not returned by APIs.
- BYOK keys are held in process memory with TTL and deleted at session end.
- If backend restarts, active BYOK sessions lose their key and cannot continue.

## Testing

Backend:

```bash
cd backend
python -m pytest tests -q
```

Frontend:

```bash
cd frontend
npm test
```
