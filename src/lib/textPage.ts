/**
 * Text pages: a plain-text QR code that opens as a page instead.
 *
 * Raw text only pops up in the phone's normal camera; Google Lens treats the
 * code as an image and shows search results (an AI overview) instead. Every
 * scanner opens a link, though, so a text code can hold
 * https://<studio>/t/#<text>, and /t/ displays the text. The text travels in
 * the URL fragment, which browsers never send to a server: nothing is
 * uploaded or stored, and the page works from any static host.
 */

export const TEXT_PAGE_PATH = "/t/";
export const PRODUCTION_ORIGIN = "https://kehai-qr-studio.vercel.app";

function toBase64Url(text: string): string {
  const bin = Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The origin the page will be served from: this site, or production when there's no web origin. */
export function pageOrigin(): string {
  const o = typeof window !== "undefined" ? window.location.origin : "";
  return /^https?:\/\//.test(o) ? o : PRODUCTION_ORIGIN;
}

export function textPageUrl(text: string, origin = pageOrigin()): string {
  return `${origin}${TEXT_PAGE_PATH}#${toBase64Url(text)}`;
}

/** The text inside a page link's fragment, or null if it isn't valid. */
export function readTextPage(hash: string): string | null {
  const b64 = hash.replace(/^#/, "");
  if (!b64 || !/^[A-Za-z0-9_-]+$/.test(b64)) return null;
  try {
    const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}
