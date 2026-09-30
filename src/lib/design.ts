import type { Options } from "qr-code-styling";

/**
 * The visual design of a QR code, independent of what it encodes. This is
 * the single source of truth for both the live preview and the download,
 * which is what guarantees the downloaded file matches the preview.
 */

export type ErrorLevel = "L" | "M" | "Q" | "H";
export type DotStyle = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
export type CornerStyle = "square" | "extra-rounded" | "dot";
export type CornerDotStyle = "square" | "dot";

export interface GradientSetting {
  enabled: boolean;
  type: "linear" | "radial";
  /** Second colour; the first is `foreground`. */
  color: string;
  /** Degrees, linear only. */
  rotation: number;
}

export interface LogoSetting {
  /** data: URL of the uploaded image, or null for no logo. */
  src: string | null;
  /** Fraction of the code's width the logo may occupy (0.1–0.4). */
  size: number;
  /** Clear the modules behind the logo so it sits on a clean patch. */
  hideDots: boolean;
}

export interface QrDesign {
  /** Output width/height in pixels (square). */
  size: number;
  /** Quiet zone around the code, in pixels. */
  margin: number;
  foreground: string;
  background: string;
  gradient: GradientSetting;
  errorLevel: ErrorLevel;
  dotStyle: DotStyle;
  cornerStyle: CornerStyle;
  cornerDotStyle: CornerDotStyle;
  logo: LogoSetting;
}

export const SIZE_MIN = 128;
export const SIZE_MAX = 1024;
export const MARGIN_MAX = 80;

export const DEFAULT_DESIGN: QrDesign = {
  size: 320,
  margin: 16,
  foreground: "#0a0e14",
  background: "#ffffff",
  gradient: { enabled: false, type: "linear", color: "#ff2d55", rotation: 45 },
  errorLevel: "M",
  dotStyle: "square",
  cornerStyle: "square",
  cornerDotStyle: "square",
  logo: { src: null, size: 0.25, hideDots: true },
};

export const ERROR_LEVELS: { id: ErrorLevel; label: string; recovers: string }[] = [
  { id: "L", label: "Low", recovers: "~7%" },
  { id: "M", label: "Medium", recovers: "~15%" },
  { id: "Q", label: "Quartile", recovers: "~25%" },
  { id: "H", label: "High", recovers: "~30%" },
];

export const DOT_STYLES: { id: DotStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "rounded", label: "Rounded" },
  { id: "extra-rounded", label: "Soft" },
  { id: "dots", label: "Dots" },
  { id: "classy", label: "Classy" },
  { id: "classy-rounded", label: "Classy round" },
];

export const CORNER_STYLES: { id: CornerStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "extra-rounded", label: "Rounded" },
  { id: "dot", label: "Circle" },
];

export const CORNER_DOT_STYLES: { id: CornerDotStyle; label: string }[] = [
  { id: "square", label: "Square" },
  { id: "dot", label: "Circle" },
];

export interface Preset {
  id: string;
  name: string;
  /** Short description shown on the preset card. */
  note: string;
  design: Omit<QrDesign, "size" | "logo">;
}

/** Visual presets. Each one is scannable as-is; they only set appearance,
 * so the user's size and logo are kept and everything stays editable. */
export const PRESETS: Preset[] = [
  {
    id: "classic",
    name: "Classic",
    note: "Black on white. Scans anywhere.",
    design: {
      margin: 16,
      foreground: "#0a0e14",
      background: "#ffffff",
      gradient: { enabled: false, type: "linear", color: "#0a0e14", rotation: 0 },
      errorLevel: "M",
      dotStyle: "square",
      cornerStyle: "square",
      cornerDotStyle: "square",
    },
  },
  {
    id: "torii",
    name: "Torii",
    note: "Kehai vermilion gradient.",
    design: {
      margin: 18,
      foreground: "#c8102e",
      background: "#fffaf5",
      gradient: { enabled: true, type: "linear", color: "#5c0a1c", rotation: 135 },
      errorLevel: "Q",
      dotStyle: "rounded",
      cornerStyle: "extra-rounded",
      cornerDotStyle: "dot",
    },
  },
  {
    id: "kehai-cyan",
    name: "Kehai Cyan",
    note: "Deep teal, soft modules.",
    design: {
      margin: 18,
      foreground: "#0b4f5c",
      background: "#f2fdff",
      gradient: { enabled: true, type: "radial", color: "#032a33", rotation: 0 },
      errorLevel: "Q",
      dotStyle: "extra-rounded",
      cornerStyle: "extra-rounded",
      cornerDotStyle: "square",
    },
  },
  {
    id: "print",
    name: "Print-safe",
    note: "High recovery, wide quiet zone.",
    design: {
      margin: 32,
      foreground: "#000000",
      background: "#ffffff",
      gradient: { enabled: false, type: "linear", color: "#000000", rotation: 0 },
      errorLevel: "H",
      dotStyle: "square",
      cornerStyle: "square",
      cornerDotStyle: "square",
    },
  },
  {
    id: "sakura",
    name: "Sakura",
    note: "Plum on blossom pink.",
    design: {
      margin: 18,
      foreground: "#831843",
      background: "#fff1f5",
      gradient: { enabled: false, type: "linear", color: "#831843", rotation: 0 },
      errorLevel: "Q",
      dotStyle: "classy-rounded",
      cornerStyle: "extra-rounded",
      cornerDotStyle: "dot",
    },
  },
  {
    id: "ink",
    name: "Sumi Ink",
    note: "Charcoal dots on paper.",
    design: {
      margin: 20,
      foreground: "#1c1917",
      background: "#f5f1e8",
      gradient: { enabled: false, type: "linear", color: "#1c1917", rotation: 0 },
      errorLevel: "Q",
      dotStyle: "dots",
      cornerStyle: "dot",
      cornerDotStyle: "dot",
    },
  },
];

export function applyPreset(current: QrDesign, preset: Preset): QrDesign {
  return { ...current, ...preset.design, gradient: { ...preset.design.gradient } };
}

/** Which preset (if any) the current design still matches exactly. */
export function matchingPreset(design: QrDesign): string | null {
  for (const p of PRESETS) {
    const d = p.design;
    const same =
      d.margin === design.margin &&
      d.foreground.toLowerCase() === design.foreground.toLowerCase() &&
      d.background.toLowerCase() === design.background.toLowerCase() &&
      d.errorLevel === design.errorLevel &&
      d.dotStyle === design.dotStyle &&
      d.cornerStyle === design.cornerStyle &&
      d.cornerDotStyle === design.cornerDotStyle &&
      d.gradient.enabled === design.gradient.enabled &&
      (!d.gradient.enabled ||
        (d.gradient.type === design.gradient.type &&
          d.gradient.color.toLowerCase() === design.gradient.color.toLowerCase() &&
          d.gradient.rotation === design.gradient.rotation));
    if (same) return p.id;
  }
  return null;
}

/**
 * Non-ASCII text (accents, kanji, emoji) must be sent to the QR encoder as
 * UTF-8 bytes. The renderer encodes each character code as one byte, so we
 * hand it a string whose characters *are* the UTF-8 bytes. Scanners decode
 * byte-mode data as UTF-8, so the phone sees the original text.
 */
export function toUtf8ByteString(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let out = "";
  for (const b of bytes) out += String.fromCharCode(b);
  return out;
}

/** Translate a design + payload into qr-code-styling options. */
export function toStylingOptions(design: QrDesign, data: string): Options {
  const fg = design.foreground;
  const gradient = design.gradient.enabled
    ? {
        type: design.gradient.type,
        rotation: (design.gradient.rotation * Math.PI) / 180,
        colorStops: [
          { offset: 0, color: fg },
          { offset: 1, color: design.gradient.color },
        ],
      }
    : undefined;

  return {
    type: "canvas",
    width: design.size,
    height: design.size,
    margin: design.margin,
    data: toUtf8ByteString(data),
    image: design.logo.src ?? undefined,
    qrOptions: { typeNumber: 0, mode: "Byte", errorCorrectionLevel: design.errorLevel },
    imageOptions: {
      hideBackgroundDots: design.logo.hideDots,
      imageSize: design.logo.size,
      margin: Math.round(design.size / 80),
      crossOrigin: "anonymous",
    },
    dotsOptions: { type: design.dotStyle, color: fg, gradient },
    cornersSquareOptions: { type: design.cornerStyle, color: fg, gradient },
    cornersDotOptions: { type: design.cornerDotStyle, color: fg, gradient },
    backgroundOptions: { color: design.background },
  };
}
