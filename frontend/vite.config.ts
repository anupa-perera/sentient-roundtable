import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vite configuration for SPA frontend and unit testing.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts"
  }
});
