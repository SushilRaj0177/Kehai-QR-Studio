import { useEffect } from "react";

/**
 * Bakes the page background (two glows + the big 符) into a small, blurred
 * image for each theme, once. <Glass> shows it inside every panel, so
 * panels look frosted while scrolling costs only a texture draw per frame
 * (a live backdrop-filter or CSS filter re-blurs on every frame).
 *
 * Rendered at 1/4 scale: smaller is faster, and upscaling adds softness.
 * Regenerated only when the viewport *width* changes (mobile URL bars
 * change the height during scrolling; that must not trigger work).
 */
const SCALE = 0.25;
const BLUR_PX = 14;

function themeVars(theme: "dark" | "light") {
  const probe = document.createElement("div");
  probe.dataset.theme = theme;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const vars = { bg: v("--bg"), glow1: v("--bg-glow-1"), glow2: v("--bg-glow-2"), kanji: v("--kanji") };
  probe.remove();
  return vars;
}

/** "rgba(r, g, b, a)" → same colour at alpha 0 (canvas gradients interpolate unpremultiplied). */
const clear = (c: string) => c.replace(/rgba?\(([^,]+),([^,]+),([^,)]+)(,[^)]+)?\)/, "rgba($1,$2,$3,0)");

function render(theme: "dark" | "light", w: number, h: number): string | null {
  const vars = themeVars(theme);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * SCALE));
  canvas.height = Math.max(1, Math.round(h * SCALE));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(SCALE, SCALE);
  if ("filter" in ctx) ctx.filter = `blur(${BLUR_PX}px)`;

  ctx.fillStyle = vars.bg;
  ctx.fillRect(-50, -50, w + 100, h + 100);

  // radial-gradient(RX RY at X Y, colour, transparent 60%), as in .backdrop.
  const glow = (cx: number, cy: number, rx: number, ry: number, colour: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx / ry, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
    g.addColorStop(0, colour);
    g.addColorStop(0.6, clear(colour));
    g.addColorStop(1, clear(colour));
    ctx.fillStyle = g;
    ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
    ctx.restore();
  };
  glow(0.12 * w, -0.1 * h, 900, 520, vars.glow1);
  glow(w, 1.1 * h, 800, 600, vars.glow2);

  // The big kanji, where the real one sits.
  const kanji = document.querySelector<HTMLElement>(".backdrop:not(.backdrop--frost) .backdrop__kanji");
  if (kanji) {
    const r = kanji.getBoundingClientRect();
    const k = getComputedStyle(kanji);
    ctx.font = `900 ${k.fontSize} ${k.fontFamily}`;
    ctx.fillStyle = vars.kanji;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("符", r.left + r.width / 2, r.top + r.height / 2);
  }
  return canvas.toDataURL("image/png");
}

export function useFrost() {
  useEffect(() => {
    let width = 0;
    let timer: number | undefined;
    const build = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      // Size to the larger viewport so a hiding URL bar never exposes an edge.
      const h = Math.max(window.innerHeight, window.screen?.height || 0);
      const root = document.documentElement.style;
      for (const theme of ["dark", "light"] as const) {
        const url = render(theme, width, h);
        if (url) root.setProperty(`--frost-${theme}`, `url("${url}")`);
      }
    };
    // The kanji font must be loaded before it's drawn into the canvas.
    const ready = document.fonts?.load ? document.fonts.load('900 100px "Noto Sans JP"', "符").catch(() => null) : Promise.resolve();
    ready.then(build);
    const onResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(build, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(timer);
    };
  }, []);
}
