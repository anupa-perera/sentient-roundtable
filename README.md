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

