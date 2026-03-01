import type { ModelCatalogEntry } from "../types";

/**
 * Futuristic selectable card for model panel selection.
 * Glows with ember accent when selected. Shows model name, ID, and free/paid status.
 */
export function ModelCard({
  model,
  selected,
  onToggle,
  showPaidBadge
}: {
  model: ModelCatalogEntry;
  selected: boolean;
  onToggle: () => void;
  showPaidBadge: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group relative flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
        selected
          ? "border-ember/40 bg-ember/5 shadow-glow-sm dark:border-ember/30 dark:bg-ember/10"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700/50 dark:bg-slate-800/60 dark:hover:border-slate-600"
      }`}
    >
      {/* Custom checkbox */}
      <div
        className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-all ${
          selected
            ? "border-ember bg-ember text-white"
            : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700"
        }`}
      >
        {selected && (
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Model info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-sans text-sm font-semibold text-ink dark:text-slate-200">
            {model.name}
          </span>
          {showPaidBadge && !model.is_free && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              paid
            </span>
          )}
        </div>
        <span className="block truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
          {model.id}
        </span>
      </div>
    </button>
  );
}
