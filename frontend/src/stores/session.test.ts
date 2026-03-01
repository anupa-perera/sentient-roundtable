import { beforeEach, describe, expect, test } from "vitest";

import { useSessionStore } from "./session";

/**
 * Reset store between test cases to avoid shared state bleed.
 */
function resetStore(): void {
  useSessionStore.getState().reset();
}

describe("session store", () => {
  beforeEach(() => {
    resetStore();
  });

  test("appendStreamingText accumulates token stream for same model", () => {
    const store = useSessionStore.getState();
    store.appendStreamingText("model-a", "hello");
    store.appendStreamingText("model-a", " world");

    const next = useSessionStore.getState();
    expect(next.liveTokenModel).toBe("model-a");
    expect(next.liveTokenBuffer).toBe("hello world");
  });

  test("finalizeTurn moves streamed response into timeline and clears buffer", () => {
    const store = useSessionStore.getState();
    store.appendStreamingText("model-a", "response");
    store.finalizeTurn({
      round: 1,
      model: "model-a",
      response: "response"
    });

    const next = useSessionStore.getState();
    expect(next.turnTimeline).toHaveLength(1);
    expect(next.liveTokenBuffer).toBe("");
    expect(next.roundData[0].responses[0].response).toBe("response");
  });

  test("beginReplay clears live session state when session changes", () => {
    const store = useSessionStore.getState();
    store.setSessionId("old");
    store.finalizeTurn({ round: 1, model: "a", response: "x" });
    store.setFindings("doc");
    store.beginReplay("new");

    const next = useSessionStore.getState();
    expect(next.sessionId).toBe("new");
    expect(next.turnTimeline).toHaveLength(0);
    expect(next.findings).toBeNull();
  });
});

