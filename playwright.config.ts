import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production build (vite preview, same headers as Vercel).
 *   npm run build && npm run test:e2e
 * Locally the installed Chrome is used; in CI the Playwright Chromium. WebGL runs on SwiftShader.
 */
const GL = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const channel = process.env.CI ? undefined : "chrome";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  // WebGL runs in software here, so few browsers at once keep timings honest
  workers: process.env.CI ? 1 : 2,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4174",
    trace: "retain-on-failure",
    // first visits would show the intro splash and the Ask Astra nudge
    storageState: { cookies: [], origins: [{ origin: "http://localhost:4174", localStorage: [{ name: "sa-nudged", value: "1" }] }] },
  },
  projects: [
    { name: "desktop", testIgnore: /no-webgl/, use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 820 }, channel, launchOptions: { args: GL } } },
    { name: "phone", testMatch: /journey|a11y/, use: { ...devices["Pixel 7"], channel, launchOptions: { args: GL } } },
    { name: "no-webgl", testMatch: /no-webgl/, use: { ...devices["Desktop Chrome"], channel, launchOptions: { args: ["--disable-gpu", "--disable-software-rasterizer", "--disable-webgl", "--disable-3d-apis"] } } },
  ],
  webServer: {
    command: "npx vite preview --port 4174 --strictPort",
    url: "http://localhost:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
