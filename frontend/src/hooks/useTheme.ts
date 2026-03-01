import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Manages dark/light theme with localStorage persistence.
 * Defaults to dark for the futuristic aesthetic.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("sr-theme") as Theme | null;
    if (stored === "light" || stored === "dark") return stored;
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("sr-theme", theme);
  }, [theme]);

  const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return { theme, toggle, isDark: theme === "dark" } as const;
}
