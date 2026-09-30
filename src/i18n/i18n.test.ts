import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CORNER_DOT_STYLES, CORNER_STYLES, DOT_STYLES, PRESETS } from "../lib/design";
import { KINDS, validateUrl } from "../lib/qrTypes";
import { analyze } from "../lib/readability";
import { DEFAULT_DESIGN } from "../lib/design";
import { en, format, translator } from "./i18n";
import { JA } from "./ja";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) && !name.includes(".test.") ? [p] : [];
  });
}

/** Every literal t("...") in the app. */
const literalKeys = new Set(
  sources(join(__dirname, "..")).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string),
  ),
);

/** Labels that reach t() through a variable (tabs, chips, presets, placeholders). */
const dataKeys = [
  ...KINDS.flatMap((k) => [k.label, k.hint]),
  ...DOT_STYLES.map((o) => o.label),
  ...CORNER_STYLES.map((o) => o.label),
  ...CORNER_DOT_STYLES.map((o) => o.label),
  ...PRESETS.flatMap((p) => [p.name, p.note]),
  "Small",
  "Blurry",
  "Dim light",
  "Seen at 120 px, like a small print from arm's length",
  "Slightly out of focus",
  "Contrast crushed, like a dark room",
  "Linear",
  "Radial",
  "None",
  "Enter a link to see your code.",
  "Type some text to see your code.",
  "Add a recipient to see your code.",
  "Enter a number to see your code.",
  "Enter your network details to see your code.",
  "Enter a name to see your code.",
];

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Japanese translations", () => {
  it("cover every UI string", () => {
    expect(literalKeys.size).toBeGreaterThan(150);
    const missing = [...literalKeys, ...dataKeys].filter((k) => !(k in JA));
    expect(missing).toEqual([]);
  });

  it("have no leftover entries for strings the app no longer uses", () => {
    const used = new Set([...literalKeys, ...dataKeys]);
    expect(Object.keys(JA).filter((k) => !used.has(k))).toEqual([]);
  });

  it("keep the same {placeholders} as the English text", () => {
    for (const [key, ja] of Object.entries(JA)) expect([key, placeholders(ja)]).toEqual([key, placeholders(key)]);
  });
});

describe("translator", () => {
  it("fills placeholders in both languages and falls back to English", () => {
    expect(format("{n} min ago", { n: 5 })).toBe("5 min ago");
    expect(translator("ja")("{n} min ago", { n: 5 })).toBe("5 分前");
    expect(translator("ja")("Not in the dictionary")).toBe("Not in the dictionary");
    expect(translator("en")).toBe(en);
  });

  it("translates validation and readability messages", () => {
    const ja = translator("ja");
    expect(validateUrl({ url: "" }, ja).url).toBe("ウェブサイトのアドレスを入力してください。");
    const issues = analyze("https://example.com", { ...DEFAULT_DESIGN, foreground: "#777777", background: "#888888" }, ja);
    expect(issues.find((i) => i.id === "contrast")?.title).toMatch(/^コントラスト不足/);
  });
});
