import { en, type Translate } from "../i18n/i18n";
import { marginPx, moduleCount, type ErrorLevel, type QrDesign } from "./design";

/**
 * Static readability analysis: rules of thumb that predict whether real
 * phone cameras will read a design, independent of the live decode check
 * (see scanCheck.ts). A decoder working on a perfect digital image is far
 * more forgiving than a camera at an angle in bad light, so a code can
 * "decode" and still deserve a warning.
 */

export type Severity = "error" | "warn";

export interface ReadabilityIssue {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
}

export interface Geometry {
  /** Modules (squares) per side, including finder patterns. */
  modules: number;
  /** QR version 1–40. */
  version: number;
  /** Rendered pixels per module. */
  modulePx: number;
  /** Quiet zone expressed in modules. */
  quietZoneModules: number;
}

// ------------------------------------------------------------ colour math

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance, 0 (black) – 1 (white). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ------------------------------------------------------------ geometry

/** Share of the symbol each error-correction level can reconstruct. */
export const RECOVERY: Record<ErrorLevel, number> = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 };

/**
 * Computes the code's module grid for this payload the same way the
 * renderer does (auto version, byte mode). Returns null if the payload is
 * too large to fit in any QR version at this error-correction level.
 */
export function geometry(data: string, design: QrDesign): Geometry | null {
  const modules = moduleCount(data, design.errorLevel);
  if (!modules) return null;
  const margin = marginPx(design, modules);
  // The renderer rounds modules down to whole pixels and centres the grid,
  // so the leftover pixels become extra quiet zone on each side.
  const modulePx = Math.floor((design.size - margin * 2) / modules);
  const quietPx = (design.size - modules * modulePx) / 2;
  return {
    modules,
    version: (modules - 17) / 4,
    modulePx,
    quietZoneModules: modulePx > 0 ? quietPx / modulePx : 0,
  };
}

// ------------------------------------------------------------ analysis

export function analyze(data: string, design: QrDesign, t: Translate = en): ReadabilityIssue[] {
  const issues: ReadabilityIssue[] = [];
  const geo = geometry(data, design);

  if (!geo) {
    issues.push({
      id: "overflow",
      severity: "error",
      title: t("Too much data"),
      detail: t("This content doesn't fit in a QR code at error-correction level {level}. Shorten it or lower the level.", { level: design.errorLevel }),
    });
    return issues;
  }

  // Contrast: check the base colour and, with a gradient, its other end —
  // the weakest point of the code decides whether it scans.
  const colours = design.gradient.enabled ? [design.foreground, design.gradient.color] : [design.foreground];
  const worst = Math.min(...colours.map((c) => contrastRatio(c, design.background)));
  const ratio = worst.toFixed(1);
  if (worst < 2) {
    issues.push({
      id: "contrast",
      severity: "error",
      title: t("Contrast too low ({ratio}:1)", { ratio }),
      detail: t("The code and background colours are too similar for cameras to separate. Aim for at least 4:1."),
    });
  } else if (worst < 4) {
    issues.push({
      id: "contrast",
      severity: "warn",
      title: t("Low contrast ({ratio}:1)", { ratio }),
      detail: t("May fail in dim light or on glossy prints. 4:1 or higher is recommended."),
    });
  }

  if (colours.some((c) => luminance(c) > luminance(design.background))) {
    issues.push({
      id: "inverted",
      severity: "warn",
      title: t("Inverted colours"),
      detail: t("A light code on a dark background only scans in apps that also try flipped colours (Google Lens and most current phone cameras do; some older scanner apps don't). A darker code than the background works everywhere."),
    });
  }

  if (geo.quietZoneModules < 1) {
    issues.push({
      id: "quiet-zone",
      severity: "error",
      title: t("No quiet zone"),
      detail: t("Scanners need empty space around the code to find its edges. Increase the margin to at least 2 modules (4 is ideal)."),
    });
  } else if (geo.quietZoneModules < 2) {
    issues.push({
      id: "quiet-zone",
      severity: "warn",
      title: t("Tight margin"),
      detail: t("The margin is about {n} modules wide. 4 modules is the standard; below 2 some scanners struggle.", { n: geo.quietZoneModules.toFixed(1) }),
    });
  }

  if (geo.modulePx < 2) {
    issues.push({
      id: "module-size",
      severity: "error",
      title: t("Modules too small"),
      detail: t("Each square is under 2px at this size. Increase the size or shorten the content."),
    });
  } else if (geo.modulePx < 3) {
    issues.push({
      id: "module-size",
      severity: "warn",
      title: t("Small modules"),
      detail: t("Each square is only {n}px. Increase the size for screens, and print at 2 cm or larger.", { n: geo.modulePx }),
    });
  }

  if (design.logo.src) {
    const coverage = design.logo.size ** 2;
    const capacity = RECOVERY[design.errorLevel];
    const pct = Math.round(coverage * 100);
    if (coverage > capacity * 0.8) {
      issues.push({
        id: "logo",
        severity: "error",
        title: t("Logo covers too much"),
        detail: t("The logo hides about {pct}% of the code, but level {level} only recovers ~{cap}%. Shrink the logo or raise error correction to High.", { pct, level: design.errorLevel, cap: Math.round(capacity * 100) }),
      });
    } else if (coverage > capacity * 0.5) {
      issues.push({
        id: "logo",
        severity: "warn",
        title: t("Large logo"),
        detail: t("The logo hides about {pct}% of the code — over half of what level {level} can recover. Consider High error correction.", { pct, level: design.errorLevel }),
      });
    }
  }

  if ((design.dotStyle === "dots" || design.dotStyle === "classy") && (design.errorLevel === "L" || design.errorLevel === "M")) {
    issues.push({
      id: "dot-style",
      severity: "warn",
      title: t("Decorative modules need headroom"),
      detail: t("Round and cut-corner modules leave less ink for the camera. Use error correction Q or H with this style."),
    });
  }

  if (geo.version >= 15) {
    issues.push({
      id: "density",
      severity: "warn",
      title: t("Very dense code"),
      detail: t("This content needs a {n}×{n} grid. Shorten it, or print large, so phones can resolve every module.", { n: geo.modules }),
    });
  }

  return issues;
}
