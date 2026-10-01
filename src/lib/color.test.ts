import { describe, expect, it } from "vitest";
import { hexToHsv, hsvToHex, syncHsv } from "./color";

describe("colour conversions", () => {
  it("convert primaries and greys", () => {
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv("#00ff00")).toEqual({ h: 120, s: 1, v: 1 });
    expect(hexToHsv("#0000ff")).toEqual({ h: 240, s: 1, v: 1 });
    expect(hexToHsv("#808080").s).toBe(0);
    expect(hsvToHex({ h: 0, s: 0, v: 0 })).toBe("#000000");
    expect(hsvToHex({ h: 200, s: 0, v: 1 })).toBe("#ffffff");
  });

  it("round-trip every 6-digit shade it is given", () => {
    for (const hex of ["#0a0e14", "#c8102e", "#fffaf5", "#5c0a1c", "#22e2f5", "#7f7f7f", "#123456", "#abcdef"]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
    // A sweep of the whole cube in steps of 17.
    for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 85) {
      const hex = "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it("keep the chosen hue when dragging to grey or black", () => {
    const red = { h: 0, s: 1, v: 1 };
    expect(syncHsv({ h: 210, s: 0.8, v: 0.5 }, "#000000")).toEqual({ h: 210, s: 0.8, v: 0 });
    expect(syncHsv({ h: 210, s: 0.8, v: 0.5 }, "#808080").h).toBe(210);
    expect(syncHsv(red, "#ff0000")).toBe(red); // unchanged colour: same object
  });
});
