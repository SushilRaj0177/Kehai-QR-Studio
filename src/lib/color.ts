/** Colour conversions for the picker: #rrggbb <-> HSV (h 0–360, s/v 0–1). */

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export function hexToHsv(hex: string): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (k: number) => {
    const x = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(x, 4 - x, 1));
  };
  return "#" + [f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
}

/** Keep the hue the user chose when the colour itself can't express one (grey, black). */
export function syncHsv(prev: Hsv, hex: string): Hsv {
  if (hsvToHex(prev) === hex.toLowerCase()) return prev;
  const next = hexToHsv(hex);
  if (next.s === 0 || next.v === 0) return { ...next, h: prev.h, s: next.v === 0 ? prev.s : next.s };
  return next;
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
