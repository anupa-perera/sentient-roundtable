import { getModelColor, getModelInitial, getModelShortName } from "../lib/colors";

/**
 * Chat bubble for a completed model turn in the discussion timeline.
 * Shows avatar with model color, short name, round badge, and response text.
 */
export function ChatMessage({
  model,
  round,
  response,
  allModels
}: {
  model: string;
  round: number;
  response: string;
  allModels: string[];
}): JSX.Element {
  const color = getModelColor(model, allModels);
  const initials = getModelInitial(model);
  const shortName = getModelShortName(model);

  return (
    <div className="group flex gap-3 animate-fade-in">
      {/* Avatar */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color.bg} font-mono text-xs font-bold text-white shadow-sm`}
      >
        {initials}
      </div>

      {/* Message body */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className={`font-sans text-sm font-semibold ${color.text}`}>
            {shortName}
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
            R{round}
          </span>
        </div>
        <div className="rounded-xl rounded-tl-sm border border-slate-200 bg-white px-3.5 py-2.5 dark:border-slate-700/50 dark:bg-slate-800/80">
          <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {response}
          </p>
        </div>
      </div>
    </div>
  );
}
