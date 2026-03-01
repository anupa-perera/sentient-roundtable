# Sentient Roundtable Backend

This repository contains only the FastAPI backend for Sentient Roundtable.

Frontend repo:
- `https://github.com/anupa-perera/sentient-ai-roundtable`

## Features

- Fixed-round orchestration (`rounds` chosen by user, no early stop).
- Sequential rotating turn order per round.
- Real-time SSE stream with replay/resume support.
- Two access flows:
  - `system`: server-side key, free models only.
  - `byok`: user key allows free + paid models, stored in backend RAM for session lifetime only.
- Voting and synthesis after all rounds.
- PDF export via `POST /api/export`.

## Project Structure

```text
backend/             FastAPI app, orchestration, Redis/OpenRouter/PDF services
docker-compose.yml   Backend + local Redis for development
```

## Environment

Copy `.env.example` to `.env` and set:

- `OPENROUTER_API_KEY`
- `REDIS_URL` (use `rediss://...` for Upstash)
- `CORS_ORIGINS` (include your frontend domain)
- `OPENROUTER_HTTP_REFERER` (set to your frontend domain)

## Run Locally

### Docker (recommended)

```bash
docker-compose up -d --build
```

API: `http://localhost:8000`  
Health: `http://localhost:8000/healthz`

### Without Docker

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Deploy (Railway/Render)

Use this repo for backend deployment only.

- Root directory: `backend`
- Runtime: Dockerfile (`backend/Dockerfile`)
- Health check: `/healthz`

Required variables:

- `OPENROUTER_API_KEY`
- `REDIS_URL`
- `SESSION_TTL_SECONDS=14400`
- `MODEL_CACHE_TTL_SECONDS=3600`
- `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `OPENROUTER_HTTP_REFERER=https://<your-frontend-domain>`
- `CORS_ORIGINS=https://<your-frontend-domain>,http://localhost:5173`

## API Endpoints

- `POST /api/roundtable/start`
- `GET /api/roundtable/stream/{session_id}`
- `GET /api/models`
- `POST /api/models/byok`
- `POST /api/export` with `{ "format": "pdf" }`

## Security Notes (BYOK)

- BYOK keys are never written to Redis/files.
- BYOK keys are not returned by APIs.
- BYOK keys are stored in process memory with TTL.
- Backend restart clears active BYOK keys.

## Tests

```bash
cd backend
python -m pytest tests -q
```
