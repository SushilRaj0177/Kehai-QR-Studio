import { expect, test } from "@playwright/test";
import { decodePng, downloadVia, expectScanState } from "./helpers";

test.use({ serviceWorkers: "allow" });

test("works offline after one visit", async ({ page, context }) => {
  await page.goto("/");
  // Wait until the service worker controls the page, then load once more so
  // every asset (including the lazily loaded decoder) passes through it.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener("controllerchange", r, { once: true }));
    }
  });
  await page.reload();
  await page.getByLabel("Website URL").fill("example.com");
  await expectScanState(page, "good");

  await context.setOffline(true);
  await page.reload();
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  const file = decodePng((await downloadVia(page, /Download PNG/)).buffer);
  expect(file.text).toBe("https://gdg.community.dev");
});
