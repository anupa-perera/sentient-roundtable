import { useEffect } from "react";

import { API_BASE } from "../lib/api";
import { useSessionStore } from "../stores/session";
import type { ModelVotes, StatusEvent } from "../types";

/**
 * Parse typed payload from an SSE message event.
 */
function parseEventData<TPayload>(message: MessageEvent<string>): TPayload {
  return JSON.parse(message.data) as TPayload;
}

/**
 * Open and maintain the SSE connection for a session.
 *
 * The backend replays events from stream start when no Last-Event-ID is supplied,
 * allowing full state reconstruction on page reload.
 */
export function useRoundtableSSE(sessionId: string | null): void {
  const beginReplay = useSessionStore((state) => state.beginReplay);
  const setStatus = useSessionStore((state) => state.setStatus);
  const appendStreamingText = useSessionStore((state) => state.appendStreamingText);
  const finalizeTurn = useSessionStore((state) => state.finalizeTurn);
  const setSummary = useSessionStore((state) => state.setSummary);
  const addVote = useSessionStore((state) => state.addVote);
  const setFindings = useSessionStore((state) => state.setFindings);
  const setError = useSessionStore((state) => state.setError);
  const setLastEventId = useSessionStore((state) => state.setLastEventId);

  useEffect(() => {
    /**
     * Skip stream setup when no session id is available.
     */
    if (!sessionId) {
      return;
    }
    beginReplay(sessionId);
    const source = new EventSource(`${API_BASE}/api/roundtable/stream/${sessionId}`);

    source.addEventListener("status", (event) => {
      const message = event as MessageEvent<string>;
      if (message.lastEventId) {
        setLastEventId(message.lastEventId);
      }
      const payload = parseEventData<StatusEvent>(message);
      setStatus(payload.phase, payload.round, payload.speaker);
    });

    source.addEventListener("token", (event) => {
      const message = event as MessageEvent<string>;
      if (message.lastEventId) {
        setLastEventId(message.lastEventId);
      }
      const payload = parseEventData<{ model: string; text: string }>(message);
      appendStreamingText(payload.model, payload.text);
    });

    source.addEventListener("turn_complete", (event) => {
      const message = event as MessageEvent<string>;
      if (message.lastEventId) {
        setLastEventId(message.lastEventId);
      }
      const payload = parseEventData<{
        round: number;
        model: string;
        response: string;
      }>(message);
      finalizeTurn({
        round: payload.round,
        model: payload.model,
        response: payload.response
      });
    });

    source.addEventListener("summary", (event) => {
      const message = event as MessageEvent<string>;
      if (message.lastEventId) {
        setLastEventId(message.lastEventId);
      }
      const payload = parseEventData<{ round: number; summary: string }>(message);
      setSummary(payload.round, payload.summary);
    });

    source.addEventListener("vote", (event) => {
      const message = event as MessageEvent<string>;
      if (message.lastEventId) {
        setLastEventId(message.lastEventId);
      }
      const payload = parseEventData<ModelVotes>(message);
      addVote(payload);
    });

    source.addEventListener("synthesis", (event) => {
      const message = event as MessageEvent<string>;
      if (message.lastEventId) {
        setLastEventId(message.lastEventId);
      }
      const payload = parseEventData<{ document: string }>(message);
      setFindings(payload.document);
    });

    source.addEventListener("complete", (event) => {
      const message = event as MessageEvent<string>;
      if (message.lastEventId) {
        setLastEventId(message.lastEventId);
      }
      setStatus("complete", useSessionStore.getState().currentRound, null);
    });

    source.addEventListener("error", (event) => {
      const message = event as MessageEvent<string>;
      if (!message?.data) {
        return;
      }
      try {
        const payload = parseEventData<{ message?: string }>(message);
        if (payload.message) {
          setError(payload.message);
        }
      } catch {
        setError("A stream error occurred.");
      }
    });

    return () => {
      /**
       * Release browser EventSource connection on unmount or session change.
       */
      source.close();
    };
  }, [
    addVote,
    appendStreamingText,
    beginReplay,
    finalizeTurn,
    sessionId,
    setError,
    setFindings,
    setLastEventId,
    setStatus,
    setSummary
  ]);
}
