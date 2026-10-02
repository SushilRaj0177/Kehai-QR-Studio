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

  const file = decodePng((await downloadVia(page, "png")).buffer);
  expect(file.text).toBe("https://gdg.community.dev");
});

test("all type tabs are reachable on a phone", async ({ page }) => {
  await page.goto("/");
  for (const label of ["URL", "Text", "Email", "Phone", "Wi-Fi", "Contact"]) {
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

test("the colour picker works by touch on a phone", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  await page.getByTestId("fg-swatch").tap();
  const sv = page.getByTestId("fg-sv");
  await sv.scrollIntoViewIfNeeded();
  const box = (await sv.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height * 0.25);
  await expect(page.locator("#fg-hex")).not.toHaveValue("#0a0e14");
  // The picker stays where the finger is (no jump), and the page didn't scroll it away.
  const after = (await sv.boundingBox())!;
  expect(Math.abs(after.y - box.y)).toBeLessThan(4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

// ---------------------------------------------------------------- touch sliders

/** A real finger gesture through Chromium's input pipeline (page scrolling included). */
async function touchPath(page: import("@playwright/test").Page, points: [number, number][], holdMs = 0) {
  const cdp = await page.context().newCDPSession(page);
  const pt = ([x, y]: [number, number]) => [{ x: Math.round(x), y: Math.round(y) }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(points[0]) });
  if (holdMs) await page.waitForTimeout(holdMs);
  for (const p of points.slice(1)) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(p) });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(250);
}
const line = (from: [number, number], to: [number, number], steps = 12): [number, number][] =>
  Array.from({ length: steps + 1 }, (_, i) => [from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps]);

test("sliders: scrolling past one never changes it; a sideways drag or a tap does", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  const size = page.getByLabel("Size value");
  const slider = page.locator("#size");
  await slider.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200)); // slider mid-screen
  let box = (await slider.boundingBox())!;
  const mid: [number, number] = [box.x + box.width / 2, box.y + box.height / 2];

  // 1. Swipe up starting on the slider: the page scrolls, the size stays.
  const before = await page.evaluate(() => window.scrollY);
  await touchPath(page, line(mid, [mid[0] + 6, mid[1] - 260]));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
  await expect(size).toHaveValue("320");

  // 2. Sideways drag: the size changes, relative to where it was. (Let the
  //    swipe's momentum scroll settle first: a touch during it just stops it.)
  await expect.poll(async () => { const y0 = await page.evaluate(() => scrollY); await page.waitForTimeout(150); return (await page.evaluate(() => scrollY)) - y0; }).toBe(0);
  await slider.scrollIntoViewIfNeeded(); // the swipe scrolled it off screen
  await page.waitForTimeout(200);
  box = (await slider.boundingBox())!;
  const start: [number, number] = [box.x + box.width / 2, box.y + box.height / 2];
  await touchPath(page, line(start, [start[0] + 80, start[1] + 4]));
  const dragged = Number(await size.inputValue());
  expect(dragged).toBeGreaterThan(320);

  // 3. A clean tap near the left end sets a small size.
  box = (await slider.boundingBox())!;
  await touchPath(page, [[box.x + 12, box.y + box.height / 2]]);
  expect(Number(await size.inputValue())).toBeLessThan(200);
  await expectScanState(page, "good");
});

test("colour square: a swipe scrolls the page; press-and-hold grabs it", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  await page.getByTestId("fg-swatch").tap();
  const sv = page.getByTestId("fg-sv");
  await sv.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 150));
  const hex = page.locator("#fg-hex");
  let box = (await sv.boundingBox())!;
  const mid: [number, number] = [box.x + box.width / 2, box.y + box.height / 2];

  const before = await page.evaluate(() => window.scrollY);
  await touchPath(page, line(mid, [mid[0] - 10, mid[1] - 200]));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 80);
  await expect(hex).toHaveValue("#0a0e14");

  box = (await sv.boundingBox())!;
  const p: [number, number] = [box.x + box.width * 0.8, box.y + box.height * 0.3];
  await touchPath(page, line(p, [p[0] - 20, p[1] + 30], 6), 350);
  await expect(hex).not.toHaveValue("#0a0e14");
});

test("colour square: the circle can be dragged straight away, in any direction", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  await page.getByTestId("fg-swatch").tap();
  const sv = page.getByTestId("fg-sv");
  await sv.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const hex = page.locator("#fg-hex");
  const thumb = (await sv.locator(".color-picker__thumb").boundingBox())!;
  const start: [number, number] = [thumb.x + thumb.width / 2, thumb.y + thumb.height / 2];
  const scroll0 = await page.evaluate(() => scrollY);

  // Straight up from the circle, no hold: brighter, and the page doesn't scroll.
  await touchPath(page, line(start, [start[0], start[1] - 90], 8));
  await expect(hex).not.toHaveValue("#0a0e14");
  expect(await page.evaluate(() => scrollY)).toBe(scroll0);
  const after = (await sv.locator(".color-picker__thumb").boundingBox())!;
  expect(after.y).toBeLessThan(thumb.y - 60); // the circle followed the finger
});

// ---------------------------------------------------------------- copy on phones

const SAMSUNG_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36";

test.describe("Samsung Internet", () => {
  test.use({ userAgent: SAMSUNG_UA });

  test("Copy points to the long-press image menu, which holds the exact PNG", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __writes: number }).__writes = 0;
      navigator.clipboard.write = async () => {
        (window as unknown as { __writes: number }).__writes++;
      };
    });
    await page.goto("/");
    await page.getByLabel("Website URL").fill("gdg.community.dev");
    await expectScanState(page, "good");
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByTestId("toast")).toContainText("Long-press the QR code");
    await expect(page.getByTestId("preview-stage")).toHaveClass(/is-highlighted/);
    // The clipboard API is never trusted here.
    expect(await page.evaluate(() => (window as unknown as { __writes: number }).__writes)).toBe(0);

    // The long-press target is the exact downloadable PNG, sitting over the code.
    const img = page.getByTestId("longpress-image");
    await expect(img).toBeVisible();
    const bytes = await img.evaluate(async (el: HTMLImageElement) => Array.from(new Uint8Array(await (await fetch(el.src)).arrayBuffer())));
    expect(decodePng(Buffer.from(bytes)).text).toBe("https://gdg.community.dev");
    const [stage, box] = await Promise.all([page.getByTestId("preview-stage").boundingBox(), img.boundingBox()]);
    expect(box!.width).toBeGreaterThan(stage!.width * 0.8);
  });
});

test("a clipboard that never answers still falls back to the share menu (with ?debug details)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: number };
    w.__shared = 0;
    navigator.clipboard.write = () => new Promise<void>(() => {}); // hangs forever
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => void w.__shared++ });
  });
  await page.goto("/?debug");
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByTestId("toast")).toContainText("share menu opened", { timeout: 8000 });
  await expect(page.getByTestId("toast")).toContainText("TimeoutError");
  expect(await page.evaluate(() => (window as unknown as { __shared: number }).__shared)).toBe(1);
});
