import type { Phase } from "../types";

const STEPS: { key: Phase; label: string; number: string }[] = [
  { key: "setup", label: "Setup", number: "01" },
  { key: "running", label: "Discussion", number: "02" },
  { key: "voting", label: "Voting", number: "03" },
  { key: "synthesis", label: "Synthesis", number: "04" },
  { key: "complete", label: "Complete", number: "05" }
];

const PHASE_ORDER: Phase[] = ["setup", "running", "voting", "synthesis", "complete"];

function phaseIndex(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

/**
 * Horizontal phase stepper with futuristic numbered steps and connecting lines.
 * Active step pulses with ember glow. Completed steps are filled.
 */
export function PhaseProgress({ currentPhase }: { currentPhase: Phase }): JSX.Element {
  const activeIndex = phaseIndex(currentPhase);

  return (
    <div className="flex w-full items-center justify-between gap-1">
      {STEPS.map((step, index) => {
        const isCompleted = index < activeIndex;
        const isActive = index === activeIndex;
        const isPending = index > activeIndex;

        return (
          <div key={step.key} className="flex flex-1 items-center">
            {/* Step indicator */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full font-mono text-xs font-semibold transition-all duration-500 ${
                  isCompleted
                    ? "bg-ember text-white shadow-glow-sm"
                    : isActive
                      ? "animate-pulse-glow border-2 border-ember bg-ember/10 text-ember dark:bg-ember/20"
                      : "border border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-500"
                }`}
              >
                {isCompleted ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`whitespace-nowrap font-sans text-[10px] font-medium uppercase tracking-wider ${
                  isActive
                    ? "text-ember"
                    : isCompleted
                      ? "text-ember/70"
                      : isPending
                        ? "text-slate-400 dark:text-slate-500"
                        : ""
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting line (not after last step) */}
            {index < STEPS.length - 1 && (
              <div className="mx-2 hidden h-px flex-1 sm:block">
                <div
                  className={`h-full transition-all duration-500 ${
                    index < activeIndex
                      ? "bg-ember"
                      : "bg-slate-200 dark:bg-slate-700"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
