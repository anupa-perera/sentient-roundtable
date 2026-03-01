/**
 * Dark/light mode toggle with sun and moon SVG icons.
 * Animated transition between states.
 */
export function ThemeToggle({
  theme,
  onToggle
}: {
  theme: string;
  onToggle: () => void;
}): JSX.Element {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="group relative flex h-8 w-16 items-center rounded-full border border-slate-300 bg-slate-100 p-1 transition-all dark:border-slate-600 dark:bg-slate-800"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-all duration-300 dark:bg-slate-600 ${
          isDark ? "translate-x-8" : "translate-x-0"
        }`}
      >
        {isDark ? (
          <svg
            className="h-3.5 w-3.5 text-amber-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg
            className="h-3.5 w-3.5 text-amber-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </span>
    </button>
  );
}
