import { create } from "zustand";

import type {
  AuthMode,
  ModelCatalogEntry,
  ModelVotes,
  Phase,
  RoundData,
  TurnEntry
} from "../types";

/**
 * Shared session store used by setup, live stream, and results UI.
 */
interface SessionStore {
  sessionId: string | null;
  question: string;
  selectedModels: string[];
  hostModel: string;
  rounds: number;
  authMode: AuthMode;
  userApiKey: string;
  availableModels: ModelCatalogEntry[];

  phase: Phase;
  currentRound: number;
  activeSpeaker: string | null;
  speakingOrder: string[];

  roundData: RoundData[];
  liveTokenBuffer: string;
  liveTokenModel: string | null;
  turnTimeline: TurnEntry[];
  votes: ModelVotes[];
  findings: string | null;

  error: string | null;
  lastEventId: string | null;

  /** Update setup configuration fields from form inputs. */
  setConfig: (
    config: Partial<Pick<
      SessionStore,
      "question" | "selectedModels" | "hostModel" | "rounds" | "authMode" | "userApiKey"
    >>
  ) => void;
  /** Replace currently visible model catalog list. */
  setAvailableModels: (models: ModelCatalogEntry[]) => void;
  /** Save active session id after successful start call. */
  setSessionId: (sessionId: string) => void;
  /** Reset stream-derived state when replaying or joining another session. */
  beginReplay: (sessionId: string) => void;
  /** Apply backend status event fields. */
  setStatus: (phase: Phase, round: number, speaker: string | null) => void;
  /** Append streaming token text for current active model. */
  appendStreamingText: (model: string, text: string) => void;
  /** Finalize one speaker turn into timeline and per-round storage. */
  finalizeTurn: (turn: TurnEntry) => void;
  /** Attach host summary to a specific round. */
  setSummary: (round: number, summary: string) => void;
  /** Upsert votes for one voter model. */
  addVote: (vote: ModelVotes) => void;
  /** Store final synthesized findings markdown text. */
  setFindings: (document: string) => void;
  /** Set or clear user-facing error message. */
  setError: (message: string | null) => void;
  /** Track latest processed SSE event id for debug/reconnect context. */
  setLastEventId: (eventId: string) => void;
  /** Remove transient BYOK key from client memory. */
  clearUserApiKey: () => void;
  /** Restore store to initial state while retaining model catalog cache. */
  reset: () => void;
}

/**
 * Initial baseline state for a new session.
 */
const initialState = {
  sessionId: null as string | null,
  question: "",
  selectedModels: [] as string[],
  hostModel: "",
  rounds: 3,
  authMode: "system" as AuthMode,
  userApiKey: "",
  availableModels: [] as ModelCatalogEntry[],

  phase: "setup" as Phase,
  currentRound: 0,
  activeSpeaker: null as string | null,
  speakingOrder: [] as string[],

  roundData: [] as RoundData[],
  liveTokenBuffer: "",
  liveTokenModel: null as string | null,
  turnTimeline: [] as TurnEntry[],
  votes: [] as ModelVotes[],
  findings: null as string | null,

  error: null as string | null,
  lastEventId: null as string | null
};

/**
 * Zustand store instance for all roundtable pages.
 */
export const useSessionStore = create<SessionStore>((set, get) => ({
  ...initialState,
  /** Merge partial setup config into current state. */
  setConfig: (config) => set(config),
  /** Replace model catalog in state. */
  setAvailableModels: (models) => set({ availableModels: models }),
  /** Persist API-issued session identifier. */
  setSessionId: (sessionId) => set({ sessionId }),
  /** Reinitialize live data when replay starts for another session id. */
  beginReplay: (sessionId) =>
    set((state) => {
      if (state.sessionId === sessionId) {
        return state;
      }
      return {
        sessionId,
        phase: "setup" as Phase,
        currentRound: 0,
        activeSpeaker: null,
        speakingOrder: [],
        roundData: [],
        liveTokenBuffer: "",
        liveTokenModel: null,
        turnTimeline: [],
        votes: [],
        findings: null,
        error: null,
        lastEventId: null
      };
    }),
  /** Apply latest phase/round/speaker status snapshot. */
  setStatus: (phase, round, speaker) =>
    set({
      phase,
      currentRound: round,
      activeSpeaker: speaker
    }),
  /** Stream token chunks into active buffer, resetting on speaker change. */
  appendStreamingText: (model, text) =>
    set((state) => {
      const shouldReset = state.liveTokenModel !== model;
      return {
        liveTokenModel: model,
        liveTokenBuffer: shouldReset ? text : `${state.liveTokenBuffer}${text}`
      };
    }),
  /** Commit completed model response to timeline and round grouping. */
  finalizeTurn: (turn) =>
    set((state) => {
      const roundIndex = state.roundData.findIndex(
        (entry) => entry.roundNumber === turn.round
      );
      const nextRoundData = [...state.roundData];
      if (roundIndex === -1) {
        nextRoundData.push({
          roundNumber: turn.round,
          responses: [turn]
        });
      } else {
        nextRoundData[roundIndex] = {
          ...nextRoundData[roundIndex],
          responses: [...nextRoundData[roundIndex].responses, turn]
        };
      }

      return {
        roundData: nextRoundData,
        turnTimeline: [...state.turnTimeline, turn],
        liveTokenBuffer: "",
        liveTokenModel: null
      };
    }),
  /** Save or update host summary for a given round index. */
  setSummary: (round, summary) =>
    set((state) => {
      const roundIndex = state.roundData.findIndex(
        (entry) => entry.roundNumber === round
      );
      const nextRoundData = [...state.roundData];
      if (roundIndex === -1) {
        nextRoundData.push({
          roundNumber: round,
          responses: [],
          summary
        });
      } else {
        nextRoundData[roundIndex] = {
          ...nextRoundData[roundIndex],
          summary
        };
      }
      return { roundData: nextRoundData };
    }),
  /** Upsert voter payload while removing stale version for same voter. */
  addVote: (vote) =>
    set((state) => ({
      votes: [...state.votes.filter((existing) => existing.voter !== vote.voter), vote]
    })),
  /** Save synthesized findings markdown. */
  setFindings: (document) => set({ findings: document }),
  /** Save error text for rendering. */
  setError: (message) => set({ error: message }),
  /** Track latest SSE event id observed by client. */
  setLastEventId: (eventId) => set({ lastEventId: eventId }),
  /** Clear transient BYOK key after session start. */
  clearUserApiKey: () => set({ userApiKey: "" }),
  /** Reset to initial state while retaining loaded catalog list. */
  reset: () =>
    set({
      ...initialState,
      availableModels: get().availableModels
    })
}));
