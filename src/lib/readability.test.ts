import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN, PRESETS, applyPreset, type QrDesign } from "./design";
import { analyze, contrastRatio, geometry, luminance } from "./readability";

const url = "https://kehai-qr-studio.vercel.app";
const design = (patch: Partial<QrDesign>): QrDesign => ({ ...DEFAULT_DESIGN, ...patch });
const ids = (d: QrDesign, data = url) => analyze(data, d).map((i) => `${i.id}:${i.severity}`);

describe("colour math", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#fff")).toBeCloseTo(1, 5);
  });
});

describe("geometry", () => {
  it("computes the module grid and quiet zone", () => {
    const g = geometry(url, DEFAULT_DESIGN)!;
    expect(g.modules).toBe(29); // version 3 at level M
    expect(g.version).toBe(3);
    expect(g.modulePx).toBe(Math.floor((320 - 32) / 29));
  });

  it("returns null when the payload can't fit", () => {
    expect(geometry("x".repeat(4000), DEFAULT_DESIGN)).toBeNull();
  });
});

describe("analyze()", () => {
  it("passes the default design", () => {
    expect(analyze(url, DEFAULT_DESIGN)).toEqual([]);
  });

  it("passes every preset", () => {
    for (const p of PRESETS) expect(analyze(url, applyPreset(DEFAULT_DESIGN, p)), p.id).toEqual([]);
  });

  it("flags low and very low contrast", () => {
    expect(ids(design({ foreground: "#888888" }))).toContain("contrast:warn");
    expect(ids(design({ foreground: "#dddddd" }))).toContain("contrast:error");
  });

  it("checks the weak end of a gradient", () => {
    expect(ids(design({ gradient: { enabled: true, type: "linear", color: "#eeeeee", rotation: 0 } }))).toContain("contrast:error");
  });

  it("warns about inverted colours", () => {
    expect(ids(design({ foreground: "#ffffff", background: "#000000" }))).toContain("inverted:warn");
  });

  it("flags a missing or tight quiet zone", () => {
    expect(ids(design({ margin: 0 }))).toContain("quiet-zone:error");
    expect(ids(design({ margin: 12 }))).toContain("quiet-zone:warn");
  });

  it("flags tiny modules", () => {
    expect(ids(design({ size: 128, margin: 8 }), "x".repeat(300))).toContain("module-size:error");
  });

  it("weighs logo size against error correction", () => {
    const logo = (size: number) => ({ src: "data:image/png;base64,AAAA", size, hideDots: true });
    expect(ids(design({ errorLevel: "M", logo: logo(0.4) }))).toContain("logo:error");
    expect(ids(design({ errorLevel: "H", logo: logo(0.4) }))).toContain("logo:warn");
    expect(ids(design({ errorLevel: "H", logo: logo(0.2) }))).not.toContain("logo:warn");
  });

  it("asks for headroom with decorative modules", () => {
    expect(ids(design({ dotStyle: "dots", errorLevel: "L" }))).toContain("dot-style:warn");
    expect(ids(design({ dotStyle: "dots", errorLevel: "Q" }))).not.toContain("dot-style:warn");
  });

  it("reports overflow instead of crashing", () => {
    expect(ids(DEFAULT_DESIGN, "x".repeat(4000))).toEqual(["overflow:error"]);
  });
});
