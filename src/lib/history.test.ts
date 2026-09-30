import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN } from "./design";
import { addRecent, loadRecent, MAX_RECENT, removeRecent, saveRecent, STORAGE_KEY, type RecentEntry } from "./history";

const entry = (i: number, patch: Partial<RecentEntry> = {}): RecentEntry => ({
  id: `id-${i}`,
  kind: "url",
  fields: { url: `https://e${i}.com` },
  design: DEFAULT_DESIGN,
  payload: `https://e${i}.com`,
  label: `e${i}.com`,
  thumbnail: "data:image/png;base64,AAAA",
  createdAt: i,
  ...patch,
});

describe("recent history", () => {
  it("adds newest first and caps the list", () => {
    let list: RecentEntry[] = [];
    for (let i = 0; i < MAX_RECENT + 5; i++) list = addRecent(list, entry(i));
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0].id).toBe(`id-${MAX_RECENT + 4}`);
  });

  it("moves an identical code to the top instead of duplicating it", () => {
    let list = [entry(1), entry(2)];
    list = addRecent(list, entry(2, { id: "again" }));
    expect(list.map((e) => e.id)).toEqual(["again", "id-1"]);
  });

  it("treats the same content with a different design as a new entry", () => {
    const list = addRecent([entry(1)], entry(1, { id: "red", design: { ...DEFAULT_DESIGN, foreground: "#c8102e" } }));
    expect(list).toHaveLength(2);
  });

  it("drops oversized logos rather than blowing the storage quota", () => {
    const big = { ...DEFAULT_DESIGN, logo: { ...DEFAULT_DESIGN.logo, src: "x".repeat(200_000) } };
    expect(addRecent([], entry(1, { design: big }))[0].design.logo.src).toBeNull();
  });

  it("round-trips through storage", () => {
    const list = [entry(1), entry(2)];
    saveRecent(list);
    expect(loadRecent()).toEqual(list);
  });

  it("removes entries", () => {
    expect(removeRecent([entry(1), entry(2)], "id-1").map((e) => e.id)).toEqual(["id-2"]);
  });

  it("survives corrupt or foreign data", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadRecent()).toEqual([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ nope: true }, entry(3)]));
    expect(loadRecent().map((e) => e.id)).toEqual(["id-3"]);
  });

  it("trims the oldest entries when storage is full", () => {
    let calls = 0;
    const tiny = {
      setItem: (_k: string, v: string) => {
        calls++;
        if (v.length > 900) throw new DOMException("full", "QuotaExceededError");
      },
    } as unknown as Storage;
    const saved = saveRecent([entry(1), entry(2), entry(3), entry(4)], tiny);
    expect(saved.length).toBeLessThan(4);
    expect(saved[0].id).toBe("id-1");
    expect(calls).toBeGreaterThan(1);
  });
});
