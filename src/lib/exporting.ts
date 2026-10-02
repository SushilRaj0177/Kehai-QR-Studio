/** File-name helpers and browser download/clipboard plumbing. */

export function fileBaseName(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `qr-${slug || "code"}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canCopyImage(): boolean {
  return typeof navigator !== "undefined" && !!navigator.clipboard && typeof ClipboardItem !== "undefined";
}

/**
 * Samsung Internet doesn't reliably put images on the clipboard from a web
 * page (real-device testing: the write never lands, with or without an
 * error), so the studio routes Copy there to the browser's own long-press
 * image menu instead (see Preview).
 */
export function isSamsungInternet(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return /SamsungBrowser\//i.test(ua);
}

/** Rejects with a TimeoutError if `p` hasn't settled in `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DOMException(`No answer after ${ms} ms`, "TimeoutError")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

const describe = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));

/**
 * Copy a PNG to the clipboard.
 *
 * Call this *synchronously* from the click handler and pass the image as a
 * Promise: browsers only allow clipboard writes during a user gesture, and
 * stricter engines reject the write if we first await the render. Engines
 * that don't accept a Promise inside ClipboardItem get a retry with the
 * resolved blob. Each attempt has a time limit, so an engine that silently
 * never answers turns into a failure (and the caller's fallback) instead of
 * a dead button. `trace` collects what happened, for ?debug.
 */
export async function copyImage(image: Blob | Promise<Blob>, trace: string[] = [], timeoutMs = 2500): Promise<void> {
  if (!canCopyImage()) throw new Error("Copying images isn't supported in this browser.");
  const supports = (ClipboardItem as unknown as { supports?: (type: string) => boolean }).supports;
  if (typeof supports === "function" && !supports("image/png")) {
    trace.push("ClipboardItem.supports('image/png') = false");
    throw new DOMException("This browser can't put PNG images on the clipboard.", "NotSupportedError");
  }
  try {
    await withTimeout(navigator.clipboard.write([new ClipboardItem({ "image/png": image })]), timeoutMs);
    trace.push("write(promise): ok");
  } catch (e) {
    trace.push(`write(promise): ${describe(e)}`);
    if (!(image instanceof Promise)) throw e;
    const blob = await image;
    try {
      await withTimeout(navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]), timeoutMs);
      trace.push("write(blob): ok");
    } catch (e2) {
      trace.push(`write(blob): ${describe(e2)}`);
      throw e2;
    }
  }
}

/** True where the Web Share API can share an image file (mostly phones). */
export function canShareImage(): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [new File([new Uint8Array(1)], "qr.png", { type: "image/png" })] })
    );
  } catch {
    return false;
  }
}

/** Open the device's share sheet with the PNG. Rejects with AbortError if the user cancels. */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" });
  await navigator.share({ files: [file], title });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Downscale an image blob to a small PNG data URL for the history list. */
export async function makeThumbnail(blob: Blob, size = 96): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL("image/png");
}
