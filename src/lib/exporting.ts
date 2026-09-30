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

export async function copyImage(blob: Blob): Promise<void> {
  if (!canCopyImage()) throw new Error("Copying images isn't supported in this browser.");
  await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
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
