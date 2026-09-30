import { KINDS, normalizeUrl, type AllFields, type FieldErrors, type QrKind, type WifiSecurity } from "../lib/qrTypes";
import { Field } from "./Field";
import { KindIcon } from "./icons";

interface Props {
  kind: QrKind;
  fields: AllFields;
  errors: FieldErrors;
  /** Field names whose errors should be shown (touched, or after a failed export). */
  visible: Set<string>;
  onKind: (kind: QrKind) => void;
  onChange: <K extends QrKind>(kind: K, patch: Partial<AllFields[K]>) => void;
  onTouch: (field: string) => void;
}

export function ContentForm({ kind, fields, errors, visible, onKind, onChange, onTouch }: Props) {
  const err = (name: string) => (visible.has(name) ? errors[name] : undefined);

  return (
    <div className="content-form">
      <div className="kind-tabs" role="radiogroup" aria-label="QR code type">
        {KINDS.map((k) => (
          <label key={k.id} className={`kind-tab${kind === k.id ? " is-active" : ""}`}>
            <input
              type="radio"
              name="qr-kind"
              value={k.id}
              checked={kind === k.id}
              onChange={() => onKind(k.id)}
              className="visually-hidden"
            />
            <KindIcon kind={k.id} />
            <span className="kind-tab__label">{k.label}</span>
            <span className="kind-tab__hint">{k.hint}</span>
          </label>
        ))}
      </div>

      <div className="fields" key={kind}>
        {kind === "url" && (
          <Field
            id="url"
            label="Website URL"
            error={err("url")}
            hint={
              fields.url.url.trim() && !errors.url && normalizeUrl(fields.url.url) !== fields.url.url.trim()
                ? <>Will open <code>{normalizeUrl(fields.url.url)}</code></>
                : "Paste a link — https:// is added if you leave it out."
            }
          >
            {(d) => (
              <input
                id="url"
                className="input"
                type="text"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                placeholder="gdg.community.dev/gdg-on-campus-srm"
                value={fields.url.url}
                aria-invalid={!!err("url")}
                aria-describedby={d}
                onChange={(e) => onChange("url", { url: e.target.value })}
                onBlur={() => onTouch("url")}
              />
            )}
          </Field>
        )}

        {kind === "text" && (
          <Field
            id="text"
            label="Text"
            error={err("text")}
            hint={`${fields.text.text.length} characters · shown as-is when scanned`}
          >
            {(d) => (
              <textarea
                id="text"
                className="input input--area"
                rows={4}
                placeholder="Anything — a note, a code, a message…"
                value={fields.text.text}
                aria-invalid={!!err("text")}
                aria-describedby={d}
                onChange={(e) => onChange("text", { text: e.target.value })}
                onBlur={() => onTouch("text")}
              />
            )}
          </Field>
        )}

        {kind === "email" && (
          <>
            <Field id="email-address" label="To" error={err("address")}>
              {(d) => (
                <input
                  id="email-address"
                  className="input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="technical@gdgsrm.com"
                  value={fields.email.address}
                  aria-invalid={!!err("address")}
                  aria-describedby={d}
                  onChange={(e) => onChange("email", { address: e.target.value })}
                  onBlur={() => onTouch("address")}
                />
              )}
            </Field>
            <Field id="email-subject" label="Subject" optional error={err("subject")}>
              {(d) => (
                <input
                  id="email-subject"
                  className="input"
                  type="text"
                  placeholder="Hello!"
                  value={fields.email.subject}
                  aria-invalid={!!err("subject")}
                  aria-describedby={d}
                  onChange={(e) => onChange("email", { subject: e.target.value })}
                  onBlur={() => onTouch("subject")}
                />
              )}
            </Field>
            <Field id="email-body" label="Message" optional error={err("body")}>
              {(d) => (
                <textarea
                  id="email-body"
                  className="input input--area"
                  rows={3}
                  placeholder="Pre-filled message body"
                  value={fields.email.body}
                  aria-invalid={!!err("body")}
                  aria-describedby={d}
                  onChange={(e) => onChange("email", { body: e.target.value })}
                  onBlur={() => onTouch("body")}
                />
              )}
            </Field>
          </>
        )}

        {kind === "phone" && (
          <Field
            id="phone"
            label="Phone number"
            error={err("phone")}
            hint="Include the country code (e.g. +91) so it works from anywhere."
          >
            {(d) => (
              <input
                id="phone"
                className="input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={fields.phone.phone}
                aria-invalid={!!err("phone")}
                aria-describedby={d}
                onChange={(e) => onChange("phone", { phone: e.target.value })}
                onBlur={() => onTouch("phone")}
              />
            )}
          </Field>
        )}

        {kind === "wifi" && (
          <>
            <Field id="wifi-ssid" label="Network name (SSID)" error={err("ssid")}>
              {(d) => (
                <input
                  id="wifi-ssid"
                  className="input"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="GDG-Guest"
                  value={fields.wifi.ssid}
                  aria-invalid={!!err("ssid")}
                  aria-describedby={d}
                  onChange={(e) => onChange("wifi", { ssid: e.target.value })}
                  onBlur={() => onTouch("ssid")}
                />
              )}
            </Field>
            <Field id="wifi-security" label="Security">
              {(d) => (
                <div className="segmented" role="radiogroup" aria-label="Wi-Fi security" aria-describedby={d}>
                  {(
                    [
                      ["WPA", "WPA/WPA2/WPA3"],
                      ["WEP", "WEP"],
                      ["nopass", "None"],
                    ] as [WifiSecurity, string][]
                  ).map(([value, label]) => (
                    <label key={value} className={`segmented__item${fields.wifi.security === value ? " is-active" : ""}`}>
                      <input
                        type="radio"
                        name="wifi-security"
                        className="visually-hidden"
                        checked={fields.wifi.security === value}
                        onChange={() => onChange("wifi", { security: value })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </Field>
            {fields.wifi.security !== "nopass" && (
              <Field id="wifi-password" label="Password" error={err("password")}>
                {(d) => (
                  <input
                    id="wifi-password"
                    className="input"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={fields.wifi.security === "WEP" ? "5 or 13 characters" : "8–63 characters"}
                    value={fields.wifi.password}
                    aria-invalid={!!err("password")}
                    aria-describedby={d}
                    onChange={(e) => onChange("wifi", { password: e.target.value })}
                    onBlur={() => onTouch("password")}
                  />
                )}
              </Field>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={fields.wifi.hidden}
                onChange={(e) => onChange("wifi", { hidden: e.target.checked })}
              />
              <span>Hidden network</span>
            </label>
          </>
        )}
      </div>
    </div>
  );
}
