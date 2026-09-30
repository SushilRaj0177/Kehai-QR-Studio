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

  // Validation and scan status are translated too.
  const url = page.getByLabel("ウェブサイトの URL");
  await url.fill("not a url");
  await url.blur();
  await expect(page.getByText("URL にスペースは使えません。")).toBeVisible();
  await url.fill("gdg.community.dev");
  await expectScanState(page, "good");
  await expect(page.getByTestId("scan-status")).toContainText("読み取り確認済み");

  // The QR content itself is never translated.
  const file = decodePng((await downloadVia(page, /PNG をダウンロード/)).buffer);
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
