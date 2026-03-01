import type {
  ModelCatalogEntry,
  StartSessionPayload,
  StartSessionResponse
} from "../types";

/**
 * Backend API base URL from env with localhost fallback for development.
 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

/**
 * Fetch free-only model catalog for the system key flow.
 */
export async function fetchSystemModels(): Promise<ModelCatalogEntry[]> {
  const response = await fetch(`${API_BASE}/api/models`);
  if (!response.ok) {
    throw new Error(await safeErrorText(response));
  }
  return (await response.json()) as ModelCatalogEntry[];
}

/**
 * Fetch full model catalog using BYOK key without persisting it.
 */
export async function fetchByokModels(apiKey: string): Promise<ModelCatalogEntry[]> {
  const response = await fetch(`${API_BASE}/api/models/byok`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_openrouter_api_key: apiKey })
  });
  if (!response.ok) {
    throw new Error(await safeErrorText(response));
  }
  return (await response.json()) as ModelCatalogEntry[];
}

/**
 * Start a new roundtable session and return session id.
 */
export async function startRoundtable(
  payload: StartSessionPayload
): Promise<StartSessionResponse> {
  const response = await fetch(`${API_BASE}/api/roundtable/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await safeErrorText(response));
  }
  return (await response.json()) as StartSessionResponse;
}

/**
 * Request PDF export for a completed session.
 */
export async function exportSessionPdf(sessionId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, format: "pdf" })
  });
  if (!response.ok) {
    throw new Error(await safeErrorText(response));
  }
  return await response.blob();
}

/**
 * Produce a compact error string from API responses.
 */
async function safeErrorText(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string };
    return data.detail ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

