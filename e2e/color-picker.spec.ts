import { expect, test, type Page } from "@playwright/test";
import { decodePng, downloadVia, expectScanState, stubSiteLogos } from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubSiteLogos(page);
  await page.goto("/");
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
});

const hex = (page: Page) => page.locator("#fg-hex");

/** Press at a fraction of an element's box. */
async function pressAt(page: Page, testId: string, fx: number, fy: number) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
  await page.mouse.down();
  return box;
}

test("drag anywhere on the square and hue bar to pick any shade", async ({ page }) => {
  await page.getByTestId("fg-swatch").click();
  await expect(page.getByTestId("fg-picker")).toBeVisible();

  // Hue to the far left (red), then drag past the square's top-right
  // corner: the thumb clamps to the extreme, which is pure red.
  let hueBox = await pressAt(page, "fg-hue", 0.05, 0.5);
  await page.mouse.move(hueBox.x - 40, hueBox.y + hueBox.height / 2, { steps: 4 });
  await page.mouse.up();
  const sv = await pressAt(page, "fg-sv", 0.8, 0.2);
  await page.mouse.move(sv.x + sv.width + 40, sv.y - 40, { steps: 4 });
  await page.mouse.up();
  await expect(hex(page)).toHaveValue("#ff0000");

  // Drag down-left through the square: a dark, muted red.
  const box = await pressAt(page, "fg-sv", 0.9, 0.1);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await expect(hex(page)).toHaveValue("#663333");

  // Hue a third of the way along: the same depth, now green.
  hueBox = await pressAt(page, "fg-hue", 1 / 3, 0.5);
  await page.mouse.up();
  await expect(hex(page)).toHaveValue("#336633");

  // The code is really drawn in that colour.
  await page.keyboard.press("Escape");
  await expectScanState(page, "good");
  const file = decodePng((await downloadVia(page, "png")).buffer);
  let count = 0;
  for (let i = 0; i < file.data.length; i += 4) {
    if (file.data[i] === 0x33 && file.data[i + 1] === 0x66 && file.data[i + 2] === 0x33) count++;
  }
  expect(count / (file.width * file.height)).toBeGreaterThan(0.2); // the modules are #336633
});

test("keyboard: arrows adjust, Escape closes and returns focus", async ({ page }) => {
  await page.getByTestId("fg-swatch").click();
  await page.locator(".color-picker__swatch[aria-label='#c8102e']").click();
  await expect(hex(page)).toHaveValue("#c8102e");

  await page.getByTestId("fg-sv").focus();
  await page.keyboard.press("Shift+ArrowDown"); // 10% darker
  await expect(hex(page)).not.toHaveValue("#c8102e");
  const darker = await hex(page).inputValue();
  await page.getByTestId("fg-hue").focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(hex(page)).not.toHaveValue(darker);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("fg-picker")).toHaveCount(0);
  await expect(page.getByTestId("fg-swatch")).toBeFocused();
});

test("typing a hex still works, and clicking outside closes the picker", async ({ page }) => {
  await page.getByTestId("bg-swatch").click();
  await page.locator("#bg-hex").fill("#fffaf5");
  await expect(page.getByTestId("bg-sv")).toHaveAttribute("aria-valuetext", "#fffaf5");
  await page.getByRole("heading", { name: "Make it yours" }).click();
  await expect(page.getByTestId("bg-picker")).toHaveCount(0);
});
