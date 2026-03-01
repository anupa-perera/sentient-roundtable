import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ModelCard } from "../components/ModelCard";
import { fetchByokModels, fetchSystemModels, startRoundtable } from "../lib/api";
import { useSessionStore } from "../stores/session";
import type { AuthMode } from "../types";

/**
 * Setup form for configuring a deliberation session.
 * Futuristic glassmorphic design with model cards and search filter.
 */
export function SetupPage(): JSX.Element {
  const navigate = useNavigate();
  const question = useSessionStore((state) => state.question);
  const rounds = useSessionStore((state) => state.rounds);
  const selectedModels = useSessionStore((state) => state.selectedModels);
  const hostModel = useSessionStore((state) => state.hostModel);
  const authMode = useSessionStore((state) => state.authMode);
  const userApiKey = useSessionStore((state) => state.userApiKey);
  const availableModels = useSessionStore((state) => state.availableModels);
  const setConfig = useSessionStore((state) => state.setConfig);
  const setAvailableModels = useSessionStore((state) => state.setAvailableModels);
  const setSessionId = useSessionStore((state) => state.setSessionId);
  const clearUserApiKey = useSessionStore((state) => state.clearUserApiKey);

  const [loadingModels, setLoadingModels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState("");

  const canStart = useMemo(
    () =>
      question.trim().length >= 10 &&
      rounds >= 1 &&
      rounds <= 10 &&
      selectedModels.length >= 2 &&
      hostModel.length > 0,
    [hostModel, question, rounds, selectedModels.length]
  );

  const filteredModels = useMemo(
    () =>
      availableModels.filter(
        (m) =>
          m.name.toLowerCase().includes(modelFilter.toLowerCase()) ||
          m.id.toLowerCase().includes(modelFilter.toLowerCase())
      ),
    [availableModels, modelFilter]
  );

  useEffect(() => {
    if (authMode === "system") {
      void loadSystemCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authMode]);

  async function loadSystemCatalog(): Promise<void> {
    setLoadingModels(true);
    setFormError(null);
    try {
      const models = await fetchSystemModels();
      setAvailableModels(models);
      setConfig({ selectedModels: [], hostModel: "" });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setLoadingModels(false);
    }
  }

  async function loadByokCatalog(): Promise<void> {
    if (!userApiKey.trim()) {
      setFormError("Please enter your OpenRouter API key first.");
      return;
    }
    setLoadingModels(true);
    setFormError(null);
    try {
      const models = await fetchByokModels(userApiKey.trim());
      setAvailableModels(models);
      setConfig({ selectedModels: [], hostModel: "" });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setLoadingModels(false);
    }
  }

  function toggleModel(modelId: string): void {
    const exists = selectedModels.includes(modelId);
    const nextModels = exists
      ? selectedModels.filter((entry) => entry !== modelId)
      : selectedModels.length < 8
        ? [...selectedModels, modelId]
        : selectedModels;
    const nextHost = nextModels.includes(hostModel) ? hostModel : nextModels[0] ?? "";
    setConfig({ selectedModels: nextModels, hostModel: nextHost });
  }

  async function handleStart(): Promise<void> {
    if (!canStart) {
      setFormError("Question, rounds, panelists, and host are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const response = await startRoundtable({
        question: question.trim(),
        models: selectedModels,
        host_model: hostModel,
        rounds,
        auth_mode: authMode,
        user_openrouter_api_key: authMode === "byok" ? userApiKey.trim() : undefined
      });
      setSessionId(response.session_id);
      clearUserApiKey();
      navigate(`/session/${response.session_id}`);
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Hero */}
      <header className="mb-8 animate-fade-in text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.25em] text-ember">
          Configure Session
        </p>
        <h1 className="font-sans text-3xl font-bold text-ink dark:text-white sm:text-4xl">
          Build Your Roundtable
        </h1>
        <p className="mx-auto mt-3 max-w-xl font-serif text-base text-slatewarm dark:text-slate-400">
          Pose a burning question, select AI panelists, and watch them deliberate in real time.
        </p>
      </header>

      {/* Question */}
      <section className="glass mb-5 animate-fade-in rounded-2xl p-5 shadow-panel dark:shadow-panel-dark">
        <label className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-sans text-sm font-semibold text-ink dark:text-slate-200">
              Burning Question
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {question.trim().length}/2000
            </span>
          </div>
          <textarea
            className="min-h-28 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 font-serif text-base text-ink placeholder-slate-400 transition-colors focus:border-ember focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-ember"
            value={question}
            onChange={(event) => setConfig({ question: event.target.value })}
            placeholder="What is the most likely impact of AI-native education in the next 5 years?"
            maxLength={2000}
          />
        </label>
      </section>

      {/* Settings row */}
      <div className="mb-5 grid animate-fade-in grid-cols-1 gap-5 delay-75 sm:grid-cols-2">
        {/* Rounds */}
        <section className="glass rounded-2xl p-5 shadow-panel dark:shadow-panel-dark">
          <label className="flex flex-col gap-2">
            <span className="font-sans text-sm font-semibold text-ink dark:text-slate-200">
              Rounds
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => rounds > 1 && setConfig({ rounds: rounds - 1 })}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white font-mono text-lg text-ink transition hover:border-ember dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                -
              </button>
              <span className="min-w-[2rem] text-center font-mono text-xl font-bold text-ink dark:text-white">
                {rounds}
              </span>
              <button
                type="button"
                onClick={() => rounds < 10 && setConfig({ rounds: rounds + 1 })}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white font-mono text-lg text-ink transition hover:border-ember dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                +
              </button>
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500">1-10</span>
            </div>
          </label>
        </section>

        {/* Access mode */}
        <section className="glass rounded-2xl p-5 shadow-panel dark:shadow-panel-dark">
          <fieldset className="flex flex-col gap-2">
            <legend className="font-sans text-sm font-semibold text-ink dark:text-slate-200">
              Access Mode
            </legend>
            <div className="flex gap-2">
              <ModePill
                label="System (free)"
                active={authMode === "system"}
                onClick={() => setConfig({ authMode: "system" })}
              />
              <ModePill
                label="BYOK"
                active={authMode === "byok"}
                onClick={() => setConfig({ authMode: "byok" })}
              />
            </div>
          </fieldset>
        </section>
      </div>

      {/* BYOK key input */}
      {authMode === "byok" && (
        <section className="glass mb-5 animate-fade-in rounded-2xl p-5 shadow-panel dark:shadow-panel-dark">
          <label className="font-sans text-sm font-semibold text-ink dark:text-slate-200">
            OpenRouter API Key
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={userApiKey}
              onChange={(event) => setConfig({ userApiKey: event.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 font-mono text-sm text-ink placeholder-slate-400 focus:border-ember focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder-slate-500"
              placeholder="sk-or-..."
            />
            <button
              type="button"
              onClick={loadByokCatalog}
              disabled={loadingModels}
              className="shrink-0 rounded-xl bg-ink px-5 py-2.5 font-sans text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              {loadingModels ? "Loading..." : "Load Models"}
            </button>
          </div>
        </section>
      )}

      {/* Model selection */}
      <section className="glass mb-5 animate-fade-in rounded-2xl p-5 shadow-panel delay-150 dark:shadow-panel-dark">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-sans text-lg font-bold text-ink dark:text-white">
              Panel Models
            </h2>
            <span className="rounded-full bg-ember/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-ember">
              {selectedModels.length}/8
            </span>
            {authMode === "system" && loadingModels && (
              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                Loading...
              </span>
            )}
          </div>

          {/* Search filter */}
          {availableModels.length > 0 && (
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                placeholder="Filter models..."
                className="rounded-lg border border-slate-200 bg-white/80 py-1.5 pl-8 pr-3 font-mono text-xs text-ink placeholder-slate-400 focus:border-ember focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
          )}
        </div>

        <div className="max-h-80 space-y-1.5 overflow-auto">
          {filteredModels.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              selected={selectedModels.includes(model.id)}
              onToggle={() => toggleModel(model.id)}
              showPaidBadge={authMode === "byok"}
            />
          ))}
          {!availableModels.length && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-300 dark:border-slate-600">
                <svg
                  className="h-5 w-5 text-slate-400 dark:text-slate-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
              <p className="font-sans text-sm text-slate-400 dark:text-slate-500">
                {authMode === "system"
                  ? "No models loaded yet."
                  : "Enter your key and click Load Models."}
              </p>
            </div>
          )}
          {availableModels.length > 0 && !filteredModels.length && (
            <p className="py-4 text-center font-sans text-sm text-slate-400 dark:text-slate-500">
              No models match &quot;{modelFilter}&quot;
            </p>
          )}
        </div>
      </section>

      {/* Host model */}
      <section className="glass mb-5 animate-fade-in rounded-2xl p-5 shadow-panel delay-225 dark:shadow-panel-dark">
        <label className="flex flex-col gap-2">
          <span className="font-sans text-sm font-semibold text-ink dark:text-slate-200">
            Host Model
          </span>
          <p className="font-serif text-xs text-slate-400 dark:text-slate-500">
            The host summarizes each round and guides the discussion.
          </p>
          <select
            value={hostModel}
            onChange={(event) => setConfig({ hostModel: event.target.value })}
            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 font-mono text-sm text-ink focus:border-ember focus:outline-none dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
          >
            <option value="">Select a host from your panelists</option>
            {selectedModels.map((modelId) => (
              <option key={modelId} value={modelId}>
                {modelId}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Error */}
      {formError && (
        <div className="mb-5 animate-fade-in rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800/50 dark:bg-red-900/20">
          <p className="font-sans text-sm text-red-700 dark:text-red-400">{formError}</p>
        </div>
      )}

      {/* Start CTA */}
      <div className="animate-fade-in delay-300">
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart || submitting}
          className="group relative w-full overflow-hidden rounded-2xl bg-ember px-6 py-4 font-sans text-sm font-bold uppercase tracking-[0.15em] text-white shadow-glow transition-all hover:bg-orange-700 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <span className="relative z-10">
            {submitting ? "Starting Session..." : "Launch Roundtable"}
          </span>
        </button>
        <p className="mt-3 text-center font-mono text-[10px] text-slate-400 dark:text-slate-500">
          {selectedModels.length} panelists / {rounds} rounds / {authMode} mode
        </p>
      </div>
    </main>
  );
}

function ModePill({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 font-sans text-sm font-medium transition-all ${
        active
          ? "bg-ember text-white shadow-glow-sm"
          : "border border-slate-200 bg-white text-slatewarm hover:border-ember/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-ember/30"
      }`}
    >
      {label}
    </button>
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error occurred.";
}
