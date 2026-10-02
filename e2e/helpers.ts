import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { readBarcodes } from "zxing-wasm/reader";
import { expect, type Download, type Page } from "@playwright/test";

export interface DecodedPng {
  width: number;
  height: number;
  data: Buffer;
  text: string | null;
}

/** Decode a PNG buffer's pixels and try to read a QR code from them. */
export function decodePng(buffer: Buffer): DecodedPng {
  const png = PNG.sync.read(buffer);
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  const text = result ? new TextDecoder().decode(new Uint8Array(result.binaryData)) : null;
  return { width: png.width, height: png.height, data: png.data, text };
}

export async function readDownload(download: Download): Promise<Buffer> {
  const path = await download.path();
  if (!path) throw new Error("Download has no local path");
  return readFileSync(path);
}

/** Click a download button and return the file's bytes + suggested name. */
export async function downloadVia(page: Page, buttonName: RegExp) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: buttonName }).click()]);
  return { name: download.suggestedFilename(), buffer: await readDownload(download) };
}

/** The preview canvas as PNG bytes, exactly as displayed. */
export async function previewPng(page: Page): Promise<Buffer> {
  const dataUrl = await page.locator("[data-testid=qr-preview] canvas").evaluate((c) => (c as HTMLCanvasElement).toDataURL("image/png"));
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

export async function expectScanState(page: Page, state: "good" | "warn" | "bad") {
  await expect(page.getByTestId("scan-status")).toHaveAttribute("data-state", state, { timeout: 5000 });
}

export async function pickKind(page: Page, label: string) {
  await page.getByRole("radiogroup", { name: "QR code type" }).getByText(label, { exact: true }).click();
}

// ------------------------------------------------------------ website logos

/** The public favicon services the app asks for a site's logo. */
export const LOGO_SERVICES = /t3\.gstatic\.com|icon\.horse|icons\.duckduckgo\.com/;

/** A 128×128 PNG "logo": a filled circle, made on the fly so tests need no fixtures. */
export function makeLogoPng(rgb: [number, number, number] = [255, 45, 85]): Buffer {
  const size = 128;
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inside = (x - 63.5) ** 2 + (y - 63.5) ** 2 <= 60 ** 2;
      png.data[i] = rgb[0];
      png.data[i + 1] = rgb[1];
      png.data[i + 2] = rgb[2];
      png.data[i + 3] = inside ? 255 : 0;
    }
  }
  return PNG.sync.write(png);
}

/**
 * Stub the favicon services. By default they 404 so tests never depend on
 * (or race with) the real internet; pass a logo to serve it with CORS.
 * Returns a list that records every requested URL.
 */
export async function stubSiteLogos(page: Page, logo?: Buffer | ((url: string) => Buffer | null)): Promise<string[]> {
  const requests: string[] = [];
  await page.route(LOGO_SERVICES, (route) => {
    const url = route.request().url();
    requests.push(url);
    const body = typeof logo === "function" ? logo(url) : logo;
    if (!body) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
      body,
    });
  });
  return requests;
}

/**
 * Decode with ZXing (zxing-cpp compiled to WASM), the engine behind most
 * Android scanner apps: a second, independent opinion next to jsQR.
 */
export async function zxingDecode(buffer: Buffer): Promise<string | null> {
  const [hit] = await readBarcodes(new Blob([new Uint8Array(buffer)]), { formats: ["QRCode"], tryHarder: false });
  return hit?.text ?? null;
}
