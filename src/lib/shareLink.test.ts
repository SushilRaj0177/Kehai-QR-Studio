import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN, PRESETS, applyPreset } from "./design";
import { decodeShareLink, encodeShareLink, LINK_PREFIX } from "./shareLink";

const b64 = (o: unknown) => LINK_PREFIX + btoa(JSON.stringify(o));

describe("design links", () => {
  it("round-trip type, content (including UTF-8) and design", () => {
    const design = applyPreset(DEFAULT_DESIGN, PRESETS[1]);
    const fields = { text: "GDG · こんにちは 🌸" };
    const link = encodeShareLink("text", fields, design);
    expect(link).toMatch(/^#d=[A-Za-z0-9_-]+$/); // URL-safe
    expect(decodeShareLink(link)).toEqual({ kind: "text", fields, design });
  });

  it("never carry a logo image", () => {
    const design = { ...DEFAULT_DESIGN, logo: { ...DEFAULT_DESIGN.logo, src: "data:image/png;base64,AAAA", origin: "upload" as const, size: 0.3 } };
    const link = encodeShareLink("url", { url: "a.com" }, design);
    expect(link).not.toContain("AAAA");
    expect(decodeShareLink(link)!.design.logo).toEqual({ ...DEFAULT_DESIGN.logo, size: 0.3 });
  });

  it("sanitise hostile or broken input", () => {
    expect(decodeShareLink("#other")).toBeNull();
    expect(decodeShareLink("#d=%%%")).toBeNull();
    expect(decodeShareLink(b64({ v: 2, k: "url" }))).toBeNull();
    expect(decodeShareLink(b64({ v: 1, k: "evil" }))).toBeNull();

    const s = decodeShareLink(
      b64({
        v: 1,
        k: "wifi",
        f: { ssid: "Net", security: "<script>", hidden: "yes", extra: 1 },
        d: {
          size: 99999,
          margin: -5,
          foreground: "red; background:url(x)",
          errorLevel: "Z",
          dotStyle: "square",
          gradient: { rotation: 720 },
          logo: { src: "https://evil.example/x.png", size: 5 },
        },
      }),
    )!;
    expect(s.fields).toEqual({ ssid: "Net", security: "WPA" });
    expect(s.design.size).toBe(1024);
    expect(s.design.margin).toBe(0);
    expect(s.design.foreground).toBe(DEFAULT_DESIGN.foreground);
    expect(s.design.errorLevel).toBe("M");
    expect(s.design.gradient.rotation).toBe(360);
    expect(s.design.logo.src).toBeNull();
    expect(s.design.logo.size).toBe(0.4);
  });
});
