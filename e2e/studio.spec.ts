import { expect, test } from "@playwright/test";
import { decodePng, downloadVia, expectScanState, pickKind, previewPng } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("every QR type generates, downloads and scans back correctly", () => {
  const cases: { kind: string; fill: (p: import("@playwright/test").Page) => Promise<void>; expected: string }[] = [
    {
      kind: "URL",
      fill: (p) => p.getByLabel("Website URL").fill("gdg.community.dev"),
      expected: "https://gdg.community.dev",
    },
    {
      kind: "Text",
      fill: (p) => p.getByLabel("Text", { exact: true }).fill("GDG on Campus SRM · こんにちは 🌸"),
      expected: "GDG on Campus SRM · こんにちは 🌸",
    },
    {
      kind: "Email",
      fill: async (p) => {
        await p.getByLabel("To", { exact: true }).fill("technical@gdgsrm.com");
        await p.getByLabel(/Subject/).fill("Task submission");
        await p.getByLabel(/Message/).fill("Hi & thanks!");
      },
      expected: "mailto:technical@gdgsrm.com?subject=Task%20submission&body=Hi%20%26%20thanks!",
    },
    {
      kind: "Phone",
      fill: (p) => p.getByLabel("Phone number").fill("+91 98765-43210"),
      expected: "tel:+919876543210",
    },
    {
      kind: "Wi-Fi",
      fill: async (p) => {
        await p.getByLabel("Network name (SSID)").fill("GDG;Guest");
        await p.getByLabel("Password").fill('pa:ss,w"rd');
        await p.getByLabel("Hidden network").check();
      },
      expected: 'WIFI:T:WPA;S:GDG\\;Guest;P:pa\\:ss\\,w\\"rd;H:true;;',
    },
  ];

  for (const c of cases) {
    test(c.kind, async ({ page }) => {
      await pickKind(page, c.kind);
      await c.fill(page);
      await expectScanState(page, "good");
      await expect(page.getByTestId("payload")).toHaveText(c.expected);

      const { name, buffer } = await downloadVia(page, /Download PNG/);
      expect(name).toMatch(/^qr-.*\.png$/);
      const png = decodePng(buffer);
      expect(png.text).toBe(c.expected);
    });
  }
});

test("the downloaded PNG is pixel-identical to the preview", async ({ page }) => {
  await page.getByLabel("Website URL").fill("kehai-engine-web.vercel.app");
  await page.getByRole("button", { name: /Torii/ }).click();
  await expectScanState(page, "good");

  const preview = decodePng(await previewPng(page));
  const { buffer } = await downloadVia(page, /Download PNG/);
  const file = decodePng(buffer);

  expect(file.width).toBe(preview.width);
  expect(file.height).toBe(preview.height);
  expect(file.data.equals(preview.data)).toBe(true);
});

test("customisation changes the output immediately", async ({ page }) => {
  await page.getByLabel("Website URL").fill("example.com");
  await expectScanState(page, "good");

  // Size
  await page.getByLabel("Size value").fill("512");
  await page.getByLabel("Size value").blur();
  await expect(page.getByText("512 × 512 px")).toBeVisible();
  let file = decodePng((await downloadVia(page, /Download PNG/)).buffer);
  expect(file.width).toBe(512);
  expect(file.text).toBe("https://example.com");

  // Colours: background pixel in the corner should be the chosen colour.
  await page.getByLabel("Background", { exact: true }).fill("#fff1f5");
  await page.getByLabel("Code", { exact: true }).fill("#831843");
  await expectScanState(page, "good");
  file = decodePng((await downloadVia(page, /Download PNG/)).buffer);
  expect([...file.data.subarray(0, 3)]).toEqual([0xff, 0xf1, 0xf5]);
  expect(file.text).toBe("https://example.com");

  // Error correction changes the payload's module grid.
  const before = await previewPng(page);
  await page.getByRole("radiogroup", { name: "Error correction level" }).getByText("H", { exact: true }).click();
  await expect(page.getByText(/level H/)).toBeVisible();
  await expect.poll(async () => (await previewPng(page)).equals(before)).toBe(false);

  // Margin: 0 → a no-quiet-zone warning.
  await page.getByLabel("Margin value").fill("0");
  await page.getByLabel("Margin value").blur();
  await expect(page.getByText("No quiet zone")).toBeVisible();
});

test("presets apply and remain editable", async ({ page }) => {
  await page.getByLabel("Website URL").fill("example.com");
  const sakura = page.getByRole("button", { name: /Sakura/ });
  await sakura.click();
  await expect(sakura).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("radiogroup", { name: "Module style" }).getByText("Square", { exact: true }).click();
  await expect(sakura).toHaveAttribute("aria-pressed", "false");
  await expectScanState(page, "good");
});

test("invalid input shows errors and blocks export", async ({ page }) => {
  const download = page.getByRole("button", { name: /Download PNG/ });

  await page.getByLabel("Website URL").fill("not a url");
  await page.getByLabel("Website URL").blur();
  await expect(page.getByRole("alert")).toContainText("spaces");
  await expect(download).toBeDisabled();

  await pickKind(page, "Phone");
  await page.getByLabel("Phone number").fill("12+34");
  await page.getByLabel("Phone number").blur();
  await expect(page.getByRole("alert")).toContainText("start");
  await expect(download).toBeDisabled();

  await pickKind(page, "Wi-Fi");
  await page.getByLabel("Network name (SSID)").fill("Lab");
  await page.getByLabel("Password").fill("short");
  await page.getByLabel("Password").blur();
  await expect(page.getByRole("alert")).toContainText("8–63");
  await expect(download).toBeDisabled();

  await page.getByLabel("Password").fill("long-enough-now");
  await expect(download).toBeEnabled();
});

test("readability warnings flag risky designs", async ({ page }) => {
  await page.getByLabel("Website URL").fill("example.com");
  await expectScanState(page, "good");

  await page.getByLabel("Code", { exact: true }).fill("#dddddd");
  await expect(page.getByText(/Contrast too low/)).toBeVisible();
  await expectScanState(page, "bad");

  await page.getByLabel("Code", { exact: true }).fill("#ffffff");
  await page.getByLabel("Background", { exact: true }).fill("#000000");
  await expect(page.getByText("Inverted colours")).toBeVisible();
});

test("a logo raises error correction and still scans", async ({ page }) => {
  await page.getByLabel("Website URL").fill("example.com");
  const logo = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="12" fill="#ff2d55"/></svg>',
  );
  await page.getByTestId("logo-input").setInputFiles({ name: "logo.svg", mimeType: "image/svg+xml", buffer: logo });
  await expect(page.getByAltText("Uploaded logo")).toBeVisible();
  await expect(page.getByText(/level H/)).toBeVisible();
  await expectScanState(page, "good");
  const file = decodePng((await downloadVia(page, /Download PNG/)).buffer);
  expect(file.text).toBe("https://example.com");
});

test("SVG export is a valid SVG document", async ({ page }) => {
  await page.getByLabel("Website URL").fill("example.com");
  await expectScanState(page, "good");
  const { name, buffer } = await downloadVia(page, /^SVG$/);
  expect(name).toMatch(/\.svg$/);
  const svg = buffer.toString("utf8");
  expect(svg).toContain("<svg");
  expect(svg).toContain("</svg>");
});

test("recent codes persist across a refresh and can be reused", async ({ page }) => {
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  await downloadVia(page, /Download PNG/);

  await pickKind(page, "Phone");
  await page.getByLabel("Phone number").fill("+91 90000 00000");
  await page.getByRole("button", { name: /Sakura/ }).click();
  await page.getByRole("button", { name: /^Save$/ }).click();

  const list = page.getByTestId("recent-list");
  await expect(list.getByRole("listitem")).toHaveCount(2);

  await page.reload();
  await expect(list.getByRole("listitem")).toHaveCount(2);

  // Reuse the phone code: type, number and preset all come back.
  await list.getByRole("button", { name: /Reuse Phone code/ }).click();
  await expect(page.getByLabel("Phone number")).toHaveValue("+91 90000 00000");
  await expect(page.getByRole("button", { name: /Sakura/ })).toHaveAttribute("aria-pressed", "true");

  // Remove one, clear the rest.
  await list.getByRole("button", { name: /Remove/ }).first().click();
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page.getByText(/Codes you download, copy or save appear here/)).toBeVisible();
});

test("theme toggle switches and persists", async ({ page }) => {
  const html = page.locator("html");
  const initial = await html.getAttribute("data-theme");
  await page.getByTestId("theme-toggle").click();
  const next = initial === "dark" ? "light" : "dark";
  await expect(html).toHaveAttribute("data-theme", next);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", next);
});
