import { expect, test } from "@playwright/test";
import { decodePng, downloadVia, expectScanState, makeLogoPng, pickKind, previewPng, stubSiteLogos, zxingDecode } from "./helpers";

test.beforeEach(async ({ page }) => {
  // No real favicon lookups: the site-logo feature has its own tests below.
  await stubSiteLogos(page);
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
      fill: async (p) => {
        await p.getByTestId("text-as-page").uncheck(); // raw text mode
        await p.getByLabel("Text", { exact: true }).fill("GDG on Campus SRM · こんにちは 🌸");
      },
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
    {
      kind: "Contact",
      fill: async (p) => {
        await p.locator("#contact-name").fill("Sushil Raj");
        await p.locator("#contact-phone").fill("+91 98765 43210");
        await p.locator("#contact-email").fill("sushil@example.com");
        await p.locator("#contact-org").fill("GDG on Campus SRM");
      },
      expected: "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Raj;Sushil;;;\r\nFN:Sushil Raj\r\nORG:GDG on Campus SRM\r\nTEL;TYPE=CELL:+919876543210\r\nEMAIL:sushil@example.com\r\nEND:VCARD",
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
      // And by ZXing, the decoder most Android scanners use.
      expect(await zxingDecode(buffer)).toBe(c.expected);
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
  await expect(page.getByAltText("Current logo")).toBeVisible();
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

test("a logo can be dropped onto the Logo section or pasted", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Website URL").fill("example.com");
  await expectScanState(page, "good");

  const png = makeLogoPng([34, 226, 245]).toString("base64");
  // Drop.
  await page.getByTestId("logo-drop").evaluate((el, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "logo.png", { type: "image/png" }));
    el.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
    el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, png);
  await expect(page.getByAltText("Current logo")).toBeVisible();
  await expectScanState(page, "good");

  // Remove, then paste.
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByAltText("Current logo")).toHaveCount(0);
  await page.evaluate((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "logo.png", { type: "image/png" }));
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, png);
  await expect(page.getByAltText("Current logo")).toBeVisible();
});

test.describe("design links", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("a copied link reopens the same content and design", async ({ page, context }) => {
    await pickKind(page, "Text");
    await page.getByLabel("Text", { exact: true }).fill("Shared · 共有 🌸");
    await page.getByRole("button", { name: /Sakura/ }).click();
    await expectScanState(page, "good");
    const original = decodePng((await downloadVia(page, /Download PNG/)).buffer);

    await page.getByTestId("copy-link").click();
    await expect(page.getByTestId("toast")).toContainText("Link copied");
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/#d=/);

    const other = await context.newPage();
    await stubSiteLogos(other);
    await other.goto(link);
    await expect(other.getByTestId("toast")).toContainText("Opened a shared design");
    await expect(other.getByLabel("Text", { exact: true })).toHaveValue("Shared · 共有 🌸");
    await expect(other.getByRole("button", { name: /Sakura/ })).toHaveAttribute("aria-pressed", "true");
    expect(new URL(other.url()).hash).toBe(""); // address bar tidied
    await expectScanState(other, "good");
    const copy = decodePng((await downloadVia(other, /Download PNG/)).buffer);
    expect(copy.text).toBe(original.text);
    expect(Buffer.compare(copy.data, original.data)).toBe(0); // same pixels
  });
});

test("camera stress test: a clean code passes, a risky one fails", async ({ page }) => {
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  await expect(page.getByTestId("stress")).toHaveAttribute("data-passed", "3");

  // Grey on white still decodes as a perfect image, but not in dim light.
  await page.locator("#fg-hex").fill("#9a9a9a");
  await expect(page.getByTestId("stress").locator('[data-id="dim"]')).toHaveAttribute("data-pass", "false");

  // Long content at a small size: too dense to read at 120 px.
  await page.locator("#fg-hex").fill("#0a0e14");
  await pickKind(page, "Text");
  await page.getByLabel("Text", { exact: true }).fill("x".repeat(400));
  await expect(page.getByTestId("stress").locator('[data-id="small"]')).toHaveAttribute("data-pass", "false");
});

test("a contact needs a phone number; everything else is optional", async ({ page }) => {
  await pickKind(page, "Contact");
  await page.locator("#contact-name").fill("Sushil Raj");
  await page.locator("#contact-phone").focus();
  await page.locator("#contact-phone").blur();
  await expect(page.getByText("Enter a phone number.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Download PNG/ })).toBeDisabled();

  await page.locator("#contact-name").fill("");
  await page.locator("#contact-phone").fill("+91 98765 43210");
  await expectScanState(page, "good");
  const file = decodePng((await downloadVia(page, /Download PNG/)).buffer);
  expect(file.text).toContain("FN:+919876543210");
  expect(file.text).toContain("TEL;TYPE=CELL:+919876543210");
});

test("presses ripple from the touch point and clean up after themselves", async ({ page }) => {
  const btn = page.getByRole("button", { name: /Reset/ });
  const box = (await btn.boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + box.height / 2);
  await page.mouse.down();
  const ripple = btn.locator(".ripple");
  await expect(ripple).toHaveCount(1);
  expect(await ripple.evaluate((el) => parseFloat(el.style.left))).toBeLessThan(10); // starts where pressed
  await page.mouse.up();
  await expect(ripple).toHaveCount(0, { timeout: 2000 });
});

test("the theme switch is a circular reveal from the button, never a grey cross-fade", async ({ page }) => {
  await page.evaluate(() => {
    const w = window as unknown as { __vt: number };
    w.__vt = 0;
    const orig = document.startViewTransition?.bind(document);
    if (orig) document.startViewTransition = ((cb: () => void) => (w.__vt++, orig(cb))) as typeof document.startViewTransition;
  });
  const before = await page.locator("html").getAttribute("data-theme");
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", before!);
  expect(await page.evaluate(() => (window as unknown as { __vt: number }).__vt)).toBe(1);
});

test("text codes open as a page by default, showing the exact text", async ({ page, context }) => {
  await pickKind(page, "Text");
  await expect(page.getByTestId("text-as-page")).toBeChecked();
  await expect(page.getByTestId("text-scan-note")).toContainText("Every camera app opens it");
  const message = 'Prettiest soul! <3\nこんにちは 🌸 <img src=x onerror="window.__xss=1"> https://gdg.community.dev';
  await page.getByLabel("Text", { exact: true }).fill(message);
  await expectScanState(page, "good");

  // The code holds a link to /t/ — readable by both decoders.
  const { buffer } = await downloadVia(page, /Download PNG/);
  const link = decodePng(buffer).text!;
  expect(link).toMatch(/^http:\/\/localhost:\d+\/t\/#[A-Za-z0-9_-]+$/);
  expect(await zxingDecode(buffer)).toBe(link);

  // Opening it shows the text exactly, as text (the markup never runs).
  const viewer = await context.newPage();
  await viewer.goto(link);
  await expect(viewer.getByTestId("viewer-text")).toHaveText(message);
  expect(await viewer.locator("[data-testid=viewer-text] img").count()).toBe(0);
  expect(await viewer.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(viewer.getByRole("link", { name: "https://gdg.community.dev" })).toHaveAttribute("rel", /noopener/);
  await expect(viewer).toHaveTitle(/Prettiest soul/);

  // Raw mode is one click away and explains the trade-off.
  await page.getByTestId("text-as-page").uncheck();
  await expect(page.getByTestId("text-scan-note")).toContainText("normal camera");
  await expect(page.getByTestId("payload")).toHaveText(message);
});

test("a broken text-page link shows a friendly message", async ({ page }) => {
  await page.goto("/t/#not-a-valid-message!");
  await expect(page.getByText("This link doesn't contain a message.")).toBeVisible();
});

test("scroll performance guard: frosted panels use baked glass, not a live backdrop blur", async ({ page }) => {
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  const blurred = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (cs.backdropFilter && cs.backdropFilter !== "none") || ((cs as unknown as Record<string, string>).webkitBackdropFilter ?? "none") !== "none";
      })
      .map((el) => el.className),
  );
  expect(blurred).toEqual(["topbar"]);

  // Each panel's glass must stay inside its panel: the panel has to be a
  // positioned box, or the pre-blurred layer would cover the page.
  const panels = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".glass")).map((g) => getComputedStyle(g.parentElement!).position),
  );
  expect(panels.length).toBe(4);
  for (const p of panels) expect(p).not.toBe("static");
  // The baked frost images exist for both themes.
  await expect
    .poll(() => page.evaluate(() => ["dark", "light"].map((t) => document.documentElement.style.getPropertyValue(`--frost-${t}`).startsWith('url("data:image/png'))))
    .toEqual([true, true]);
});

test("desktop: the pinned preview stops above Recent codes instead of sliding under it", async ({ page }) => {
  await page.getByLabel("Website URL").fill("gdg.community.dev");
  await expectScanState(page, "good");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  const [preview, recent] = await Promise.all([
    page.locator(".panel--preview").boundingBox(),
    page.locator(".panel.recent").boundingBox(),
  ]);
  expect(preview!.y + preview!.height).toBeLessThanOrEqual(recent!.y);
});

test("clicking scatters a kanji burst that cleans up, but not while typing or ticking", async ({ page }) => {
  const glyphs = page.locator("#kanji-bursts .kburst__glyph");
  // Wait until the app has mounted (its listeners attach right after).
  await expect(page.getByTestId("scan-status")).toBeVisible();
  await page.waitForTimeout(100);
  // Empty space: a burst of 7 glyphs, then the overlay empties itself.
  await page.mouse.click(30, 400);
  await expect(glyphs).toHaveCount(7);
  await expect(glyphs).toHaveCount(0, { timeout: 2500 });
  // Typing in a field, ticking a checkbox and keyboard activation stay quiet.
  await page.getByLabel("Website URL").click();
  await page.getByLabel("Use the website's logo for links automatically").click();
  await page.getByRole("button", { name: /Reset/ }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  await expect(glyphs).toHaveCount(0);
  // The overlay never blocks clicks underneath.
  expect(await page.locator("#kanji-bursts").evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
});
