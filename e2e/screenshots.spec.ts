import { test, type Page } from "@playwright/test";
import { expectScanState, makeLogoPng, stubSiteLogos } from "./helpers";
import { JA } from "../src/i18n/ja";

/**
 * Generates the README screenshots: English into docs/screenshots (README.md),
 * Japanese into docs/screenshots/ja (README.ja.md), with the interface
 * switched to 日本語. Run with:
 *   npm run screenshots
 * One language only:  npm run screenshots -- --grep "^ja ·"
 */

test.describe.configure({ mode: "serial" });
test.use({ deviceScaleFactor: 2 });

type Lang = "en" | "ja";
const OUT_DIR: Record<Lang, string> = { en: "docs/screenshots", ja: "docs/screenshots/ja" };

/** The interface text for a given English string, as the app shows it in `lang`. */
function ui(lang: Lang, english: string, vars: Record<string, string> = {}): string {
  let text = lang === "ja" ? (JA[english] ?? english) : english;
  for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
  return text;
}

async function open(page: Page, lang: Lang, theme: "dark" | "light", width = 1440, height = 1000, withSiteLogos = false) {
  await page.setViewportSize({ width, height });
  await stubSiteLogos(page, withSiteLogos ? makeLogoPng([34, 226, 245]) : undefined);
  await page.addInitScript(([t, l]) => {
    localStorage.setItem("kqs.theme", t);
    localStorage.setItem("kqs.lang", l);
  }, [theme, lang]);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
}

async function pickKind(page: Page, lang: Lang, label: string) {
  await page.getByRole("radiogroup", { name: ui(lang, "QR code type") }).getByText(ui(lang, label), { exact: true }).click();
}

/** Element captures: keep the sticky bar and toasts from overlapping. */
async function forElementShot(page: Page) {
  await page.addStyleTag({
    content: ".topbar{position:static!important}.toast{display:none!important}.panel.panel--preview{position:relative!important;top:auto!important}",
  });
}

const LOGO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="22" fill="#831843"/><text x="48" y="66" text-anchor="middle" font-size="56" font-weight="900" fill="#fff1f5" font-family="sans-serif">G</text></svg>',
);

for (const lang of ["en", "ja"] as const) {
  const OUT = OUT_DIR[lang];

  test(`${lang} · desktop — dark`, async ({ page }) => {
    await open(page, lang, "dark");
    await page.getByLabel(ui(lang, "Website URL")).fill("gdg.community.dev/gdg-on-campus-srm");
    await page.getByRole("button", { name: new RegExp(ui(lang, "Torii")) }).click();
    await expectScanState(page, "good");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/desktop-dark.png` });
  });

  test(`${lang} · desktop — light, Wi-Fi`, async ({ page }) => {
    await open(page, lang, "light");
    await pickKind(page, lang, "Wi-Fi");
    await page.getByLabel(ui(lang, "Network name (SSID)")).fill("GDG-Guest");
    await page.getByLabel(ui(lang, "Password")).fill("build-with-ai");
    await page.getByRole("button", { name: new RegExp(ui(lang, "Kehai Cyan")) }).click();
    await expectScanState(page, "good");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/desktop-light-wifi.png` });
  });

  test(`${lang} · logo, gradient and the design panel`, async ({ page }) => {
    await open(page, lang, "dark");
    await page.getByLabel(ui(lang, "Website URL")).fill("kehai-engine-web.vercel.app");
    await page.getByRole("button", { name: new RegExp(ui(lang, "Sakura")) }).click();
    await page.getByTestId("logo-input").setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: LOGO });
    await page.getByLabel(ui(lang, "Gradient")).check();
    await expectScanState(page, "good");
    await forElementShot(page);
    await page.locator(".panel--preview").screenshot({ path: `${OUT}/logo-gradient.png` });
  });

  // The design panel is taller than a normal window. Capture it in a window
  // tall enough to hold it, so the frosted glass (sized to the window) covers
  // the whole panel as it does on screen.
  test(`${lang} · design panel (tall window)`, async ({ page }) => {
    await open(page, lang, "dark", 1440, 2400);
    await page.getByLabel(ui(lang, "Website URL")).fill("kehai-engine-web.vercel.app");
    await page.getByRole("button", { name: new RegExp(ui(lang, "Sakura")) }).click();
    await page.getByTestId("logo-input").setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: LOGO });
    await page.getByLabel(ui(lang, "Gradient")).check();
    await expectScanState(page, "good");
    await forElementShot(page);
    await page.locator(".panel--design").screenshot({ path: `${OUT}/design-panel.png` });
  });

  test(`${lang} · readability warnings`, async ({ page }) => {
    await open(page, lang, "dark");
    await page.getByLabel(ui(lang, "Website URL")).fill("example.com");
    await page.getByLabel(ui(lang, "Code"), { exact: true }).fill("#9aa3ad");
    await page.getByLabel(ui(lang, "{label} value", { label: ui(lang, "Margin") })).fill("1");
    await page.getByLabel(ui(lang, "{label} value", { label: ui(lang, "Margin") })).blur();
    await page.getByRole("radiogroup", { name: ui(lang, "Module style") }).getByText(ui(lang, "Dots"), { exact: true }).click();
    await page.getByRole("radiogroup", { name: ui(lang, "Error correction level") }).getByText("L", { exact: true }).click();
    await page.waitForTimeout(600);
    await forElementShot(page);
    await page.locator(".panel--preview").screenshot({ path: `${OUT}/warnings.png` });
  });

  test(`${lang} · validation errors`, async ({ page }) => {
    await open(page, lang, "dark");
    await pickKind(page, lang, "Email");
    await page.getByLabel(ui(lang, "To"), { exact: true }).fill("technical@gdgsrm");
    await page.getByLabel(ui(lang, "To"), { exact: true }).blur();
    await forElementShot(page);
    await page.locator(".panel--content").screenshot({ path: `${OUT}/validation.png` });
  });

  test(`${lang} · recent codes`, async ({ page }) => {
    await open(page, lang, "dark");
    const save = () => page.getByRole("button", { name: new RegExp(`^${ui(lang, "Save")}$`) }).click();
    await page.getByLabel(ui(lang, "Website URL")).fill("gdg.community.dev");
    await expectScanState(page, "good");
    await save();
    await pickKind(page, lang, "Phone");
    await page.getByLabel(ui(lang, "Phone number")).fill("+91 44 2741 7000");
    await page.getByRole("button", { name: new RegExp(ui(lang, "Sakura")) }).click();
    await expectScanState(page, "good");
    await save();
    await pickKind(page, lang, "Wi-Fi");
    await page.getByLabel(ui(lang, "Network name (SSID)")).fill("GDG-Guest");
    await page.getByLabel(ui(lang, "Password")).fill("build-with-ai");
    await page.getByRole("button", { name: new RegExp(ui(lang, "Kehai Cyan")) }).click();
    await expectScanState(page, "good");
    await save();
    await pickKind(page, lang, "Text");
    await page.getByLabel(ui(lang, "Text"), { exact: true }).fill(lang === "ja" ? "GDG のミートアップで会いましょう！" : "See you at the GDG meetup!");
    await page.getByRole("button", { name: new RegExp(ui(lang, "Aizome")) }).click();
    await expectScanState(page, "good");
    await save();
    await forElementShot(page);
    await page.waitForTimeout(400);
    await page.locator(".recent").screenshot({ path: `${OUT}/recent.png` });
  });

  test(`${lang} · mobile`, async ({ page }) => {
    await open(page, lang, "dark", 390, 844);
    await page.getByLabel(ui(lang, "Website URL")).fill("gdg.community.dev");
    await page.getByRole("button", { name: new RegExp(ui(lang, "Torii")) }).click();
    await expectScanState(page, "good");
    await page.screenshot({ path: `${OUT}/mobile-top.png` });
    await page.getByTestId("preview-stage").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -90));
    await page.screenshot({ path: `${OUT}/mobile-preview.png` });
  });

  test(`${lang} · website logo detected automatically`, async ({ page }) => {
    await open(page, lang, "dark", 1440, 1000, true);
    await page.getByLabel(ui(lang, "Website URL")).fill("kehai-engine-web.vercel.app");
    await page.getByRole("button", { name: new RegExp(ui(lang, "Kehai Cyan")) }).click();
    await page.getByTestId("logo-source").waitFor();
    await expectScanState(page, "good");
    await page.waitForTimeout(3500); // let the toast fade
    await forElementShot(page);
    await page.locator(".panel--preview").screenshot({ path: `${OUT}/site-logo.png` });
    await page.locator(".design-section", { hasText: ui(lang, "Logo") }).last().screenshot({ path: `${OUT}/site-logo-controls.png` });
  });
}

// Guard: a capture that came out blank (e.g. something painted over the
// panel) must fail loudly instead of quietly landing in the README.
test("no screenshot is blank", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { PNG } = await import("pngjs");
  const files = Object.values(OUT_DIR).flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => `${dir}/${f}`));
  for (const file of files) {
    const { data } = PNG.sync.read(readFileSync(file));
    let sum = 0;
    let sq = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 16) {
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += l;
      sq += l * l;
      n++;
    }
    const stddev = Math.sqrt(sq / n - (sum / n) ** 2);
    if (stddev < 5) throw new Error(`${file} looks blank (luminance stddev ${stddev.toFixed(1)})`);
  }
});
