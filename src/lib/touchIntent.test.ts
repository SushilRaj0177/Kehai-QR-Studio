import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachTouchDrag, HOLD_MS } from "./touchIntent";

// jsdom has no Touch constructor: build minimal touch events by hand.
function fire(el: HTMLElement, type: string, x: number, y: number, fingers = 1) {
  const touch = { identifier: 1, clientX: x, clientY: y };
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "changedTouches", { value: [touch] });
  Object.defineProperty(e, "touches", { value: type === "touchend" ? [] : Array(fingers).fill(touch) });
  el.dispatchEvent(e);
  return e;
}

function setup(mode: "horizontal" | "hold") {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const h = { mode, onGrab: vi.fn(), onDrag: vi.fn(), onTap: vi.fn(), onRelease: vi.fn() };
  const off = attachTouchDrag(el, h);
  return { el, h, off };
}

describe("touch intent", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("a vertical swipe over a slider is a scroll: nothing changes", () => {
    const { el, h } = setup("horizontal");
    fire(el, "touchstart", 100, 100);
    for (let y = 104; y <= 160; y += 4) {
      const e = fire(el, "touchmove", 101, y);
      expect(e.defaultPrevented).toBe(false); // the page is allowed to scroll
    }
    fire(el, "touchend", 101, 160);
    expect(h.onGrab).not.toHaveBeenCalled();
    expect(h.onDrag).not.toHaveBeenCalled();
    expect(h.onTap).not.toHaveBeenCalled();
  });

  it("a clearly sideways drag takes over and keeps the page still", () => {
    const { el, h } = setup("horizontal");
    fire(el, "touchstart", 100, 100);
    fire(el, "touchmove", 112, 101);
    const e = fire(el, "touchmove", 140, 103);
    fire(el, "touchend", 140, 103);
    expect(h.onGrab).toHaveBeenCalledWith(100, 100);
    expect(h.onDrag).toHaveBeenLastCalledWith(140, 103, 40, 3);
    expect(e.defaultPrevented).toBe(true);
    expect(h.onRelease).toHaveBeenCalled();
  });

  it("a diagonal-ish scroll that is mostly vertical never grabs", () => {
    const { el, h } = setup("horizontal");
    fire(el, "touchstart", 100, 100);
    fire(el, "touchmove", 106, 110);
    fire(el, "touchmove", 130, 115); // later sideways movement is ignored
    expect(h.onGrab).not.toHaveBeenCalled();
    expect(h.onDrag).not.toHaveBeenCalled();
  });

  it("a clean tap sets the value; a long press without moving does not", () => {
    const { el, h } = setup("horizontal");
    fire(el, "touchstart", 50, 10);
    fire(el, "touchend", 50, 10);
    expect(h.onTap).toHaveBeenCalledWith(50, 10);
    h.onTap.mockClear();
    fire(el, "touchstart", 50, 10);
    vi.advanceTimersByTime(600);
    fire(el, "touchend", 50, 10);
    expect(h.onTap).not.toHaveBeenCalled();
  });

  it("2-D control: a quick swipe scrolls, press-and-hold grabs then drags in any direction", () => {
    const { el, h } = setup("hold");
    fire(el, "touchstart", 100, 100);
    fire(el, "touchmove", 100, 130); // moved before the hold: scroll
    vi.advanceTimersByTime(HOLD_MS + 50);
    fire(el, "touchend", 100, 130);
    expect(h.onGrab).not.toHaveBeenCalled();

    fire(el, "touchstart", 100, 100);
    vi.advanceTimersByTime(HOLD_MS + 10);
    expect(h.onGrab).toHaveBeenCalledWith(100, 100);
    const e = fire(el, "touchmove", 100, 140); // vertical drag now moves the thumb
    expect(e.defaultPrevented).toBe(true);
    expect(h.onDrag).toHaveBeenLastCalledWith(100, 140, 0, 40);
  });

  it("touching the handle grabs at once and drags in any direction, no hold needed", () => {
    const el = document.createElement("div");
    const h = { mode: "hold" as const, grabOnStart: vi.fn(() => true), onGrab: vi.fn(), onDrag: vi.fn() };
    attachTouchDrag(el, h);
    fire(el, "touchstart", 100, 100);
    expect(h.onGrab).toHaveBeenCalledWith(100, 100);
    const e = fire(el, "touchmove", 100, 150); // straight down: still a drag
    expect(e.defaultPrevented).toBe(true);
    expect(h.onDrag).toHaveBeenLastCalledWith(100, 150, 0, 50);
  });

  it("2-D control with sideways: a sideways drag grabs immediately, a vertical swipe still scrolls", () => {
    const el = document.createElement("div");
    const h = { mode: "hold" as const, sideways: true, onGrab: vi.fn(), onDrag: vi.fn() };
    attachTouchDrag(el, h);
    fire(el, "touchstart", 100, 100);
    fire(el, "touchmove", 100, 130);
    fire(el, "touchend", 100, 130);
    expect(h.onGrab).not.toHaveBeenCalled();
    fire(el, "touchstart", 100, 100);
    fire(el, "touchmove", 115, 102);
    expect(h.onGrab).toHaveBeenCalled();
    fire(el, "touchmove", 115, 160); // once grabbed, any direction
    expect(h.onDrag).toHaveBeenLastCalledWith(115, 160, 15, 60);
  });

  it("a second finger (pinch-zoom) never counts as a drag", () => {
    const { el, h } = setup("horizontal");
    fire(el, "touchstart", 100, 100);
    fire(el, "touchstart", 200, 100, 2);
    fire(el, "touchmove", 140, 100);
    expect(h.onGrab).not.toHaveBeenCalled();
  });
});
