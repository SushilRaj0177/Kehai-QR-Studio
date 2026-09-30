import { expect, test } from "@playwright/test";
import { decodePng, downloadVia, expectScanState, stubSiteLogos } from "./helpers";

// Runs in the "mobile" project (Pixel 7 viewport, touch).

test.beforeEach(async ({ page }) => {
  await stubSiteLogos(page);
});

test("works on a phone: no sideways scrolling, preview right under the form", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const formBottom = await page.getByLabel("Website URL").evaluate((el) => el.getBoundingClientRect().bottom);
  const previewTop = await page.getByTestId("preview-stage").evaluate((el) => el.getBoundingClientRect().top);
  const designTop = await page.getByRole("heading", { name: "Make it yours" }).evaluate((el) => el.getBoundingClientRect().top);
  expect(previewTop).toBeGreaterThan(formBottom);
  expect(designTop).toBeGreaterThan(previewTop);

  // The preview fits the screen.
  const box = await page.getByTestId("preview-stage").boundingBox();
  expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  const file = decodePng((await downloadVia(page, /Download PNG/)).buffer);
  expect(file.text).toBe("https://gdg.community.dev");
});

test("all type tabs are reachable on a phone", async ({ page }) => {
  await page.goto("/");
  for (const label of ["URL", "Text", "Email", "Phone", "Wi-Fi"]) {
    await expect(page.getByRole("radiogroup", { name: "QR code type" }).getByText(label, { exact: true })).toBeInViewport();
  }
});
