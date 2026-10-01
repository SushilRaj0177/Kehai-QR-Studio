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
    // Service workers would bypass page.route() stubs; offline.spec.ts opts back in.
    serviceWorkers: "block",
    launchOptions,
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /(screenshots|responsive|visual)/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive/ },
    { name: "screenshots", testMatch: /screenshots/ },
    // Pixel comparison against the approved look (local only, not CI).
    { name: "visual", testMatch: /visual/, use: { deviceScaleFactor: 1, serviceWorkers: "block" } },
  ],
});
