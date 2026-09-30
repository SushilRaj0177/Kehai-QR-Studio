import { defineConfig, devices } from "@playwright/test";

// Uses a system Chromium when PLAYWRIGHT_CHROMIUM is set (CI / sandboxes);
// otherwise Playwright's own bundled browser.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined;
const launchOptions = executablePath ? { executablePath } : {};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    acceptDownloads: true,
    launchOptions,
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /screenshots/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive/ },
    { name: "screenshots", testMatch: /screenshots/ },
  ],
});
