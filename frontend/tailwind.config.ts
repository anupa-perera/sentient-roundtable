import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "Segoe UI", "sans-serif"],
        serif: ["Source Serif 4", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"]
      },
      colors: {
        ink: "#0f172a",
        ember: {
          DEFAULT: "#c2410c",
          light: "#fff7ed",
          dark: "#9a3412"
        },
        wheat: "#f8f4e8",
        slatewarm: "#334155"
      },
      boxShadow: {
        panel: "0 14px 40px rgba(15, 23, 42, 0.12)",
        "panel-dark": "0 14px 40px rgba(0, 0, 0, 0.4)",
        glow: "0 0 20px rgba(194, 65, 12, 0.3)",
        "glow-lg": "0 0 40px rgba(194, 65, 12, 0.4)",
        "glow-sm": "0 0 10px rgba(194, 65, 12, 0.2)"
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at 20% 20%, rgba(194,65,12,0.06), transparent 45%), radial-gradient(circle at 80% 30%, rgba(194,65,12,0.04), transparent 40%)",
        "grain-dark":
          "radial-gradient(circle at 20% 20%, rgba(194,65,12,0.06), transparent 45%), radial-gradient(circle at 80% 30%, rgba(194,65,12,0.04), transparent 40%)"
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in-fast": {
          from: { opacity: "0" },
          to: { opacity: "1" }
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" }
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(194, 65, 12, 0.2)" },
          "50%": { boxShadow: "0 0 24px rgba(194, 65, 12, 0.5)" }
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "fade-in-fast": "fade-in-fast 0.2s ease-out both",
        blink: "blink 1s step-end infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-in-right": "slide-in-right 0.3s ease-out both"
      }
    }
  },
  plugins: []
} satisfies Config;
