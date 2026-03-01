# Sentient Roundtable — Project Context

## What This Project Is

Sentient Roundtable is an open-source multi-agent deliberation system. A user submits a burning question, selects AI models from OpenRouter's catalog, and those models engage in sequential round-based discussion. A host model compresses context between rounds. After all rounds, models vote on each other's factual accuracy, and a final findings document is synthesized and emailed to the user. No conversation data is stored permanently.

## Architecture Overview

This is a **separated frontend + backend** monorepo.

- **Frontend**: React 18+ SPA built with Vite. No SSR. Communicates with backend via REST (setup/config) and SSE (real-time session streaming).
- **Backend**: Python 3.12+ with FastAPI. Handles orchestration, prompt construction, OpenRouter API calls, streaming, voting, synthesis, and email delivery.
- **Data Store**: Redis only (Upstash). Ephemeral session state with TTL auto-expiry. No persistent database.
- **API Gateway**: OpenRouter (`https://openrouter.ai/api/v1/`) — single API format for all LLM providers.
- **Email**: Resend — delivers the final findings document.

```
sentient-roundtable/
├── frontend/                         # React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui primitives
│   │   │   ├── setup/
│   │   │   │   ├── QuestionInput.tsx
│   │   │   │   ├── ModelPicker.tsx
│   │   │   │   ├── HostSelector.tsx
│   │   │   │   └── RoundConfig.tsx
│   │   │   ├── roundtable/
│   │   │   │   ├── TableView.tsx
│   │   │   │   ├── SpeakerFeed.tsx
│   │   │   │   ├── RoundProgress.tsx
│   │   │   │   └── ActiveSpeaker.tsx
│   │   │   └── results/
│   │   │       ├── VoteBoard.tsx
│   │   │       ├── FindingsDoc.tsx
│   │   │       └── ExportOptions.tsx
│   │   ├── hooks/
│   │   │   ├── useRoundtableSSE.ts
│   │   │   └── useModels.ts
│   │   ├── stores/
│   │   │   └── session.ts
│   │   ├── routes/
│   │   ├── lib/
│   │   │   └── api.ts
│   │   └── types/
│   │       └── index.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app, CORS, lifespan
│   │   ├── config.py                 # pydantic-settings: env vars
│   │   ├── routers/
│   │   │   ├── roundtable.py         # POST /api/roundtable/start, GET /api/roundtable/stream/{id}
│   │   │   ├── models.py             # GET /api/models
│   │   │   └── export.py             # POST /api/export
│   │   ├── core/
│   │   │   ├── orchestrator.py       # Main round loop + state machine
│   │   │   ├── turn_manager.py       # Sequential turn logic + rotation
│   │   │   ├── compressor.py         # Host summarization
│   │   │   ├── voter.py              # Vote collection + aggregation
│   │   │   └── synthesizer.py        # Final document generation
│   │   ├── services/
│   │   │   ├── openrouter.py         # Async OpenRouter client
│   │   │   ├── redis_store.py        # Session state CRUD
│   │   │   └── email.py              # Resend integration
│   │   ├── prompts/
│   │   │   ├── panelist.py
│   │   │   ├── host.py
│   │   │   ├── voter.py
│   │   │   └── synthesis.py
│   │   └── models/                   # Pydantic schemas (NOT AI models)
│   │       ├── session.py
│   │       ├── round.py
│   │       └── vote.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
├── LICENSE
└── README.md
```

## State Machine

The system progresses through five phases. Never skip phases. Never go backward.

```
SETUP → RUNNING → VOTING → SYNTHESIS → COMPLETE
```

- **SETUP**: User configures question, models, host, round count. Frontend only.
- **RUNNING**: Sequential round loop executes. Backend streams SSE events.
- **VOTING**: Each model scores all others on factual accuracy.
- **SYNTHESIS**: Host produces the final findings document.
- **COMPLETE**: Document emailed. Redis keys expire.

## Sequential Round Logic (Critical)

This is NOT parallel. Models speak one at a time within each round. Each model sees what previous models said in that same round.

### Within a single round

```
Model A receives: [system_prompt + question + prior_round_summary]
Model A responds.

Model B receives: [system_prompt + question + prior_round_summary + A's response]
Model B responds.

Model C receives: [system_prompt + question + prior_round_summary + A's response + B's response]
Model C responds.

Host receives: [all responses from this round]
Host produces compressed summary → becomes prior_round_summary for next round.
```

### Speaking order rotates each round

Round 1 order: [A, B, C, D]
Round 2 order: [B, C, D, A]
Round 3 order: [C, D, A, B]

Implementation: shift the model array by 1 index each round.

```python
def get_speaking_order(models: list[str], round_num: int) -> list[str]:
    shift = (round_num - 1) % len(models)
    return models[shift:] + models[:shift]
```

### Context compression

The host summary is the ONLY context panelists receive from prior rounds. They never see raw transcripts from earlier rounds. This keeps per-call token costs flat regardless of total round count. Host output must be capped at 500-800 max_tokens.

## OpenRouter Integration

### Base URL
```
https://openrouter.ai/api/v1/
```

### Chat completion (non-streaming)
```python
POST /chat/completions
Headers:
  Authorization: Bearer {OPENROUTER_API_KEY}
  Content-Type: application/json
  HTTP-Referer: https://sentient-roundtable.app

Body:
{
  "model": "anthropic/claude-sonnet-4",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "max_tokens": 1000,
  "temperature": 0.8
}
```

### Streaming
Same endpoint with `"stream": true`. Response follows OpenAI SSE format:
```
data: {"choices": [{"delta": {"content": "token text"}}]}
```

### Fetching available models
```
GET /models
```
Returns array of models with `id`, `name`, `pricing` (per-token costs), `context_length`. Cache this in Redis for 1 hour.

### Free models
Filter where `pricing.prompt === "0"` and `pricing.completion === "0"`. Surface these in the model picker UI.

## Prompt Templates

### Panelist prompt
```python
def build_panelist_prompt(model_name: str, question: str, round_num: int, total_rounds: int) -> str:
    return f"""You are {model_name}, seated at a roundtable discussion.

BURNING QUESTION: "{question}"

This is round {round_num} of {total_rounds}. You must:
- Provide substantive, well-reasoned analysis
- Build on or challenge points from previous rounds if context is provided
- Be concise but thorough (2-3 paragraphs max)
- Clearly state your position and reasoning
- If you disagree with another model's point, say so directly and explain why

Speak in first person. Be bold in your positions."""
```

### Host prompt
```python
def build_host_prompt(question: str, round_num: int, total_rounds: int) -> str:
    is_final = round_num == total_rounds
    return f"""You are the HOST/MODERATOR of a roundtable discussion.

BURNING QUESTION: "{question}"

You just completed round {round_num} of {total_rounds}. Your job:
1. Summarize the key arguments and positions from this round
2. Identify points of agreement and disagreement
3. Highlight the strongest arguments made
4. {"Provide a comprehensive synthesis of all positions." if is_final else "Pose a refined follow-up angle for the next round."}

Be concise but capture all essential reasoning. This summary becomes the ONLY context the panelists receive for the next round."""
```

### Voter prompt
```python
def build_voter_prompt(model_name: str, question: str) -> str:
    return f"""You are {model_name}. A roundtable on "{question}" has concluded.

Score each OTHER panelist (not yourself) from 1-10 on FACTUAL ACCURACY.

Respond ONLY in this JSON format (no markdown, no backticks):
{{"votes": [{{"model": "model_name", "score": 8, "reason": "brief justification"}}]}}

Only score others, not yourself. Be fair but rigorous."""
```

### Synthesis prompt
```python
def build_synthesis_prompt(question: str) -> str:
    return f"""Produce the FINAL FINDINGS DOCUMENT for a roundtable discussion.

BURNING QUESTION: "{question}"

Structure:
1. **Executive Summary** — 2-3 sentence answer
2. **Key Findings** — Strongest, most agreed-upon conclusions
3. **Points of Contention** — Where panelists disagreed and why
4. **Credibility Assessment** — Who was rated most accurate and why
5. **Final Verdict** — Synthesized answer to the burning question

Be authoritative and clear."""
```

## SSE Event Schema

The backend streams events to the frontend via Server-Sent Events on `GET /api/roundtable/stream/{session_id}`.

```
event: status
data: {"phase": "running", "round": 1, "speaker": "anthropic/claude-sonnet-4", "speaking_order_position": 1}

event: token
data: {"model": "anthropic/claude-sonnet-4", "text": "partial token text"}

event: turn_complete
data: {"round": 1, "model": "anthropic/claude-sonnet-4", "response": "full response text"}

event: summary
data: {"round": 1, "summary": "host's compressed summary text"}

event: vote
data: {"voter": "openai/gpt-4o", "votes": [{"model": "...", "score": 8, "reason": "..."}]}

event: synthesis
data: {"document": "full findings document markdown"}

event: complete
data: {"session_id": "...", "email_sent": true}

event: error
data: {"message": "error description", "recoverable": false}
```

## Redis Key Schema

All keys use `session:{id}` prefix. TTL is 2-4 hours on all keys.

```
session:{id}:config      → JSON: {question, models, host_model, rounds, email}
session:{id}:state       → JSON: {phase, current_round, active_speaker, speaking_order}
session:{id}:round:{n}   → JSON: {responses: [{model, response}], summary}
session:{id}:votes       → JSON: [{voter, votes: [{model, score, reason}]}]
session:{id}:findings    → string: final document text
```

## Pydantic Models

```python
from pydantic import BaseModel, Field
from enum import Enum

class Phase(str, Enum):
    SETUP = "setup"
    RUNNING = "running"
    VOTING = "voting"
    SYNTHESIS = "synthesis"
    COMPLETE = "complete"

class SessionConfig(BaseModel):
    question: str = Field(..., min_length=10, max_length=2000)
    models: list[str] = Field(..., min_length=2, max_length=8)
    host_model: str
    rounds: int = Field(default=3, ge=1, le=10)
    email: str | None = None

class ModelResponse(BaseModel):
    model_id: str
    model_name: str
    response: str

class RoundData(BaseModel):
    round_number: int
    responses: list[ModelResponse]
    summary: str

class Vote(BaseModel):
    model: str
    score: int = Field(..., ge=1, le=10)
    reason: str

class ModelVotes(BaseModel):
    voter: str
    votes: list[Vote]

class SessionState(BaseModel):
    session_id: str
    phase: Phase
    current_round: int = 0
    config: SessionConfig
    rounds: list[RoundData] = []
    votes: list[ModelVotes] = []
    findings: str | None = None
```

## API Endpoints

```
POST /api/roundtable/start
  Body: SessionConfig
  Returns: {session_id: str}
  Creates session in Redis, returns ID for SSE stream.

GET /api/roundtable/stream/{session_id}
  Returns: text/event-stream
  Starts orchestration and streams all events until complete.

GET /api/models
  Returns: list of available OpenRouter models with pricing.
  Cached in Redis for 1 hour.

POST /api/export
  Body: {session_id: str, format: "email" | "markdown" | "pdf"}
  Sends findings document via email or returns downloadable file.
```

## Frontend Conventions

- **Framework**: React 18+ with TypeScript, built by Vite
- **Routing**: React Router v7 (file-based or config-based, contributor's choice)
- **Styling**: Tailwind CSS v3 with shadcn/ui components
- **State**: Zustand for session state. One store file: `stores/session.ts`
- **SSE Hook**: `useRoundtableSSE(sessionId)` returns reactive state. Uses native `EventSource`.
- **No SSR**: This is a pure SPA. No server components, no server-side rendering.
- **No localStorage**: Use Zustand in-memory state only. Sessions are ephemeral.

### Zustand Store Shape
```typescript
interface SessionStore {
  // Config
  sessionId: string | null;
  question: string;
  selectedModels: string[];
  hostModel: string;
  rounds: number;

  // Live state
  phase: Phase;
  currentRound: number;
  activeSpeaker: string | null;
  speakingOrder: string[];

  // Data
  roundData: RoundData[];
  streamingText: string;
  votes: ModelVotes[];
  findings: string | null;

  // Errors
  error: string | null;

  // Actions
  setConfig: (config: Partial<SessionConfig>) => void;
  startSession: () => Promise<void>;
  reset: () => void;
}
```

### SSE Hook Pattern
```typescript
function useRoundtableSSE(sessionId: string | null) {
  const store = useSessionStore();

  useEffect(() => {
    if (!sessionId) return;

    const source = new EventSource(`${API_BASE}/api/roundtable/stream/${sessionId}`);

    source.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      store.setPhase(data.phase);
      store.setActiveSpeaker(data.speaker);
      store.setCurrentRound(data.round);
    });

    source.addEventListener("token", (e) => {
      const data = JSON.parse(e.data);
      store.appendStreamingText(data.text);
    });

    source.addEventListener("turn_complete", (e) => {
      const data = JSON.parse(e.data);
      store.addResponse(data);
      store.clearStreamingText();
    });

    source.addEventListener("summary", (e) => {
      const data = JSON.parse(e.data);
      store.setSummary(data.round, data.summary);
    });

    source.addEventListener("vote", (e) => {
      const data = JSON.parse(e.data);
      store.addVote(data);
    });

    source.addEventListener("synthesis", (e) => {
      const data = JSON.parse(e.data);
      store.setFindings(data.document);
    });

    source.addEventListener("complete", () => {
      store.setPhase("complete");
    });

    source.addEventListener("error", (e) => {
      // EventSource auto-reconnects. Only handle fatal errors.
    });

    return () => source.close();
  }, [sessionId]);
}
```

## Backend Conventions

- **Python 3.12+** with type hints everywhere
- **FastAPI** with async route handlers
- **httpx** for async HTTP calls to OpenRouter (with streaming)
- **sse-starlette** for SSE responses
- **pydantic-settings** for config from env vars
- **Redis via redis-py async** (`redis.asyncio`)

### Orchestrator Pattern
```python
async def run_roundtable(session_id: str, config: SessionConfig, event_emitter: Callable):
    """
    Main orchestration loop. Framework-agnostic.
    event_emitter is a callback that sends SSE events to the client.
    """
    models = config.models
    
    for round_num in range(1, config.rounds + 1):
        order = get_speaking_order(models, round_num)
        prior_summary = await get_prior_summary(session_id, round_num)
        round_responses = []

        for i, model_id in enumerate(order):
            await event_emitter("status", {
                "phase": "running",
                "round": round_num,
                "speaker": model_id,
                "speaking_order_position": i + 1,
            })

            # Build context: prior summary + responses from earlier speakers THIS round
            context = build_turn_context(
                question=config.question,
                prior_summary=prior_summary,
                earlier_responses=round_responses,
                round_num=round_num,
                total_rounds=config.rounds,
            )

            response = await call_openrouter_streaming(
                model=model_id,
                system_prompt=build_panelist_prompt(model_id, config.question, round_num, config.rounds),
                user_message=context,
                on_token=lambda t: event_emitter("token", {"model": model_id, "text": t}),
            )

            round_responses.append({"model": model_id, "response": response})
            await event_emitter("turn_complete", {
                "round": round_num,
                "model": model_id,
                "response": response,
            })

        # Host summarizes
        summary = await call_openrouter(
            model=config.host_model,
            system_prompt=build_host_prompt(config.question, round_num, config.rounds),
            user_message=format_round_for_host(round_responses),
            max_tokens=800,
        )

        await save_round(session_id, round_num, round_responses, summary)
        await event_emitter("summary", {"round": round_num, "summary": summary})

    # Voting phase
    await run_voting_phase(session_id, config, event_emitter)

    # Synthesis phase
    await run_synthesis_phase(session_id, config, event_emitter)
```

### OpenRouter Client Pattern
```python
import httpx

async def call_openrouter_streaming(
    model: str,
    system_prompt: str,
    user_message: str,
    on_token: Callable[[str], Awaitable[None]],
    max_tokens: int = 1000,
) -> str:
    """Call OpenRouter with streaming, invoke callback per token, return full response."""
    full_response = ""

    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sentient-roundtable.app",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "max_tokens": max_tokens,
                "temperature": 0.8,
                "stream": True,
            },
            timeout=120.0,
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    chunk = json.loads(line[6:])
                    token = chunk["choices"][0]["delta"].get("content", "")
                    if token:
                        full_response += token
                        await on_token(token)

    return full_response
```

### SSE Response Pattern (FastAPI)
```python
from sse_starlette.sse import EventSourceResponse

@router.get("/stream/{session_id}")
async def stream_session(session_id: str):
    async def event_generator():
        async def emit(event_type: str, data: dict):
            yield {"event": event_type, "data": json.dumps(data)}

        config = await get_session_config(session_id)
        await run_roundtable(session_id, config, emit)

    return EventSourceResponse(event_generator())
```

## Token Budget Guidelines

| Call Type | max_tokens | Purpose |
|-----------|-----------|---------|
| Panelist response | 800-1000 | Substantive but concise (2-3 paragraphs) |
| Host summary | 500-800 | Compressed context for next round |
| Voter output | 300 | JSON with scores and brief reasons |
| Synthesis | 1500-2000 | Full findings document |

Temperature: 0.8 for panelists (creative discourse), 0.3 for host and voter (precision).

## Environment Variables

```env
# Required
OPENROUTER_API_KEY=sk-or-...

# Redis
REDIS_URL=redis://localhost:6379  # or Upstash URL
REDIS_TOKEN=                       # Upstash token (if using Upstash REST)

# Email (optional — findings download works without it)
RESEND_API_KEY=re_...
DEFAULT_FROM_EMAIL=roundtable@yourdomain.com

# App
SESSION_TTL_SECONDS=14400          # 4 hours
CORS_ORIGINS=http://localhost:5173
API_HOST=0.0.0.0
API_PORT=8000
```

## Local Development

```bash
# Start backend + Redis
docker-compose up -d

# Start frontend dev server
cd frontend && npm install && npm run dev

# Backend runs at http://localhost:8000 (Swagger at /docs)
# Frontend runs at http://localhost:5173
```

### docker-compose.yml
```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      - redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Deployment

- **Frontend**: Cloudflare Pages. Static SPA, zero config. Connects to deployed backend URL.
- **Backend**: Railway or Fly.io. No timeout limits for long-running SSE streams. Auto-deploys from GitHub.
- **Redis**: Upstash serverless Redis. Free tier: 10,000 commands/day.

## Error Handling

- OpenRouter calls can fail (rate limits, model unavailable, network). Wrap every call in try/except. On failure, emit an SSE `error` event with the model ID and error message, then continue with remaining models.
- If the host summarization fails, use a fallback: concatenate the last 500 tokens of each panelist response as the "summary" for the next round.
- If a voter fails to return valid JSON, skip that voter's scores. The aggregation should handle partial vote sets.
- Never crash the entire session because one model failed. Degrade gracefully.

## Testing Strategy

- **Unit tests**: Orchestrator logic (turn rotation, context building) with mocked OpenRouter responses.
- **Integration tests**: Full round loop with a cheap/free OpenRouter model.
- **Frontend tests**: Vitest + React Testing Library for component rendering. Mock the SSE stream.
