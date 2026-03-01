import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useRoundtableSSE } from "./useRoundtableSSE";
import { useSessionStore } from "../stores/session";

class MockEventSource {
  public static instances: MockEventSource[] = [];
  private listeners = new Map<string, Array<(event: { data: string; lastEventId: string }) => void>>();

  public readonly close = vi.fn();

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(
    eventName: string,
    callback: (event: { data: string; lastEventId: string }) => void
  ): void {
    const callbacks = this.listeners.get(eventName) ?? [];
    callbacks.push(callback);
    this.listeners.set(eventName, callbacks);
  }

  emit(eventName: string, payload: unknown, lastEventId = "1-0"): void {
    const callbacks = this.listeners.get(eventName) ?? [];
    for (const callback of callbacks) {
      callback({ data: JSON.stringify(payload), lastEventId });
    }
  }
}

/**
 * Test harness mounting the SSE hook as a component side effect.
 */
function HookHarness({ sessionId }: { sessionId: string }): null {
  useRoundtableSSE(sessionId);
  return null;
}

describe("useRoundtableSSE", () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("applies status, token, and turn completion events to store", () => {
    render(<HookHarness sessionId="abc" />);
    const source = MockEventSource.instances[0];
    source.emit("status", {
      phase: "running",
      round: 1,
      speaker: "model-a",
      speaking_order_position: 1
    });
    source.emit("token", { model: "model-a", text: "hello " }, "2-0");
    source.emit("token", { model: "model-a", text: "world" }, "3-0");
    source.emit("turn_complete", { round: 1, model: "model-a", response: "hello world" }, "4-0");

    const state = useSessionStore.getState();
    expect(state.phase).toBe("running");
    expect(state.currentRound).toBe(1);
    expect(state.turnTimeline).toHaveLength(1);
    expect(state.turnTimeline[0].response).toBe("hello world");
    expect(state.lastEventId).toBe("4-0");
  });
});

