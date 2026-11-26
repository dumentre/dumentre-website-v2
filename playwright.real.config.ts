import { defineConfig, devices } from "@playwright/test";

/**
 * E2E com Chatwoot REAL (conta 2, caixa 3), so para validacao controlada.
 * O token NUNCA fica no repo: vem do ambiente (CW_TOKEN), injetado por
 * scripts/run-e2e-real.py a partir do cofre. Contatos de teste usam e-mail teste+...
 * e a conversa recebe a etiqueta lead-site-teste.
 */
const PORT = 8801;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e-real",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: BASE_URL, actionTimeout: 15_000 },
  expect: { timeout: 20_000 },
  projects: [{ name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/build-static.js && node tests/e2e-lead/support/server.mjs",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      CHATWOOT_BASE_URL: process.env.CW_BASE_URL ?? "",
      CHATWOOT_ACCOUNT_ID: process.env.CW_ACCOUNT ?? "2",
      CHATWOOT_INBOX_ID: process.env.CW_INBOX ?? "3",
      CHATWOOT_API_TOKEN: process.env.CW_TOKEN ?? "",
    },
  },
});
