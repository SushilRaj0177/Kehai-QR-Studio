import { useRef, useState, type ReactNode } from "react";
import {
  CORNER_DOT_STYLES,
  CORNER_STYLES,
  DOT_STYLES,
  ERROR_LEVELS,
  MARGIN_MAX,
  PRESETS,
  SIZE_MAX,
  SIZE_MIN,
  type QrDesign,
} from "../lib/design";
import { ColorInput } from "./ColorInput";
import { Icon } from "./icons";

interface Props {
  design: QrDesign;
  activePreset: string | null;
  onChange: (patch: Partial<QrDesign>) => void;
  onPreset: (id: string) => void;
  onLogo: (src: string | null) => void;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="design-section">
      <div className="design-section__head">
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Slider(props: { id: string; label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  const { id, label, value, min, max, step, unit, onChange } = props;
  return (
    <div className="slider">
      <div className="slider__head">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <span className="slider__value">
          <input
            aria-label={`${label} value`}
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
            }}
          />
          {unit}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.id} className={`chip${value === o.id ? " is-active" : ""}`}>
          <input type="radio" className="visually-hidden" name={label} checked={value === o.id} onChange={() => onChange(o.id)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function DesignPanel({ design, activePreset, onChange, onPreset, onLogo }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  function pickLogo(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml|gif)$/.test(file.type)) {
      setLogoError("Use a PNG, JPG, WebP, GIF or SVG image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("Logos must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLogo(String(reader.result));
    reader.onerror = () => setLogoError("Couldn't read that file.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="design-panel">
      <Section title="Presets" aside={<span className="muted small">{activePreset ? "Tweak anything below" : "Custom"}</span>}>
        <div className="presets">
          {PRESETS.map((p) => {
            const d = p.design;
            const style = d.gradient.enabled
              ? { background: `linear-gradient(${d.gradient.rotation}deg, ${d.foreground}, ${d.gradient.color})` }
              : { background: d.foreground };
            return (
              <button
                key={p.id}
                type="button"
                className={`preset${activePreset === p.id ? " is-active" : ""}`}
                aria-pressed={activePreset === p.id}
                onClick={() => onPreset(p.id)}
              >
                <span className="preset__swatch" style={{ background: d.background }}>
                  <span style={style} className={`preset__dot preset__dot--${d.dotStyle}`} />
                  <span style={style} className={`preset__dot preset__dot--${d.dotStyle}`} />
                  <span style={style} className={`preset__dot preset__dot--${d.dotStyle}`} />
                  <span style={style} className={`preset__dot preset__dot--${d.dotStyle}`} />
                </span>
                <span className="preset__text">
                  <span className="preset__name">{p.name}</span>
                  <span className="preset__note">{p.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Size & margin">
        <Slider id="size" label="Size" value={design.size} min={SIZE_MIN} max={SIZE_MAX} step={8} unit="px" onChange={(size) => onChange({ size })} />
        <Slider id="margin" label="Margin" value={design.margin} min={0} max={MARGIN_MAX} step={1} unit="px" onChange={(margin) => onChange({ margin })} />
      </Section>

      <Section
        title="Colours"
        aside={
          <button
            type="button"
            className="link-button"
            onClick={() => onChange({ foreground: design.background, background: design.foreground })}
          >
            Swap
          </button>
        }
      >
        <div className="grid-2">
          <ColorInput id="fg" label="Code" value={design.foreground} onChange={(foreground) => onChange({ foreground })} />
          <ColorInput id="bg" label="Background" value={design.background} onChange={(background) => onChange({ background })} />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={design.gradient.enabled}
            onChange={(e) => onChange({ gradient: { ...design.gradient, enabled: e.target.checked } })}
          />
          <span>Gradient</span>
        </label>
        {design.gradient.enabled && (
          <div className="gradient-row">
            <ColorInput
              id="gradient"
              label="Fade to"
              value={design.gradient.color}
              onChange={(color) => onChange({ gradient: { ...design.gradient, color } })}
            />
            <div>
              <span className="field__label">Type</span>
              <Chips
                label="Gradient type"
                options={[
                  { id: "linear", label: "Linear" },
                  { id: "radial", label: "Radial" },
                ]}
                value={design.gradient.type}
                onChange={(type) => onChange({ gradient: { ...design.gradient, type } })}
              />
            </div>
            {design.gradient.type === "linear" && (
              <Slider
                id="rotation"
                label="Angle"
                value={design.gradient.rotation}
                min={0}
                max={360}
                step={5}
                unit="°"
                onChange={(rotation) => onChange({ gradient: { ...design.gradient, rotation } })}
              />
            )}
          </div>
        )}
      </Section>

      <Section title="Error correction">
        <div className="segmented segmented--ec" role="radiogroup" aria-label="Error correction level">
          {ERROR_LEVELS.map((l) => (
            <label key={l.id} className={`segmented__item${design.errorLevel === l.id ? " is-active" : ""}`}>
              <input
                type="radio"
                name="ec"
                className="visually-hidden"
                checked={design.errorLevel === l.id}
                onChange={() => onChange({ errorLevel: l.id })}
              />
              <strong>{l.id}</strong>
              <span>{l.recovers}</span>
            </label>
          ))}
        </div>
        <p className="muted small">
          Higher levels survive damage, glare and logos, but make the code denser.
        </p>
      </Section>

      <Section title="Pattern">
        <span className="field__label">Modules</span>
        <Chips label="Module style" options={DOT_STYLES} value={design.dotStyle} onChange={(dotStyle) => onChange({ dotStyle })} />
        <div className="grid-2">
          <div>
            <span className="field__label">Corner frames</span>
            <Chips label="Corner frame style" options={CORNER_STYLES} value={design.cornerStyle} onChange={(cornerStyle) => onChange({ cornerStyle })} />
          </div>
          <div>
            <span className="field__label">Corner centres</span>
            <Chips
              label="Corner centre style"
              options={CORNER_DOT_STYLES}
              value={design.cornerDotStyle}
              onChange={(cornerDotStyle) => onChange({ cornerDotStyle })}
            />
          </div>
        </div>
      </Section>

      <Section title="Logo">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          className="visually-hidden"
          aria-label="Upload logo"
          data-testid="logo-input"
          onChange={(e) => {
            pickLogo(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {design.logo.src ? (
          <div className="logo-row">
            <img src={design.logo.src} alt="Uploaded logo" className="logo-row__thumb" />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
              Replace
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onLogo(null)}>
              Remove
            </button>
          </div>
        ) : (
          <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" />
            <span>Add a centre logo</span>
            <span className="muted small">PNG, JPG, SVG · under 2 MB</span>
          </button>
        )}
        {logoError && (
          <p className="field__error" role="alert">
            {logoError}
          </p>
        )}
        {design.logo.src && (
          <>
            <Slider
              id="logo-size"
              label="Logo size"
              value={Math.round(design.logo.size * 100)}
              min={10}
              max={40}
              step={1}
              unit="%"
              onChange={(v) => onChange({ logo: { ...design.logo, size: v / 100 } })}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={design.logo.hideDots}
                onChange={(e) => onChange({ logo: { ...design.logo, hideDots: e.target.checked } })}
              />
              <span>Clear modules behind the logo</span>
            </label>
          </>
        )}
      </Section>
    </div>
  );
}
