import { Link, Navigate, Route, Routes } from "react-router-dom";

import { ThemeToggle } from "./components/ThemeToggle";
import { useTheme } from "./hooks/useTheme";
import { HowItWorksPage } from "./pages/HowItWorksPage";
import { SessionPage } from "./pages/SessionPage";
import { SetupPage } from "./pages/SetupPage";

/**
 * Root app shell with futuristic navbar and theme toggle.
 */
export default function App(): JSX.Element {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 bg-grain text-slate-100 dark:bg-slate-950 dark:bg-grain-dark dark:text-slate-100">
      {/* Dot grid overlay in dark mode */}
      <div className="pointer-events-none fixed inset-0 bg-dots opacity-0 dark:opacity-100" />

      <nav className="glass sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember font-mono text-xs font-bold text-white shadow-glow-sm">
              SR
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-sm font-bold uppercase tracking-[0.14em] text-ink dark:text-slate-100">
                Sentient Roundtable
              </span>
              <span className="hidden font-mono text-[9px] text-slatewarm dark:text-slate-500 sm:block">
                multi-agent deliberation
              </span>
            </div>
          </Link>

          {/* Nav actions */}
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="font-sans text-sm font-medium text-slatewarm transition-colors hover:text-ember dark:text-slate-400 dark:hover:text-ember"
            >
              Ask US
            </Link>
            <Link
              to="/how-it-works"
              className="font-sans text-sm font-medium text-slatewarm transition-colors hover:text-ember dark:text-slate-400 dark:hover:text-ember"
            >
              How It Works
            </Link>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <ThemeToggle theme={theme} onToggle={toggle} />
          </div>
        </div>
      </nav>

      <div className="relative flex-1">
        <Routes>
          <Route path="/" element={<SetupPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/session/:sessionId" element={<SessionPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <footer className="glass border-t border-slate-200/40 px-4 py-3 text-center dark:border-slate-700/40">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-slatewarm dark:text-slate-400">
          Proof of Concept by Anupa Perera
        </p>
      </footer>
    </div>
  );
}
