import jsQR from "jsqr";

/**
 * Live scan verification: decode the exact pixels the user will download
 * and compare them with what was meant to be encoded. This catches designs
 * that look fine but no longer decode (contrast, logo, margins, patterns).
 */

export type ScanResult =
  | { status: "ok"; decoded: string }
  | { status: "mismatch"; decoded: string }
  | { status: "unreadable" };

/** Decode a canvas-like image. Returns the raw payload or null. */
export function decodeImageData(image: ImageData): string | null {
  // "dontInvert" on purpose: a phone camera app generally won't try the
  // inverted image either, so only normal-polarity decodes count as a pass.
  const result = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
  return result ? bytesToUtf8(result.binaryData) : null;
}

function bytesToUtf8(bytes: number[]): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return String.fromCharCode(...bytes);
  }
}

export async function blobToImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export async function verifyScan(blob: Blob, expected: string): Promise<ScanResult> {
  const decoded = decodeImageData(await blobToImageData(blob));
  if (decoded === null) return { status: "unreadable" };
  return decoded === expected ? { status: "ok", decoded } : { status: "mismatch", decoded };
}

// ------------------------------------------------------------ stress test

export type StressId = "small" | "blur" | "dim";
export type StressResult = Record<StressId, boolean>;

/**
 * Rough camera conditions, applied to the rendered image before decoding:
 * - small: the code seen at 120 px, like a small print from arm's length;
 * - blur:  240 px with a 1.2 px blur (focus miss, hand shake);
 * - dim:   240 px with the contrast crushed, like a dark room.
 * A perfect digital decode says the data is right; these say how much
 * margin the design has left for real phones.
 */
export async function stressTest(blob: Blob, expected: string): Promise<StressResult> {
  const bitmap = await createImageBitmap(blob);
  const run = (px: number, paint: (ctx: CanvasRenderingContext2D) => void): boolean => {
    const canvas = document.createElement("canvas");
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    paint(ctx);
    return decodeImageData(ctx.getImageData(0, 0, px, px)) === expected;
  };
  try {
    return {
      small: run(120, (ctx) => ctx.drawImage(bitmap, 0, 0, 120, 120)),
      blur: run(240, (ctx) => {
        ctx.filter = "blur(1.2px)";
        ctx.drawImage(bitmap, 0, 0, 240, 240);
      }),
      dim: run(240, (ctx) => {
        ctx.drawImage(bitmap, 0, 0, 240, 240);
        // Squash the range towards mid-grey: black stays ~0.2, white drops to ~0.45.
        ctx.fillStyle = "rgba(40, 40, 40, 0.6)";
        ctx.fillRect(0, 0, 240, 240);
      }),
    };
  } finally {
    bitmap.close();
  }
}
