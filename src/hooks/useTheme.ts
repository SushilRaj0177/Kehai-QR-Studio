import { useCallback, useEffect, useState } from "react";

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

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return { theme, toggle };
}
