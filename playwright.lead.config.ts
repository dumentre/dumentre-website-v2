import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do formulário de lead (lead-site-chatwoot). Config separada da principal para não
 * alterar `playwright.config.ts`. Usa um Chatwoot SIMULADO local (tests/e2e-lead/support):
 * não é integração real. Token abaixo é falso e vale só para este processo de teste.
 */
const PORT = 8800;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SIM_TOKEN = "sim-token-local-only";

export default defineConfig({
  testDir: "./tests/e2e-lead",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
  },
  expect: { timeout: 8_000 },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "node scripts/build-static.js && node tests/e2e-lead/support/server.mjs",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      CHATWOOT_BASE_URL: `${BASE_URL}/__chatwoot__`,
      CHATWOOT_ACCOUNT_ID: "7",
      CHATWOOT_INBOX_ID: "3",
      CHATWOOT_API_TOKEN: SIM_TOKEN,
    },
  },
});
