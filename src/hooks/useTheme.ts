import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type Theme = "dark" | "light";
const KEY = "kqs.theme";

function initialTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  return set === "light" ? "light" : "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#05070a" : "#f6f3ee");
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage disabled: theme still applies for this visit */
    }
  }, [theme]);

  /**
   * Switch theme. With View Transitions the new theme is revealed as a
   * circle growing from the pressed button; otherwise it switches
   * instantly (never a slow cross-fade through grey).
   */
  const toggle = useCallback(
    (origin?: { x: number; y: number }) => {
      const next: Theme = theme === "dark" ? "light" : "dark";
      const apply = () => {
        document.documentElement.dataset.theme = next;
        flushSync(() => setTheme(next));
      };
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
      if (!doc.startViewTransition || reduced) {
        document.documentElement.classList.add("theme-switching");
        apply();
        requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove("theme-switching")));
        return;
      }
      const x = origin?.x ?? window.innerWidth - 40;
      const y = origin?.y ?? 40;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const transition = doc.startViewTransition(apply);
      transition.ready
        .then(() =>
          document.documentElement.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 560, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
          ),
        )
        .catch(() => {});
    },
    [theme],
  );
  return { theme, toggle };
}
