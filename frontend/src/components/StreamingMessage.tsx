import { getModelColor, getModelInitial, getModelShortName } from "../lib/colors";

/**
 * Live streaming message with blinking cursor.
 * Appears at the bottom of the chat panel while a model is generating.
 */
export function StreamingMessage({
  model,
  text,
  allModels
}: {
  model: string;
  text: string;
  allModels: string[];
}): JSX.Element {
  const color = getModelColor(model, allModels);
  const initials = getModelInitial(model);
  const shortName = getModelShortName(model);

  return (
    <div className="flex gap-3 animate-fade-in-fast">
      {/* Pulsing avatar */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color.bg} animate-pulse-glow font-mono text-xs font-bold text-white`}
      >
        {initials}
      </div>

      {/* Streaming body */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className={`font-sans text-sm font-semibold ${color.text}`}>
            {shortName}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-ember">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ember" />
            streaming
          </span>
        </div>
        <div className="rounded-xl rounded-tl-sm border border-ember/20 bg-ember/5 px-3.5 py-2.5 dark:border-ember/15 dark:bg-ember/5">
          <p className="streaming-cursor whitespace-pre-wrap font-serif text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
