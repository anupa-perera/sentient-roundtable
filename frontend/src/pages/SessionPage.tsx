import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ChatMessage } from "../components/ChatMessage";
import { MarkdownProse } from "../components/MarkdownProse";
import { PhaseProgress } from "../components/PhaseProgress";
import { StreamingMessage } from "../components/StreamingMessage";
import { VoteBar } from "../components/VoteBar";
import { exportSessionPdf } from "../lib/api";
import { getModelShortName } from "../lib/colors";
import { useRoundtableSSE } from "../hooks/useRoundtableSSE";
import { useSessionStore } from "../stores/session";

/**
 * Live session page with chat panel layout.
 * Shows real-time discussion as a chat feed with sidebar for metadata.
 */
export function SessionPage(): JSX.Element {
  const params = useParams();
  const requestedSessionId = params.sessionId ?? null;
  const sessionId = useSessionStore((state) => state.sessionId);
  const phase = useSessionStore((state) => state.phase);
  const currentRound = useSessionStore((state) => state.currentRound);
  const activeSpeaker = useSessionStore((state) => state.activeSpeaker);
  const liveTokenBuffer = useSessionStore((state) => state.liveTokenBuffer);
  const liveTokenModel = useSessionStore((state) => state.liveTokenModel);
  const timeline = useSessionStore((state) => state.turnTimeline);
  const rounds = useSessionStore((state) => state.roundData);
  const votes = useSessionStore((state) => state.votes);
  const findings = useSessionStore((state) => state.findings);
  const error = useSessionStore((state) => state.error);
  const setError = useSessionStore((state) => state.setError);
  const selectedModels = useSessionStore((state) => state.selectedModels);

  const [exporting, setExporting] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [isSnackbarVisible, setIsSnackbarVisible] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const effectiveSessionId = requestedSessionId ?? sessionId;
  useRoundtableSSE(effectiveSessionId);

  const sortedRounds = useMemo(
    () => [...rounds].sort((a, b) => a.roundNumber - b.roundNumber),
    [rounds]
  );

  // Derive unique models from timeline for color assignment
  const allModels = useMemo(() => {
    if (selectedModels.length > 0) return selectedModels;
    const seen = new Set<string>();
    const list: string[] = [];
    for (const turn of timeline) {
      if (!seen.has(turn.model)) {
        seen.add(turn.model);
        list.push(turn.model);
      }
    }
    return list;
  }, [selectedModels, timeline]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline.length, liveTokenBuffer]);

  /**
   * Show stream errors as temporary snackbar notifications.
   * The message fades out and then clears from global store.
   */
  useEffect(() => {
    if (!error) {
      return;
    }
    setSnackbarMessage(error);
    setIsSnackbarVisible(true);

    const hideTimer = window.setTimeout(() => {
      setIsSnackbarVisible(false);
    }, 4200);
    const clearTimer = window.setTimeout(() => {
      setSnackbarMessage(null);
      setError(null);
    }, 5000);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, [error, setError]);

  if (!effectiveSessionId) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="glass rounded-2xl p-8">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-slate-600">
              <svg
                className="h-6 w-6 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </div>
          <p className="font-sans text-sm text-slatewarm dark:text-slate-400">
            No session ID provided.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block font-sans text-sm font-semibold text-ember transition hover:text-orange-700"
          >
            Back to Setup
          </Link>
        </div>
      </main>
    );
  }

  async function handleExportPdf(): Promise<void> {
    if (!effectiveSessionId) return;
    setExporting(true);
    try {
      const blob = await exportSessionPdf(effectiveSessionId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `roundtable-${effectiveSessionId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error shown through backend stream events
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="relative mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
      {/* Phase Progress */}
      <section className="glass mb-5 animate-fade-in rounded-2xl px-6 py-4 shadow-panel dark:shadow-panel-dark">
        <PhaseProgress currentPhase={phase} />
      </section>

      <ErrorSnackbar
        message={snackbarMessage}
        visible={isSnackbarVisible}
        onClose={() => {
          setIsSnackbarVisible(false);
          setSnackbarMessage(null);
          setError(null);
        }}
      />

      {/* Main content grid */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Chat Panel (2/3) */}
        <article className="glass flex flex-col rounded-2xl shadow-panel dark:shadow-panel-dark xl:col-span-2">
          {/* Chat header */}
          <div className="flex items-center justify-between border-b border-slate-200/50 px-5 py-3 dark:border-slate-700/30">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ember/10">
                <svg
                  className="h-3.5 w-3.5 text-ember"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="font-sans text-sm font-bold text-ink dark:text-white">
                  Discussion
                </h2>
                <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  {effectiveSessionId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeSpeaker && phase === "running" && (
                <span className="flex items-center gap-1.5 rounded-full bg-ember/10 px-2.5 py-1 font-mono text-[10px] font-medium text-ember">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ember" />
                  {getModelShortName(activeSpeaker)} speaking
                </span>
              )}
              <StatusBadge phase={phase} round={currentRound} />
            </div>
          </div>

          {/* Chat messages area */}
          <div className="flex-1 space-y-4 overflow-auto px-5 py-4" style={{ maxHeight: "36rem" }}>
            {timeline.length === 0 && !liveTokenBuffer && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-slate-200 dark:border-slate-700">
                  {phase === "setup" ? (
                    <svg
                      className="h-7 w-7 text-slate-300 dark:text-slate-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  ) : (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-ember dark:border-slate-600 dark:border-t-ember" />
                  )}
                </div>
                <p className="font-sans text-sm text-slate-400 dark:text-slate-500">
                  {phase === "setup"
                    ? "Waiting for session to begin..."
                    : "Connecting to session stream..."}
                </p>
              </div>
            )}

            {/* Render timeline with round dividers */}
            {renderTimeline(timeline, allModels, sortedRounds)}

            {/* Streaming message */}
            {liveTokenBuffer && liveTokenModel && (
              <StreamingMessage
                model={liveTokenModel}
                text={liveTokenBuffer}
                allModels={allModels}
              />
            )}

            {/* Auto-scroll anchor */}
            <div ref={chatEndRef} />
          </div>
        </article>

        {/* Sidebar (1/3) */}
        <aside className="space-y-5">
          {/* Round Summaries */}
          <section className="glass rounded-2xl p-4 shadow-panel dark:shadow-panel-dark">
            <h3 className="mb-3 flex items-center gap-2 font-sans text-sm font-bold text-ink dark:text-white">
              <svg
                className="h-3.5 w-3.5 text-ember"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Round Summaries
            </h3>
            <div className="max-h-64 space-y-3 overflow-auto">
              {sortedRounds.map((round) => (
                <article
                  key={round.roundNumber}
                  className="animate-fade-in rounded-xl border border-slate-200/50 p-3 dark:border-slate-700/30"
                >
                  <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-ember">
                    Round {round.roundNumber}
                  </p>
                  <p className="font-serif text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {round.summary ?? (
                      <span className="italic text-slate-400 dark:text-slate-500">
                        Summary pending...
                      </span>
                    )}
                  </p>
                </article>
              ))}
              {!sortedRounds.length && (
                <p className="py-4 text-center font-sans text-xs text-slate-400 dark:text-slate-500">
                  Summaries appear after each round.
                </p>
              )}
            </div>
          </section>

          {/* Votes */}
          <section className="glass rounded-2xl p-4 shadow-panel dark:shadow-panel-dark">
            <h3 className="mb-3 flex items-center gap-2 font-sans text-sm font-bold text-ink dark:text-white">
              <svg
                className="h-3.5 w-3.5 text-ember"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Votes
            </h3>
            <div className="max-h-72 space-y-4 overflow-auto">
              {votes.map((voteSet) => (
                <article key={voteSet.voter} className="animate-fade-in">
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-slatewarm dark:text-slate-400">
                    Voter: {getModelShortName(voteSet.voter)}
                  </p>
                  <div className="space-y-3">
                    {voteSet.votes.map((vote) => (
                      <VoteBar
                        key={`${voteSet.voter}-${vote.model}`}
                        model={vote.model}
                        score={vote.score}
                        reason={vote.reason}
                        allModels={allModels}
                      />
                    ))}
                  </div>
                </article>
              ))}
              {!votes.length && (
                <p className="py-4 text-center font-sans text-xs text-slate-400 dark:text-slate-500">
                  Votes appear during the voting phase.
                </p>
              )}
            </div>
          </section>
        </aside>
      </section>

      {/* Final Findings */}
      <section className="glass mt-5 animate-fade-in rounded-2xl p-5 shadow-panel dark:shadow-panel-dark">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-ink dark:text-white">
            <svg
              className="h-4 w-4 text-ember"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Final Findings
          </h2>
          <button
            type="button"
            disabled={phase !== "complete" || !findings || exporting}
            onClick={handleExportPdf}
            className="rounded-xl bg-ember px-4 py-2 font-sans text-xs font-bold uppercase tracking-wider text-white shadow-glow-sm transition-all hover:bg-orange-700 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {exporting ? "Exporting..." : "Download PDF"}
          </button>
        </div>
        <div className="rounded-xl border border-slate-200/50 p-4 dark:border-slate-700/30">
          {findings ? (
            <MarkdownProse content={findings} />
          ) : (
            <div className="flex flex-col items-center py-8">
              <p className="font-sans text-sm text-slate-400 dark:text-slate-500">
                Findings will appear after all rounds, voting, and synthesis complete.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

/**
 * Floating snackbar for transient stream errors.
 */
function ErrorSnackbar({
  message,
  visible,
  onClose
}: {
  message: string | null;
  visible: boolean;
  onClose: () => void;
}): JSX.Element | null {
  if (!message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-[min(92vw,26rem)] sm:bottom-6 sm:right-6">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto rounded-xl border border-red-200/80 bg-red-50/95 px-4 py-3 shadow-lg backdrop-blur transition-all duration-300 dark:border-red-800/60 dark:bg-red-900/35 ${
          visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-red-100 p-1 dark:bg-red-900/60">
            <svg
              className="h-3.5 w-3.5 text-red-600 dark:text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="flex-1 pr-1 font-sans text-sm text-red-700 dark:text-red-300">{message}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-red-500 transition hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/50 dark:hover:text-red-300"
            aria-label="Dismiss error notification"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Render the timeline with round dividers between groups.
 */
function renderTimeline(
  timeline: { round: number; model: string; response: string }[],
  allModels: string[],
  sortedRounds: { roundNumber: number; summary?: string }[]
) {
  const elements: JSX.Element[] = [];
  let lastRound = 0;

  for (let index = 0; index < timeline.length; index++) {
    const turn = timeline[index];
    const isNewRound = turn.round !== lastRound;

    // Show host summary from previous round before the divider
    if (isNewRound && lastRound > 0) {
      const prevRound = sortedRounds.find((r) => r.roundNumber === lastRound);
      if (prevRound?.summary) {
        elements.push(
          <div
            key={`summary-${lastRound}`}
            className="mx-auto max-w-md animate-fade-in rounded-xl border border-amber-200/50 bg-amber-50/50 px-4 py-2.5 dark:border-amber-800/20 dark:bg-amber-900/10"
          >
            <p className="mb-1 text-center font-mono text-[9px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-500">
              Host Summary - Round {lastRound}
            </p>
            <p className="text-center font-serif text-xs leading-relaxed text-amber-800 dark:text-amber-300/80">
              {prevRound.summary}
            </p>
          </div>
        );
      }
    }

    // Round divider
    if (isNewRound) {
      lastRound = turn.round;
      elements.push(
        <div key={`divider-${turn.round}`} className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700/50" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            Round {turn.round}
          </span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700/50" />
        </div>
      );
    }

    // Chat message
    elements.push(
      <ChatMessage
        key={`${turn.round}-${turn.model}-${index}`}
        model={turn.model}
        round={turn.round}
        response={turn.response}
        allModels={allModels}
      />
    );
  }

  return <Fragment>{elements}</Fragment>;
}

/**
 * Compact status badge showing phase and round.
 */
function StatusBadge({ phase, round }: { phase: string; round: number }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800/80">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          phase === "complete"
            ? "bg-emerald-500"
            : phase === "running"
              ? "animate-pulse bg-ember"
              : "bg-slate-400"
        }`}
      />
      <span className="font-mono text-[10px] font-medium text-slatewarm dark:text-slate-400">
        {phase}{round > 0 ? ` / R${round}` : ""}
      </span>
    </div>
  );
}
