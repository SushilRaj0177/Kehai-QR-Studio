import qrcode from "qrcode-generator";
import { describe, expect, it } from "vitest";
import { decodeImageData } from "./scanCheck";

/** A real QR code as raw pixels: `dark` for modules, `light` for the rest. */
function qrPixels(text: string, dark: number, light: number): ImageData {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const scale = 4;
  const quiet = 4;
  const size = (n + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.floor(y / scale) - quiet;
      const c = Math.floor(x / scale) - quiet;
      const on = r >= 0 && c >= 0 && r < n && c < n && qr.isDark(r, c);
      const v = on ? dark : light;
      data.set([v, v, v, 255], (y * size + x) * 4);
    }
  }
  return { data, width: size, height: size, colorSpace: "srgb" } as ImageData;
}

describe("decodeImageData", () => {
  it("reads a normal dark-on-light code, and not as inverted", () => {
    const img = qrPixels("https://example.com", 20, 240);
    expect(decodeImageData(img)).toBe("https://example.com");
    expect(decodeImageData(img, true)).toBeNull();
  });

  it("reads a light-on-dark code only with the inverted pass (as Google Lens does)", () => {
    const img = qrPixels("https://example.com", 240, 20);
    expect(decodeImageData(img)).toBeNull();
    expect(decodeImageData(img, true)).toBe("https://example.com");
  });
});
