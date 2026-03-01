import { getModelColor, getModelShortName } from "../lib/colors";

/**
 * Horizontal bar chart showing a model's vote score (out of 10).
 * Includes model name, visual bar, score, and reason text.
 */
export function VoteBar({
  model,
  score,
  reason,
  allModels
}: {
  model: string;
  score: number;
  reason: string;
  allModels: string[];
}): JSX.Element {
  const color = getModelColor(model, allModels);
  const shortName = getModelShortName(model);
  const percentage = Math.min(Math.max((score / 10) * 100, 0), 100);

  return (
    <div className="animate-fade-in space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={`font-sans text-xs font-semibold ${color.text}`}>
          {shortName}
        </span>
        <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
          {score}/10
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/50">
        <div
          className={`h-full rounded-full ${color.bg} transition-all duration-700 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="font-serif text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {reason}
      </p>
    </div>
  );
}
