import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { expectScanState, makeLogoPng, stubSiteLogos } from "./helpers";

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`);
}

for (const theme of ["dark", "light"] as const) {
  for (const lang of ["en", "ja"] as const) {
    test(`no WCAG 2.1 AA violations — ${theme} theme, ${lang}`, async ({ page }) => {
      await stubSiteLogos(page, makeLogoPng());
      await page.addInitScript(
        ([t, l]) => {
          localStorage.setItem("kqs.theme", t);
          localStorage.setItem("kqs.lang", l);
        },
        [theme, lang],
      );
      await page.goto("/");
      await page.locator("#url").fill("gdg.community.dev");
      await expectScanState(page, "good");
      await page.locator("#url").fill("");
      await page.locator("#url").blur(); // show an error message too
      expect(await audit(page)).toEqual([]);
    });
  }
}

test("no violations with warnings, a website logo and recent codes on screen", async ({ page }) => {
  await stubSiteLogos(page, makeLogoPng());
  await page.goto("/");
  await page.locator("#url").fill("github.com");
  await expect(page.getByTestId("logo-source")).toBeVisible();
  await page.locator("#fg-hex").fill("#999999"); // low contrast → warning list
  await expectScanState(page, "warn");
  await page.getByRole("button", { name: /Save/ }).click();
  await expect(page.getByTestId("recent-list").getByRole("listitem")).toHaveCount(1);
  expect(await audit(page)).toEqual([]);
});
