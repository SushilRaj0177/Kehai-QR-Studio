import { useEffect } from "react";
import { haptic } from "../lib/haptics";

const PRESSABLE =
  ".btn, .icon-button, .lang-toggle, .chip, .kind-tab, .preset, .segmented__item, .link-button, .dropzone, .recent-card__use, .color-input__swatch, .color-picker__swatch, .download__item";

/** A finger that moves this far before lifting is scrolling, not tapping. */
export const TAP_SLOP_PX = 10;
/** Like a native Android button: a finger's ripple waits this long for a scroll to show itself. */
export const TOUCH_RIPPLE_DELAY_MS = 90;

/**
 * One delegated listener gives every pressable element a ripple that
 * starts exactly where the finger or cursor landed, plus a light haptic
 * tap for fingers. The ripple is purely decorative: it adds a span that
 * removes itself, and is skipped for reduced motion (the tap isn't motion).
 *
 * A finger landing on a button may be starting a scroll, so touch is
 * judged like a native button: the ripple starts after a short delay, the
 * haptic tap only once the finger lifts on the same element without having
 * moved, and both are dropped the moment the browser takes the touch over
 * for scrolling (pointercancel) or the finger travels past the slop.
 * A mouse or pen gets its ripple instantly and never buzzes.
 */
export function usePressRipple() {
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    const ripple = (el: HTMLElement, clientX: number, clientY: number) => {
      if (reduced?.matches) return;
      const r = el.getBoundingClientRect();
      const x = clientX - r.left;
      const y = clientY - r.top;
      // Big enough to reach the farthest corner from the press point.
      const size = 2 * Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));
      const span = document.createElement("span");
      span.className = "ripple";
      span.setAttribute("aria-hidden", "true");
      span.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`;
      el.appendChild(span);
      span.addEventListener("animationend", () => span.remove(), { once: true });
      window.setTimeout(() => span.remove(), 1000); // in case animations are off
    };

    // The touch currently being judged: tap or scroll?
    let touch: { id: number; el: HTMLElement; x: number; y: number; timer: number; rippled: boolean } | null = null;
    const drop = () => {
      if (touch) window.clearTimeout(touch.timer);
      touch = null;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(PRESSABLE);
      if (!el || (el as HTMLButtonElement).disabled) return;
      if (e.pointerType !== "touch") return ripple(el, e.clientX, e.clientY);
      drop();
      const t = { id: e.pointerId, el, x: e.clientX, y: e.clientY, timer: 0, rippled: false };
      t.timer = window.setTimeout(() => {
        if (touch !== t) return;
        t.rippled = true;
        ripple(el, t.x, t.y);
      }, TOUCH_RIPPLE_DELAY_MS);
      touch = t;
    };
    const onMove = (e: PointerEvent) => {
      if (touch && e.pointerId === touch.id && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > TAP_SLOP_PX) drop();
    };
    const onUp = (e: PointerEvent) => {
      const t = touch;
      if (!t || e.pointerId !== t.id) return;
      drop();
      // Lifted somewhere else, or after moving: not a tap.
      const over = document.elementFromPoint(e.clientX, e.clientY);
      if (!over || !t.el.contains(over) || Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP_PX) return;
      if (!t.rippled) ripple(t.el, t.x, t.y); // a quick tap: ripple on release
      haptic("tap");
    };
    const onCancel = (e: PointerEvent) => {
      if (touch && e.pointerId === touch.id) drop(); // the browser took it for a scroll
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointercancel", onCancel, { passive: true });
    return () => {
      drop();
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
    };
  }, []);
}
