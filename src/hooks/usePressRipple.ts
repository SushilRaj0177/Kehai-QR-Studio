import { useEffect } from "react";

const PRESSABLE =
  ".btn, .icon-button, .lang-toggle, .chip, .kind-tab, .preset, .segmented__item, .link-button, .dropzone, .recent-card__use, .color-input__swatch, .color-picker__swatch";

/**
 * One delegated listener gives every pressable element a ripple that
 * starts exactly where the finger or cursor landed. Purely decorative:
 * it adds a span that removes itself, and is skipped for reduced motion.
 */
export function usePressRipple() {
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onDown = (e: PointerEvent) => {
      if (reduced?.matches || e.button !== 0) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(PRESSABLE);
      if (!el || (el as HTMLButtonElement).disabled) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      // Big enough to reach the farthest corner from the press point.
      const size = 2 * Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.setAttribute("aria-hidden", "true");
      ripple.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px`;
      el.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      window.setTimeout(() => ripple.remove(), 1000); // in case animations are off
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
}
