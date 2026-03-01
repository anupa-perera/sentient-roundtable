# Sentient Roundtable

This project powers Sentient Roundtable. It runs fixed-round
multi-model discussions, streams real-time events, executes voting and synthesis,
and generates a final PDF report. It also supports both system-key and BYOK model
flows with Redis-backed session state.

Frontend repo:
- `https://github.com/anupa-perera/sentient-ai-roundtable`

## Features

- Fixed-round orchestration (`rounds` chosen by user, no early stop).
- Sequential rotating turn order per round.
- Real-time SSE stream with replay/resume support.
- Two access flows:
  - `system`: server-side key, free models only.
  - `byok`: user key allows free + paid models, stored in service RAM for session lifetime only.
- Voting and synthesis after all rounds.
- PDF export via `POST /api/export`.

## Project Structure

```text
app/
  main.py           API app bootstrap and lifecycle
  routers/          HTTP + SSE endpoints
  core/             round orchestration, voting, synthesis logic
  services/         Redis, OpenRouter, PDF, and key-store integrations
  models/           request/response and domain schemas
  prompts/          prompt templates for panel, host, voter, synthesis
tests/              automated service tests
Dockerfile          container runtime definition
docker-compose.yml  local service + Redis stack
requirements.txt    Python dependencies
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
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Deploy (Railway/Render)

Use this repo for service deployment.

- Root directory: `/` (repo root)
- Runtime: Dockerfile (`/Dockerfile`)
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
- Service restart clears active BYOK keys.

## Tests

```bash
python -m pytest tests -q
```
