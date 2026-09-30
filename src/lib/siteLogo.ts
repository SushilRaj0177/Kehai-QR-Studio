/**
 * Website logo detection for URL codes.
 *
 * There is no backend, and browsers can't read other sites' HTML (CORS),
 * so we ask public favicon services for the site's icon instead. Only the
 * domain name is sent — never the full URL, path or query string.
 *
 * An image is only used if it arrives with CORS headers (otherwise drawing
 * it would "taint" the canvas and break downloads and the scan check) and
 * is at least MIN_LOGO_PX wide (tiny favicons look blurry when enlarged).
 * The result is re-encoded as a PNG data: URL, so exports and history never
 * depend on the network again.
 */

export const MIN_LOGO_PX = 32;
export const LOGO_CANVAS_PX = 256;

/** "https://www.gdg.community.dev/x?y" -> "gdg.community.dev"; null for IPs/localhost/garbage. */
export function siteDomain(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (!host || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return null;
  if (!/\.[a-z]{2,}$/.test(host)) return null;
  return host.replace(/^www\./, "");
}

/** Favicon services to try, best quality first. */
export function logoSources(domain: string): string[] {
  const d = encodeURIComponent(domain);
  return [
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${d}&size=256`,
    `https://icon.horse/icon/${d}`,
    `https://icons.duckduckgo.com/ip3/${d}.ico`,
  ];
}

export interface LogoDeps {
  fetch: typeof fetch;
  /** Turns an image blob into a square PNG data URL, or null if it's too small/undecodable. */
  normalize: (blob: Blob) => Promise<string | null>;
}

/** Decode, reject tiny images, and redraw centred on a transparent square canvas. */
export async function normalizeLogo(blob: Blob): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    if (Math.min(bitmap.width, bitmap.height) < MIN_LOGO_PX) return null;
    const canvas = document.createElement("canvas");
    canvas.width = LOGO_CANVAS_PX;
    canvas.height = LOGO_CANVAS_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const scale = Math.min(LOGO_CANVAS_PX / bitmap.width, LOGO_CANVAS_PX / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (LOGO_CANVAS_PX - w) / 2, (LOGO_CANVAS_PX - h) / 2, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

const defaultDeps: LogoDeps = { fetch: (...a) => fetch(...a), normalize: normalizeLogo };

/** Tries each source in order; resolves to a data: URL or null. Never throws (except on abort). */
export async function fetchSiteLogo(domain: string, signal?: AbortSignal, deps: LogoDeps = defaultDeps): Promise<string | null> {
  for (const src of logoSources(domain)) {
    try {
      const res = await deps.fetch(src, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", signal });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) continue;
      const dataUrl = await deps.normalize(blob);
      if (dataUrl) return dataUrl;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      // CORS refusal, network error or bad image: try the next service.
    }
  }
  return null;
}

// One lookup per domain per visit, shared by every caller.
const cache = new Map<string, Promise<string | null>>();

export function getSiteLogo(domain: string, deps: LogoDeps = defaultDeps): Promise<string | null> {
  let p = cache.get(domain);
  if (!p) {
    p = fetchSiteLogo(domain, undefined, deps).catch(() => null);
    cache.set(domain, p);
  }
  return p;
}

export function clearSiteLogoCache(): void {
  cache.clear();
}
