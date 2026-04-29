import { defineConfig } from "@playwright/test";

const PLAYWRIGHT_PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    // Use the built app when available, otherwise fall back to dev mode for targeted local runs.
    command: "node scripts/playwright-web-server.mjs",
    url: `http://127.0.0.1:${PLAYWRIGHT_PORT}`,
    reuseExistingServer: process.env.CI ? false : true
  },
  use: {
    baseURL: `http://127.0.0.1:${PLAYWRIGHT_PORT}`
  }
});
