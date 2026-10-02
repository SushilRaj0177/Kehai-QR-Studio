import { expect, test, type Page } from "@playwright/test";
import { decodePng, downloadVia, expectScanState, makeLogoPng, pickKind, stubSiteLogos } from "./helpers";

const RED = makeLogoPng([255, 45, 85]);
const CYAN = makeLogoPng([34, 226, 245]);

const logoSource = (page: Page) => page.getByTestId("logo-source");
const ecLevel = (page: Page, level: string) => page.getByText(new RegExp(`level ${level}`));

test("a link's website logo is added to the centre automatically", async ({ page }) => {
  const requests = await stubSiteLogos(page, RED);
  await page.goto("/");
  await page.getByLabel("Website URL").fill("gdg.community.dev/gdg-on-campus-srm");

  await expect(logoSource(page)).toHaveText("Found for gdg.community.dev");
  await expect(page.getByTestId("toast")).toContainText("Added gdg.community.dev's logo");
  await expect(ecLevel(page, "H")).toBeVisible(); // raised from M to make room
  await expectScanState(page, "good");

  // Only the domain is sent to the favicon service — never the path.
  expect(requests.length).toBeGreaterThan(0);
  for (const r of requests) expect(r).not.toContain("gdg-on-campus-srm");

  // The logo is really in the image, and the code still decodes.
  const file = decodePng((await downloadVia(page, "png")).buffer);
  expect(file.text).toBe("https://gdg.community.dev/gdg-on-campus-srm");
  const mid = (Math.floor(file.height / 2) * file.width + Math.floor(file.width / 2)) * 4;
  expect([...file.data.subarray(mid, mid + 3)]).toEqual([255, 45, 85]);
});

test("the site logo can be removed, restored and replaced", async ({ page }) => {
  await stubSiteLogos(page, RED);
  await page.goto("/");
  await page.getByLabel("Website URL").fill("github.com");
  await expect(logoSource(page)).toBeVisible();

  // Remove: it stays gone, even while editing the same site's URL.
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByAltText("Current logo")).toHaveCount(0);
  await expect(page.getByTestId("site-logo-status")).toContainText("github.com's logo removed");
  await page.getByLabel("Website URL").fill("github.com/SushilRaj0177");
  await page.waitForTimeout(1200);
  await expect(page.getByAltText("Current logo")).toHaveCount(0);

  // Undo.
  await page.getByRole("button", { name: "Use it again" }).click();
  await expect(logoSource(page)).toHaveText("Found for github.com");

  // Replace with an upload: the user's logo wins, even for a new site.
  await page.getByTestId("logo-input").setInputFiles({ name: "mine.png", mimeType: "image/png", buffer: CYAN });
  await expect(page.getByText("Your logo")).toBeVisible();
  await page.getByLabel("Website URL").fill("kehai-engine-web.vercel.app");
  await page.waitForTimeout(1200);
  await expect(page.getByText("Your logo")).toBeVisible();
  await expect(logoSource(page)).toHaveCount(0);
  await expectScanState(page, "good");
});

test("changing site or QR type swaps or clears the site logo", async ({ page }) => {
  await stubSiteLogos(page, (url) => (url.includes("github.com") ? RED : url.includes("example.com") ? CYAN : null));
  await page.goto("/");
  await page.getByLabel("Website URL").fill("github.com");
  await expect(logoSource(page)).toHaveText("Found for github.com");

  await page.getByLabel("Website URL").fill("example.com");
  await expect(logoSource(page)).toHaveText("Found for example.com");

  await pickKind(page, "Wi-Fi");
  await expect(page.getByAltText("Current logo")).toHaveCount(0);
});

test("when no logo can be found, the code is generated without one", async ({ page }) => {
  await stubSiteLogos(page); // every service 404s
  await page.goto("/");
  await page.getByLabel("Website URL").fill("tiny-unknown-site.dev");
  await expect(page.getByTestId("site-logo-status")).toContainText("No usable logo found for tiny-unknown-site.dev");
  await expect(page.getByAltText("Current logo")).toHaveCount(0);
  await expect(ecLevel(page, "M")).toBeVisible();
  await expectScanState(page, "good");
});

test("tiny favicons are ignored rather than blown up blurry", async ({ page }) => {
  // A 16×16 icon: too small to look good in the centre.
  const { PNG } = await import("pngjs");
  const small = new PNG({ width: 16, height: 16 });
  small.data.fill(200);
  await stubSiteLogos(page, PNG.sync.write(small));
  await page.goto("/");
  await page.getByLabel("Website URL").fill("github.com");
  await expect(page.getByTestId("site-logo-status")).toContainText("No usable logo found");
});

test("the automatic logo can be switched off, and that is remembered", async ({ page }) => {
  const requests = await stubSiteLogos(page, RED);
  await page.goto("/");
  await page.getByLabel("Website URL").fill("github.com");
  await expect(logoSource(page)).toBeVisible();

  const toggle = page.getByLabel("Use the website's logo for links automatically");
  await toggle.uncheck();
  await expect(page.getByAltText("Current logo")).toHaveCount(0);

  await page.reload();
  await expect(toggle).not.toBeChecked();
  const before = requests.length;
  await page.getByLabel("Website URL").fill("example.com");
  await page.waitForTimeout(1200);
  expect(requests.length).toBe(before); // no lookup at all
  await expect(page.getByAltText("Current logo")).toHaveCount(0);
});
