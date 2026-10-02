import { useEffect } from "react";

/**
 * Click anywhere and a few QR-themed kanji scatter from the pointer: they
 * fan out evenly, arc a little under "gravity", spin and fade, while a thin
 * ring expands from the click point. Kehai's signature touch, rebuilt for
 * the studio.
 *
 * One delegated listener, plain DOM + the Web Animations API (no React
 * re-renders), drawn in a single fixed overlay so it shows above every
 * panel. Only transform and opacity are animated.
 */
const GLYPHS = "符碼読印紋標点線色彩描刻模様光映形型";
const COUNT = 7;
const MAX_LIVE = 4; // bursts on screen at once; older ones are cleared first

// Places where a burst would get in the way of what you're doing.
const SKIP = [
  "input",
  "textarea",
  "select",
  "label.check",
  "[role=slider]",
  ".chip",
  ".segmented__item",
  ".kind-tab",
  ".color-picker",
].join(",");

function layer(): HTMLElement {
  let el = document.getElementById("kanji-bursts");
  if (!el) {
    el = document.createElement("div");
    el.id = "kanji-bursts";
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  }
  return el;
}

function burst(x: number, y: number) {
  const host = layer();
  while (host.childElementCount >= MAX_LIVE) host.firstElementChild?.remove();

  const group = document.createElement("div");
  group.className = "kburst";
  group.style.left = `${x}px`;
  group.style.top = `${y}px`;
  host.appendChild(group);

  const ring = document.createElement("span");
  ring.className = "kburst__ring";
  group.appendChild(ring);
  const animations = [
    ring.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0.8 },
        { transform: "translate(-50%, -50%) scale(1)", opacity: 0 },
      ],
      { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
    ),
  ];

  // Evenly spaced directions with a random twist, so the spray never clumps.
  const twist = Math.random() * Math.PI * 2;
  for (let i = 0; i < COUNT; i++) {
    const angle = twist + (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const reach = 48 + Math.random() * 46;
    const dx = Math.cos(angle) * reach;
    const dy = Math.sin(angle) * reach;
    const spin = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 120);
    const size = 12 + Math.random() * 6;

    const g = document.createElement("span");
    g.className = "kburst__glyph";
    g.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    g.style.fontSize = `${size}px`;
    group.appendChild(g);
    animations.push(
      g.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.3) rotate(0deg)", opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.6}px), calc(-50% + ${dy * 0.6}px)) scale(1.1) rotate(${spin * 0.5}deg)`, opacity: 1, offset: 0.3 },
          // A little gravity at the end of the flight.
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 18}px)) scale(0.8) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 760 + Math.random() * 160, delay: Math.random() * 50, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" },
      ),
    );
  }
  Promise.all(animations.map((a) => a.finished)).then(
    () => group.remove(),
    () => group.remove(),
  );
}

export function useKanjiBurst() {
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onClick = (e: MouseEvent) => {
      // detail is 0 for keyboard-activated clicks: bursts are for pointers.
      if (reduced?.matches || e.detail === 0 || e.button !== 0) return;
      if ((e.target as Element | null)?.closest(SKIP)) return;
      if (typeof Element.prototype.animate !== "function") return;
      burst(e.clientX, e.clientY);
    };
    document.addEventListener("click", onClick, { passive: true });
    return () => document.removeEventListener("click", onClick);
  }, []);
}
