import { expect, test } from "@playwright/test";
import { expectScanState, stubSiteLogos } from "./helpers";

/**
 * Visual regression: the approved look of the studio, pixel by pixel.
 * Runs in CI inside Playwright's official Docker image, and the baselines
 * are generated in that same image, so font rendering is identical on both
 * sides (different machines draw text slightly differently, e.g. the
 * system font behind "日本語", which would otherwise fail as a fake diff).
 * Check locally (needs Docker):           npm run test:visual:docker
 * Refresh after an approved look change:  npm run test:visual:update
 */
const views = {
  phone: { width: 412, height: 915 },
  desktop: { width: 1440, height: 900 },
} as const;

for (const [name, viewport] of Object.entries(views)) {
  for (const theme of ["dark", "light"] as const) {
    test(`${name} · ${theme}`, async ({ page }) => {
      await stubSiteLogos(page);
      await page.setViewportSize(viewport);
      await page.addInitScript((t) => localStorage.setItem("kqs.theme", t), theme);
      await page.goto("/");
      await page.locator("#url").fill("gdg.community.dev");
      await expectScanState(page, "good");
      await page.waitForTimeout(600); // stress chips + baked glass settle
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      const stops = name === "phone" ? [0, 900, 1800, max] : [0, 700, max];
      for (const [i, y] of stops.entries()) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await page.waitForTimeout(250);
        await expect(page).toHaveScreenshot(`${name}-${theme}-${i}.png`, { animations: "disabled", caret: "hide", maxDiffPixels: 50, threshold: 0.02 });
      }
    });
  }
}
