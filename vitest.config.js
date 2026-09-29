import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// One project per test layer. `npm test` runs them all; `npm run test:<name>`
// runs one. Database suites skip themselves unless TEST_DATABASE_URL is set.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/utils/**", "src/components/thirteen/**", "server/game/**", "server/*.js"],
      exclude: ["src/utils/SoundManager.js", "src/utils/socket.js"],
    },
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.js", "tests/integration/**/*.test.js"],
        },
      },
      {
        test: {
          name: "server",
          environment: "node",
          include: ["server/tests/**/*.test.js"],
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
      {
        plugins: [react()],
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["tests/ui/**/*.test.{js,jsx}"],
          setupFiles: ["tests/ui/setup.js"],
        },
      },
    ],
  },
});
