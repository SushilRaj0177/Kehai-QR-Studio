import { expect, test } from "@playwright/test";
import { decodePng, downloadVia, expectScanState, makeLogoPng, stubSiteLogos } from "./helpers";

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

test("a website logo with a long domain doesn't push the layout sideways", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 }); // a common small Android width
  await stubSiteLogos(page, makeLogoPng());
  await page.goto("/");
  await page.getByLabel("Website URL").fill("kotoba-connect-three-engine-web.vercel.app");
  await expect(page.getByTestId("logo-source")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // The design panel's own content fits inside it (presets, sliders, buttons).
  const spill = await page.locator(".panel--design").evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(spill).toBeLessThanOrEqual(0);
  // Both buttons stay inside the design panel.
  const panel = await page.locator(".panel--design").boundingBox();
  for (const name of ["Replace", "Remove"]) {
    const b = await page.getByRole("button", { name }).boundingBox();
    expect(b!.x + b!.width).toBeLessThanOrEqual(panel!.x + panel!.width);
  }
});

test("Japanese fits a small phone too", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await stubSiteLogos(page, makeLogoPng());
  await page.goto("/");
  await page.getByTestId("lang-toggle").click();
  await page.getByLabel("ウェブサイトの URL").fill("kotoba-connect-three-engine-web.vercel.app");
  await expect(page.getByTestId("logo-source")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const sel of [".panel--content", ".panel--design", ".panel--preview", ".topbar"]) {
    const spill = await page.locator(sel).evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(spill, sel).toBeLessThanOrEqual(0);
  }
});
