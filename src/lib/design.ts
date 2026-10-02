import type { Options } from "qr-code-styling";
import qrcode from "qrcode-generator";

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
  /** Where the logo came from: uploaded by the user, or auto-detected from the URL's website. */
  origin: "upload" | "site" | null;
  /** For site logos: the domain it belongs to (e.g. "gdg.community.dev"). */
  siteDomain: string | null;
}

export interface QrDesign {
  /** Output width/height in pixels (square). */
  size: number;
  /** Quiet zone around the code, in modules (the QR spec asks for 4).
   * Measured in modules rather than pixels so it stays correct at any size. */
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
export const MARGIN_MAX = 10;

export const DEFAULT_DESIGN: QrDesign = {
  size: 320,
  margin: 4,
  foreground: "#0a0e14",
  background: "#ffffff",
  gradient: { enabled: false, type: "linear", color: "#ff2d55", rotation: 45 },
  errorLevel: "M",
  dotStyle: "square",
  cornerStyle: "square",
  cornerDotStyle: "square",
  logo: { src: null, size: 0.25, hideDots: true, origin: null, siteDomain: null },
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
      margin: 4,
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
      margin: 3,
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
      margin: 3,
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
    id: "matcha",
    name: "Matcha",
    note: "Tea green on cream, leaf-round dots.",
    design: {
      margin: 3,
      foreground: "#4b6b22",
      background: "#f6f1df",
      gradient: { enabled: true, type: "linear", color: "#24380d", rotation: 160 },
      errorLevel: "Q",
      dotStyle: "dots",
      cornerStyle: "extra-rounded",
      cornerDotStyle: "dot",
    },
  },
  {
    id: "sakura",
    name: "Sakura",
    note: "Plum on blossom pink.",
    design: {
      margin: 3,
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
    id: "aizome",
    name: "Aizome",
    note: "Indigo dye on unbleached cotton.",
    design: {
      margin: 3,
      foreground: "#24467a",
      background: "#f3efe4",
      gradient: { enabled: true, type: "linear", color: "#0f1d3a", rotation: 45 },
      errorLevel: "Q",
      dotStyle: "classy",
      cornerStyle: "extra-rounded",
      cornerDotStyle: "square",
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

/** Modules per side for this payload (auto version, byte mode), or null if it can't fit. */
export function moduleCount(data: string, errorLevel: ErrorLevel): number | null {
  try {
    const qr = qrcode(0, errorLevel);
    qr.addData(toUtf8ByteString(data), "Byte");
    qr.make();
    return qr.getModuleCount();
  } catch {
    return null;
  }
}

/**
 * Converts the quiet zone from modules to the pixel margin the renderer
 * expects: with N modules and m quiet-zone modules on each side, a module
 * is size / (N + 2m) pixels wide.
 */
export function marginPx(design: QrDesign, modules: number | null): number {
  if (!modules || design.margin <= 0) return 0;
  return Math.round((design.margin * design.size) / (modules + 2 * design.margin));
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
    margin: marginPx(design, moduleCount(data, design.errorLevel)),
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
