import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import jsQR from "jsqr";
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
