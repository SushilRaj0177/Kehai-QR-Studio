import { test, type Page } from "@playwright/test";
import { expectScanState, makeLogoPng, pickKind, stubSiteLogos } from "./helpers";

/**
 * Generates the README screenshots (docs/screenshots). Run with:
 *   npm run screenshots
 */

const OUT = "docs/screenshots";
test.describe.configure({ mode: "serial" });
test.use({ deviceScaleFactor: 2 });

async function open(page: Page, theme: "dark" | "light", width = 1440, height = 1000, withSiteLogos = false) {
  await page.setViewportSize({ width, height });
  await stubSiteLogos(page, withSiteLogos ? makeLogoPng([34, 226, 245]) : undefined);
  await page.addInitScript((t) => localStorage.setItem("kqs.theme", t), theme);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
}

/** Element captures: keep the sticky bar and toasts from overlapping. */
async function forElementShot(page: Page) {
  await page.addStyleTag({
    content: ".topbar{position:static!important}.toast{display:none!important}.panel--preview{position:static!important}",
  });
}

const LOGO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="22" fill="#831843"/><text x="48" y="66" text-anchor="middle" font-size="56" font-weight="900" fill="#fff1f5" font-family="sans-serif">G</text></svg>',
);

test("desktop — dark", async ({ page }) => {
  await open(page, "dark");
  await page.getByLabel("Website URL").fill("gdg.community.dev/gdg-on-campus-srm");
  await page.getByRole("button", { name: /Torii/ }).click();
  await expectScanState(page, "good");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/desktop-dark.png` });
});

test("desktop — light, Wi-Fi", async ({ page }) => {
  await open(page, "light");
  await pickKind(page, "Wi-Fi");
  await page.getByLabel("Network name (SSID)").fill("GDG-Guest");
  await page.getByLabel("Password").fill("build-with-ai");
  await page.getByRole("button", { name: /Kehai Cyan/ }).click();
  await expectScanState(page, "good");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/desktop-light-wifi.png` });
});

test("logo, gradient and the design panel", async ({ page }) => {
  await open(page, "dark");
  await page.getByLabel("Website URL").fill("kehai-engine-web.vercel.app");
  await page.getByRole("button", { name: /Sakura/ }).click();
  await page.getByTestId("logo-input").setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: LOGO });
  await page.getByLabel("Gradient").check();
  await expectScanState(page, "good");
  await forElementShot(page);
  await page.locator(".panel--preview").screenshot({ path: `${OUT}/logo-gradient.png` });
});

// The design panel is taller than a normal window. Capture it in a window
// tall enough to hold it, so the frosted glass (sized to the window) covers
// the whole panel as it does on screen.
test("design panel (tall window)", async ({ page }) => {
  await open(page, "dark", 1440, 2400);
  await page.getByLabel("Website URL").fill("kehai-engine-web.vercel.app");
  await page.getByRole("button", { name: /Sakura/ }).click();
  await page.getByTestId("logo-input").setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: LOGO });
  await page.getByLabel("Gradient").check();
  await expectScanState(page, "good");
  await forElementShot(page);
  await page.locator(".panel--design").screenshot({ path: `${OUT}/design-panel.png` });
});

test("readability warnings", async ({ page }) => {
  await open(page, "dark");
  await page.getByLabel("Website URL").fill("example.com");
  await page.getByLabel("Code", { exact: true }).fill("#9aa3ad");
  await page.getByLabel("Margin value").fill("1");
  await page.getByLabel("Margin value").blur();
  await page.getByRole("radiogroup", { name: "Module style" }).getByText("Dots", { exact: true }).click();
  await page.getByRole("radiogroup", { name: "Error correction level" }).getByText("L", { exact: true }).click();
  await page.waitForTimeout(600);
  await forElementShot(page);
  await page.locator(".panel--preview").screenshot({ path: `${OUT}/warnings.png` });
});

test("validation errors", async ({ page }) => {
  await open(page, "dark");
  await pickKind(page, "Email");
  await page.getByLabel("To", { exact: true }).fill("technical@gdgsrm");
  await page.getByLabel("To", { exact: true }).blur();
  await forElementShot(page);
  await page.locator(".panel--content").screenshot({ path: `${OUT}/validation.png` });
});

test("recent codes", async ({ page }) => {
  await open(page, "dark");
  const save = () => page.getByRole("button", { name: /^Save$/ }).click();
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  await save();
  await pickKind(page, "Phone");
  await page.getByLabel("Phone number").fill("+91 44 2741 7000");
  await page.getByRole("button", { name: /Sakura/ }).click();
  await expectScanState(page, "good");
  await save();
  await pickKind(page, "Wi-Fi");
  await page.getByLabel("Network name (SSID)").fill("GDG-Guest");
  await page.getByLabel("Password").fill("build-with-ai");
  await page.getByRole("button", { name: /Kehai Cyan/ }).click();
  await expectScanState(page, "good");
  await save();
  await pickKind(page, "Text");
  await page.getByLabel("Text", { exact: true }).fill("See you at the GDG meetup!");
  await page.getByRole("button", { name: /Aizome/ }).click();
  await expectScanState(page, "good");
  await save();
  await forElementShot(page);
  await page.waitForTimeout(400);
  await page.locator(".recent").screenshot({ path: `${OUT}/recent.png` });
});

test("mobile", async ({ page }) => {
  await open(page, "dark", 390, 844);
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await page.getByRole("button", { name: /Torii/ }).click();
  await expectScanState(page, "good");
  await page.screenshot({ path: `${OUT}/mobile-top.png` });
  await page.getByTestId("preview-stage").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -90));
  await page.screenshot({ path: `${OUT}/mobile-preview.png` });
});

test("website logo detected automatically", async ({ page }) => {
  await open(page, "dark", 1440, 1000, true);
  await page.getByLabel("Website URL").fill("kehai-engine-web.vercel.app");
  await page.getByRole("button", { name: /Kehai Cyan/ }).click();
  await page.getByTestId("logo-source").waitFor();
  await expectScanState(page, "good");
  await page.waitForTimeout(3500); // let the toast fade
  await forElementShot(page);
  await page.locator(".panel--preview").screenshot({ path: `${OUT}/site-logo.png` });
  await page.locator(".design-section", { hasText: "Logo" }).last().screenshot({ path: `${OUT}/site-logo-controls.png` });
});
