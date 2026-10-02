/**
 * Scroll-friendly touch handling for sliders.
 *
 * On a phone, a finger that lands on a slider while scrolling must scroll
 * the page, not change the value. A touch only takes control when the
 * intent is clear:
 *  - "horizontal": the first movement is clearly sideways (1-D sliders);
 *  - "hold": the finger rests still for a moment first (the 2-D colour
 *    square, where any direction could be a drag);
 *  - or it's a clean tap (no movement, short), which sets the value there.
 * Anything else is left to the browser as a scroll (the element should
 * have `touch-action: pan-y`).
 */

export const SLOP_PX = 8; // movement before we decide what the gesture is
export const HOLD_MS = 220; // press-and-hold to grab a 2-D control
const TAP_MS = 350;

export interface TouchDragHandlers {
  mode: "horizontal" | "hold";
  /** The touch claimed the control (drag begins). Start values are at (x, y). */
  onGrab?(x: number, y: number): void;
  /** Dragging: current point and the offset from where the finger went down. */
  onDrag(x: number, y: number, dx: number, dy: number): void;
  /** A clean tap at (x, y). */
  onTap?(x: number, y: number): void;
  onRelease?(): void;
}

type State = "idle" | "pending" | "dragging" | "scrolling";

export function attachTouchDrag(el: HTMLElement, h: TouchDragHandlers): () => void {
  let state: State = "idle";
  let x0 = 0;
  let y0 = 0;
  let t0 = 0;
  let id = -1;
  let timer: number | undefined;

  const find = (list: TouchList) => Array.from(list).find((t) => t.identifier === id);
  const reset = () => {
    window.clearTimeout(timer);
    state = "idle";
    id = -1;
  };

  const onStart = (e: TouchEvent) => {
    if (e.touches.length > 1) {
      // Pinch-zoom or a second finger: never treat it as a drag.
      if (state === "dragging") h.onRelease?.();
      reset();
      return;
    }
    const t = e.changedTouches[0];
    id = t.identifier;
    x0 = t.clientX;
    y0 = t.clientY;
    t0 = performance.now();
    state = "pending";
    if (h.mode === "hold") {
      timer = window.setTimeout(() => {
        if (state !== "pending") return;
        state = "dragging";
        navigator.vibrate?.(8);
        h.onGrab?.(x0, y0);
      }, HOLD_MS);
    }
  };

  const onMove = (e: TouchEvent) => {
    const t = find(e.changedTouches);
    if (!t || state === "idle" || state === "scrolling") return;
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (state === "pending") {
      const moved = Math.hypot(dx, dy) >= SLOP_PX;
      if (!moved) return;
      if (h.mode === "horizontal" && Math.abs(dx) > Math.abs(dy) * 1.2) {
        state = "dragging";
        h.onGrab?.(x0, y0);
      } else {
        // Moved before claiming the control: it's a scroll. Hands off.
        window.clearTimeout(timer);
        state = "scrolling";
        return;
      }
    }
    // Dragging: keep the page still and follow the finger.
    if (e.cancelable) e.preventDefault();
    h.onDrag(t.clientX, t.clientY, dx, dy);
  };

  const onEnd = (e: TouchEvent) => {
    const t = find(e.changedTouches);
    if (!t) return;
    if (state === "pending" && performance.now() - t0 < TAP_MS) h.onTap?.(x0, y0);
    if (state === "dragging") h.onRelease?.();
    reset();
  };

  const onCancel = () => {
    if (state === "dragging") h.onRelease?.();
    reset();
  };

  el.addEventListener("touchstart", onStart, { passive: true });
  el.addEventListener("touchmove", onMove, { passive: false });
  el.addEventListener("touchend", onEnd);
  el.addEventListener("touchcancel", onCancel);
  return () => {
    reset();
    el.removeEventListener("touchstart", onStart);
    el.removeEventListener("touchmove", onMove);
    el.removeEventListener("touchend", onEnd);
    el.removeEventListener("touchcancel", onCancel);
  };
}
