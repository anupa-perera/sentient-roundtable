/**
 * Session lifecycle phases emitted by the backend state machine.
 */
export type Phase = "setup" | "running" | "voting" | "synthesis" | "complete";

/**
 * Authentication mode for OpenRouter model access.
 */
export type AuthMode = "system" | "byok";

/**
 * Model catalog item returned from backend model endpoints.
 */
export interface ModelCatalogEntry {
  id: string;
  name: string;
  pricing: Record<string, string | number | null | undefined>;
  context_length: number | null;
  is_free: boolean;
}

/**
 * Payload sent to start a roundtable session.
 */
export interface StartSessionPayload {
  question: string;
  models: string[];
  host_model: string;
  rounds: number;
  auth_mode: AuthMode;
  user_openrouter_api_key?: string;
}

/**
 * Session start API response.
 */
export interface StartSessionResponse {
  session_id: string;
}

/**
 * Discussion turn payload.
 */
export interface TurnEntry {
  round: number;
  model: string;
  response: string;
}

/**
 * Per-round summary and responses.
 */
export interface RoundData {
  roundNumber: number;
  responses: TurnEntry[];
  summary?: string;
}

/**
 * Voting payload emitted during voting phase.
 */
export interface ModelVotes {
  voter: string;
  votes: Array<{
    model: string;
    score: number;
    reason: string;
  }>;
}

/**
 * SSE status event payload.
 */
export interface StatusEvent {
  phase: Phase;
  round: number;
  speaker: string | null;
  speaking_order_position: number | null;
}

