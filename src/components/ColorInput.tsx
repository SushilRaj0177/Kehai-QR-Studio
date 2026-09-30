import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function expand(hex: string): string {
  return hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
}

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

/** Native colour picker paired with an editable hex field. */
export function ColorInput({ id, label, value, onChange }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState(value);
  // Sync from outside (preset, swap, picker) — but not while the text
  // already represents this colour, or typing "#123456" would be
  // clobbered to "#112233" the moment "#123" became valid.
  useEffect(() => {
    setText((t) => (HEX.test(t.trim()) && expand(t.trim().toLowerCase()) === value.toLowerCase() ? t : value));
  }, [value]);
  const invalid = !HEX.test(text.trim());

  return (
    <div className="color-input">
      <label className="field__label" htmlFor={`${id}-hex`}>
        {label}
      </label>
      <div className={`color-input__row${invalid ? " is-invalid" : ""}`}>
        <input
          type="color"
          aria-label={t("{label} picker", { label })}
          value={expand(value)}
          onChange={(e) => onChange(e.target.value)}
          className="color-input__swatch"
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
    </div>
  );
}
