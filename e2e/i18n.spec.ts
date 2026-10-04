import { expect, test } from "@playwright/test";
import { decodePng, downloadVia, expectScanState, stubSiteLogos } from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubSiteLogos(page);
});

test("switches to Japanese, keeps working, and remembers the choice", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByTestId("lang-toggle").click();

  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ちゃんと読み取れるQRコードをデザイン。");
  await expect(page.getByRole("heading", { name: "自分らしく仕上げる" })).toBeVisible();
  // Japanese labels use the body font, not the stress-chip layout (regression guard).
  const label = await page.locator(".field__label").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { size: cs.fontSize, margin: cs.marginTop };
  });
  expect(label).toEqual({ size: "12px", margin: "0px" });

  // Validation and scan status are translated too.
  const url = page.getByLabel("ウェブサイトの URL");
  await url.fill("not a url");
  await url.blur();
  await expect(page.getByText("URL にスペースは使えません。")).toBeVisible();
  await url.fill("gdg.community.dev");
  await expectScanState(page, "good");
  await expect(page.getByTestId("scan-status")).toContainText("読み取り確認済み");

  // The QR content itself is never translated.
  const file = decodePng((await downloadVia(page, "png")).buffer);
  expect(file.text).toBe("https://gdg.community.dev");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await page.getByTestId("lang-toggle").click();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
});

test.describe("browser language", () => {
  test.use({ locale: "ja-JP" });
  test("a Japanese browser starts in Japanese", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await expect(page.getByTestId("lang-toggle")).toHaveText("EN");
  });
});

// ダウンロード is about twice as wide as コピー or 保存. In three equal columns it
// broke mid-word and made the action row taller than in English.
test("Japanese action buttons stay on one line, as tall as in English", async ({ page }) => {
  const rowHeight = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll(".actions__row > .download > .btn, .actions__row > .btn")).map((el) => {
        const text = Array.from(el.childNodes).map((n) => n.textContent ?? "").join("").trim();
        const range = document.createRange();
        range.selectNodeContents(el.lastChild ?? el);
        return { text, height: el.getBoundingClientRect().height, lines: range.getClientRects().length };
      }),
    );
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.setItem("kqs.lang", "en"));
    await page.goto("/");
    await page.getByLabel("Website URL").fill("gdg.community.dev");
    const english = await rowHeight();
    await page.getByTestId("lang-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    const japanese = await rowHeight();
    expect(japanese.map((b) => b.text)).toContain("ダウンロード");
    for (const b of japanese) {
      expect(b.lines, `${b.text} at ${width}px`).toBe(1);
      expect(b.height, `${b.text} at ${width}px`).toBe(english[0].height);
    }
  }
});
