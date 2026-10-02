import { afterEach, describe, expect, it, vi } from "vitest";
import { copyImage, isSamsungInternet } from "./exporting";

const png = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });

function mockClipboard(write: (items: unknown[]) => Promise<void>, supports?: (t: string) => boolean) {
  class FakeItem {
    constructor(public data: Record<string, unknown>) {}
    static supports = supports;
  }
  vi.stubGlobal("ClipboardItem", FakeItem);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write: vi.fn(write) } });
  return navigator.clipboard.write as unknown as ReturnType<typeof vi.fn>;
}

afterEach(() => vi.unstubAllGlobals());

describe("copyImage", () => {
  it("copies with the promise form when the browser accepts it", async () => {
    const write = mockClipboard(async () => {});
    const trace: string[] = [];
    await copyImage(Promise.resolve(png()), trace);
    expect(write).toHaveBeenCalledTimes(1);
    expect(trace).toEqual(["write(promise): ok"]);
  });

  it("a browser that never answers times out and retries with the finished image", async () => {
    let calls = 0;
    const write = mockClipboard(() => (++calls === 1 ? new Promise<void>(() => {}) : Promise.resolve()));
    const trace: string[] = [];
    await copyImage(Promise.resolve(png()), trace, 50);
    expect(write).toHaveBeenCalledTimes(2);
    expect(trace[0]).toMatch(/TimeoutError/);
    expect(trace[1]).toBe("write(blob): ok");
  });

  it("if both attempts hang, it fails (so the fallback runs) instead of hanging forever", async () => {
    mockClipboard(() => new Promise<void>(() => {}));
    await expect(copyImage(Promise.resolve(png()), [], 30)).rejects.toThrow(/No answer/);
  });

  it("asks ClipboardItem.supports first where available", async () => {
    const write = mockClipboard(async () => {}, (t) => t !== "image/png");
    await expect(copyImage(Promise.resolve(png()))).rejects.toThrow(/can't put PNG/);
    expect(write).not.toHaveBeenCalled();
  });
});

describe("isSamsungInternet", () => {
  it("recognises Samsung Internet but not Chrome", () => {
    expect(isSamsungInternet("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36")).toBe(true);
    expect(isSamsungInternet("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36")).toBe(false);
  });
});
