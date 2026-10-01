import { describe, expect, it } from "vitest";
import { PRODUCTION_ORIGIN, readTextPage, textPageUrl } from "./textPage";

describe("text pages", () => {
  it("round-trip any text through a URL-safe fragment", () => {
    for (const text of ["Prettiest soul! <3", "line one\nline two", "GDG · こんにちは 🌸", '<img src=x onerror="alert(1)">']) {
      const url = textPageUrl(text, PRODUCTION_ORIGIN);
      expect(url.startsWith(`${PRODUCTION_ORIGIN}/t/#`)).toBe(true);
      expect(url.split("#")[1]).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(readTextPage(new URL(url).hash)).toBe(text);
    }
  });

  it("reject missing or broken fragments", () => {
    expect(readTextPage("")).toBeNull();
    expect(readTextPage("#")).toBeNull();
    expect(readTextPage("#not base64!")).toBeNull();
    expect(readTextPage("#_w")).toBeNull(); // not valid UTF-8
  });
});
