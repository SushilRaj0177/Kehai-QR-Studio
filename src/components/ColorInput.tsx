import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clamp01, hsvToHex, syncHsv, type Hsv } from "../lib/color";
import { attachTouchDrag } from "../lib/touchIntent";
import { useI18n } from "../i18n/I18nContext";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function expand(hex: string): string {
  return hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
}

/** Quick picks: the presets' colours plus a spread of hues and neutrals. */
const SWATCHES = [
  "#0a0e14", "#000000", "#3f3f46", "#ffffff", "#fffaf5", "#c8102e", "#ff2d55",
  "#e85d04", "#b45309", "#15803d", "#0e7490", "#1d4ed8", "#6d28d9", "#7a1f4b",
];

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

// The EyeDropper API (Chromium desktop) picks any pixel on screen.
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
const EyeDropper = (globalThis as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;

/**
 * Colour field: a swatch that opens a full picker (saturation/brightness
 * square, hue bar, quick swatches, screen eyedropper where supported) and
 * an editable hex field. Built in-house instead of <input type="color">
 * because mobile browsers render that very differently, and some (Samsung
 * Internet) only offer a small fixed palette.
 */
export function ColorInput({ id, label, value, onChange }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => syncHsv({ h: 0, s: 0, v: 0 }, value));
  const rootRef = useRef<HTMLDivElement | null>(null);
  const swatchRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();

  // Sync from outside (preset, swap, hex field) — but not while the text
  // already represents this colour, or typing "#123456" would be
  // clobbered to "#112233" the moment "#123" became valid.
  useEffect(() => {
    setText((cur) => (HEX.test(cur.trim()) && expand(cur.trim().toLowerCase()) === value.toLowerCase() ? cur : value));
    setHsv((prev) => syncHsv(prev, value));
  }, [value]);
  const invalid = !HEX.test(text.trim());

  // Dragging fires far more often than the screen refreshes: send at most
  // one change per frame so the QR re-renders smoothly.
  const frame = useRef<number | null>(null);
  const pending = useRef<string | null>(null);
  const emit = useCallback(
    (next: Hsv) => {
      setHsv(next);
      pending.current = hsvToHex(next);
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (pending.current) onChange(pending.current);
      });
    },
    [onChange],
  );
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // Close on outside press or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  const close = () => {
    setOpen(false);
    swatchRef.current?.focus();
  };

  /** Mouse/pen drag for the square and the hue bar (touch is handled below). */
  const drag = (apply: (x: number, y: number) => void) => {
    const at = (e: PointerEvent<HTMLDivElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      apply(clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height));
    };
    return {
      onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === "touch") return;
        e.currentTarget.setPointerCapture(e.pointerId);
        at(e);
      },
      onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== "touch" && e.currentTarget.hasPointerCapture(e.pointerId)) at(e);
      },
    };
  };

  // Touch: scroll-friendly. A swipe across the picker scrolls the page.
  // Touching a thumb (the circle) grabs it at once and it follows the finger
  // in any direction; elsewhere a clearly sideways drag grabs too (and the
  // square also takes a short press-and-hold), and a clean tap sets the
  // value at that point.
  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const latest = useRef({ hsv, emit });
  latest.current = { hsv, emit };
  useEffect(() => {
    const sv = svRef.current;
    const hue = hueRef.current;
    if (!open || !sv || !hue) return;
    const frac = (el: HTMLElement, x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return [clamp01((x - r.left) / r.width), clamp01((y - r.top) / r.height)] as const;
    };
    const setSv = (x: number, y: number) => {
      const [fx, fy] = frac(sv, x, y);
      latest.current.emit({ ...latest.current.hsv, s: fx, v: 1 - fy });
    };
    const setHue = (x: number) => {
      const [fx] = frac(hue, x, 0);
      latest.current.emit({ ...latest.current.hsv, h: fx * 360 });
    };
    // A fingertip covers the 20 px thumb: accept touches within this radius.
    const HIT = 32;
    const svThumb = () => {
      const r = sv.getBoundingClientRect();
      const { s, v } = latest.current.hsv;
      return { x: r.left + s * r.width, y: r.top + (1 - v) * r.height };
    };
    const hueThumb = () => {
      const r = hue.getBoundingClientRect();
      return { x: r.left + (latest.current.hsv.h / 360) * r.width, y: r.top + r.height / 2 };
    };
    // When grabbed by its thumb, the thumb keeps its offset from the finger
    // instead of jumping its centre under the fingertip.
    let off = { x: 0, y: 0 };
    const offSv = attachTouchDrag(sv, {
      mode: "hold",
      sideways: true,
      grabOnStart: (x, y) => {
        const t = svThumb();
        const onThumb = Math.hypot(x - t.x, y - t.y) <= HIT;
        off = onThumb ? { x: t.x - x, y: t.y - y } : { x: 0, y: 0 };
        return onThumb;
      },
      onGrab: (x, y) => setSv(x + off.x, y + off.y),
      onDrag: (x, y) => setSv(x + off.x, y + off.y),
      onTap: (x, y) => {
        off = { x: 0, y: 0 };
        setSv(x, y);
      },
    });
    let hueOff = 0;
    const offHue = attachTouchDrag(hue, {
      mode: "horizontal",
      grabOnStart: (x, y) => {
        const t = hueThumb();
        const onThumb = Math.hypot(x - t.x, y - t.y) <= HIT;
        hueOff = onThumb ? t.x - x : 0;
        return onThumb;
      },
      onGrab: (x) => setHue(x + hueOff),
      onDrag: (x) => setHue(x + hueOff),
      onTap: (x) => {
        hueOff = 0;
        setHue(x);
      },
    });
    return () => {
      offSv();
      offHue();
    };
  }, [open]);

  const svKeys = (e: KeyboardEvent) => {
    if (e.key === "Escape") return close();
    const step = e.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: clamp01(hsv.s - step) },
      ArrowRight: { s: clamp01(hsv.s + step) },
      ArrowUp: { v: clamp01(hsv.v + step) },
      ArrowDown: { v: clamp01(hsv.v - step) },
    };
    if (!moves[e.key]) return;
    e.preventDefault();
    emit({ ...hsv, ...moves[e.key] });
  };
  const hueKeys = (e: KeyboardEvent) => {
    if (e.key === "Escape") return close();
    const step = e.shiftKey ? 15 : 1;
    const moves: Record<string, number> = {
      ArrowLeft: hsv.h - step,
      ArrowDown: hsv.h - step,
      ArrowRight: hsv.h + step,
      ArrowUp: hsv.h + step,
      Home: 0,
      End: 360,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    emit({ ...hsv, h: Math.min(360, Math.max(0, moves[e.key])) });
  };

  const pickFromScreen = async () => {
    if (!EyeDropper) return;
    try {
      const { sRGBHex } = await new EyeDropper().open();
      if (HEX.test(sRGBHex)) onChange(expand(sRGBHex.toLowerCase()));
    } catch {
      /* cancelled */
    }
  };

  const current = hsvToHex(hsv);

  return (
    <div className="color-input" ref={rootRef}>
      <label className="field__label" htmlFor={`${id}-hex`}>
        {label}
      </label>
      <div className={`color-input__row${invalid ? " is-invalid" : ""}`}>
        <button
          ref={swatchRef}
          type="button"
          className="color-input__swatch"
          style={{ background: value }}
          aria-label={t("{label} picker", { label })}
          aria-expanded={open}
          aria-controls={panelId}
          data-testid={`${id}-swatch`}
          onClick={() => setOpen((o) => !o)}
        />
        <input
          id={`${id}-hex`}
          className="color-input__hex"
          value={text}
          spellCheck={false}
          maxLength={7}
          aria-invalid={invalid}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setText(v);
            if (HEX.test(v.trim())) onChange(expand(v.trim().toLowerCase()));
          }}
          onBlur={() => setText(value)}
        />
      </div>

      {open && (
        <div className="color-picker" id={panelId} role="group" aria-label={t("{label} picker", { label })} data-testid={`${id}-picker`}>
          <div
            ref={svRef}
            className="color-picker__sv"
            style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
            role="slider"
            tabIndex={0}
            aria-label={t("Saturation and brightness")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-valuetext={current}
            data-testid={`${id}-sv`}
            onKeyDown={svKeys}
            {...drag((x, y) => emit({ ...hsv, s: x, v: 1 - y }))}
          >
            <span className="color-picker__thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: current }} />
          </div>
          <div
            ref={hueRef}
            className="color-picker__hue"
            role="slider"
            tabIndex={0}
            aria-label={t("Hue")}
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv.h)}
            data-testid={`${id}-hue`}
            onKeyDown={hueKeys}
            {...drag((x) => emit({ ...hsv, h: x * 360 }))}
          >
            <span className="color-picker__thumb color-picker__thumb--bar" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }} />
          </div>
          <div className="color-picker__swatches" role="group" aria-label={t("Suggested colours")}>
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-picker__swatch${c === value.toLowerCase() ? " is-active" : ""}`}
                style={{ background: c }}
                aria-label={c}
                aria-pressed={c === value.toLowerCase()}
                onClick={() => onChange(c)}
              />
            ))}
          </div>
          <div className="color-picker__foot">
            {EyeDropper && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={pickFromScreen}>
                {t("Pick from screen")}
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--sm color-picker__done" onClick={close}>
              {t("Done")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
