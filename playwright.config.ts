import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const rootDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(rootDir, ".env") });

const skipE2e = process.env.E2E_SKIP === "1";
/** 与开发默认 8788 错开，避免与本机已占用端口冲突 */
const e2eApiPort = process.env.E2E_API_PORT ?? "18790";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  ...(skipE2e
    ? {}
    : {
        webServer: [
          {
            command: "pnpm serve",
            url: `http://127.0.0.1:${e2eApiPort}/healthz`,
            cwd: rootDir,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: { ...process.env, PORT: e2eApiPort },
          },
          {
            command: "pnpm dev:web",
            url: "http://127.0.0.1:5173",
            cwd: rootDir,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: { ...process.env, VITE_API_PORT: e2eApiPort },
          },
        ],
      }),
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
