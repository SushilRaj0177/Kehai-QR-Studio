import { expect, test, type Page } from "@playwright/test";
import { decodePng, expectScanState, stubSiteLogos } from "./helpers";

/** Pretend to be a phone browser with Web Share; record what gets shared. */
async function fakeWebShare(page: Page, opts: { rejectClipboard: boolean }) {
  await page.addInitScript(({ rejectClipboard }) => {
    const w = window as unknown as { __shared: { name: string; type: string; bytes: number[] }[] };
    w.__shared = [];
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        for (const f of data.files ?? []) {
          w.__shared.push({ name: f.name, type: f.type, bytes: Array.from(new Uint8Array(await f.arrayBuffer())) });
        }
      },
    });
    if (rejectClipboard) {
      // What stricter mobile browsers do with image writes.
      navigator.clipboard.write = () => Promise.reject(new DOMException("Image copy not allowed", "NotAllowedError"));
    }
  }, opts);
}

const shared = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shared: { name: string; type: string; bytes: number[] }[] }).__shared);

test.beforeEach(async ({ page }) => {
  await stubSiteLogos(page);
});

test.describe("copy to clipboard", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("puts the exact PNG on the clipboard", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Website URL").fill("gdg.community.dev");
    await expectScanState(page, "good");
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByTestId("toast")).toContainText("Copied the image");

    const bytes = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      const blob = await item.getType("image/png");
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    expect(decodePng(Buffer.from(bytes)).text).toBe("https://gdg.community.dev");
  });
});

test("falls back to the share sheet when a browser refuses to copy images", async ({ page }) => {
  await fakeWebShare(page, { rejectClipboard: true });
  await page.goto("/");
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");

  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByTestId("toast")).toContainText("share menu opened instead");
  const files = await shared(page);
  expect(files).toHaveLength(1);
  expect(files[0].type).toBe("image/png");
  expect(decodePng(Buffer.from(files[0].bytes)).text).toBe("https://gdg.community.dev");
  // Shared codes are remembered like downloads.
  await expect(page.getByTestId("recent-list").getByRole("listitem")).toHaveCount(1);
});

test("a Share button appears where the device can share files", async ({ page }) => {
  await fakeWebShare(page, { rejectClipboard: false });
  await page.goto("/");
  await page.getByLabel("Website URL").fill("example.com");
  await expectScanState(page, "good");
  await page.getByRole("button", { name: /Share/ }).click();
  await expect.poll(async () => (await shared(page)).length).toBe(1);
  const [file] = await shared(page);
  expect(file.name).toMatch(/^qr-.*\.png$/);
  expect(decodePng(Buffer.from(file.bytes)).text).toBe("https://example.com");
});

test("no Share button where sharing files isn't supported", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined }));
  await page.goto("/");
  await page.getByLabel("Website URL").fill("example.com");
  await expect(page.getByRole("button", { name: /Share/ })).toHaveCount(0);
});
