import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HAPTICS, TICK_GAP_MS, haptic, resetHaptics } from "./haptics";

describe("haptic()", () => {
  let vibrate: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    resetHaptics();
    vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
  });
  afterEach(() => {
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: undefined });
    vi.useRealTimers();
  });

  it("plays each named pattern", () => {
    expect(haptic("tap")).toBe(true);
    expect(haptic("success")).toBe(true);
    expect(vibrate.mock.calls).toEqual([[HAPTICS.tap], [HAPTICS.success]]);
  });

  it("merges ticks that come faster than the gap, so a fast drag doesn't hum", () => {
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    expect(haptic("tick")).toBe(true);
    now += TICK_GAP_MS - 1;
    expect(haptic("tick")).toBe(false);
    now += 2;
    expect(haptic("tick")).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("does nothing (and never throws) where vibration isn't available, e.g. iPhone Safari", () => {
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: undefined });
    expect(haptic("tap")).toBe(false);
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: () => { throw new Error("blocked"); } });
    expect(haptic("error")).toBe(false);
  });
});
