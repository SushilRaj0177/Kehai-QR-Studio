import { KINDS, normalizeUrl, type AllFields, type FieldErrors, type QrKind, type WifiSecurity } from "../lib/qrTypes";
import { Field } from "./Field";
import { KindIcon } from "./icons";
import { rich, useI18n } from "../i18n/I18nContext";

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
  const { t } = useI18n();
  const err = (name: string) => (visible.has(name) ? errors[name] : undefined);

  return (
    <div className="content-form">
      <div className="kind-tabs" role="radiogroup" aria-label={t("QR code type")}>
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
            <span className="kind-tab__label">{t(k.label)}</span>
            <span className="kind-tab__hint">{t(k.hint)}</span>
          </label>
        ))}
      </div>

      <div className="fields" key={kind}>
        {kind === "url" && (
          <Field
            id="url"
            label={t("Website URL")}
            error={err("url")}
            hint={
              fields.url.url.trim() && !errors.url && normalizeUrl(fields.url.url) !== fields.url.url.trim()
                ? rich(t("Will open {url}"), { url: <code>{normalizeUrl(fields.url.url)}</code> })
                : t("Paste a link — https:// is added if you leave it out.")
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
            label={t("Text")}
            error={err("text")}
            hint={t("{n} characters · shown as-is when scanned", { n: fields.text.text.length })}
          >
            {(d) => (
              <textarea
                id="text"
                className="input input--area"
                rows={4}
                placeholder={t("Anything — a note, a code, a message…")}
                value={fields.text.text}
                aria-invalid={!!err("text")}
                aria-describedby={d}
                onChange={(e) => onChange("text", { text: e.target.value })}
                onBlur={() => onTouch("text")}
              />
            )}
          </Field>
        )}
        {kind === "text" && (
          <p className="kind-note" data-testid="text-scan-note">
            {t("Some phone camera apps only pop up for links, so plain text can look like it “didn't scan”. Google Lens or any QR scanner app shows the text.")}
          </p>
        )}

        {kind === "email" && (
          <>
            <Field id="email-address" label={t("To")} error={err("address")}>
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
            <Field id="email-subject" label={t("Subject")} optional error={err("subject")}>
              {(d) => (
                <input
                  id="email-subject"
                  className="input"
                  type="text"
                  placeholder={t("Hello!")}
                  value={fields.email.subject}
                  aria-invalid={!!err("subject")}
                  aria-describedby={d}
                  onChange={(e) => onChange("email", { subject: e.target.value })}
                  onBlur={() => onTouch("subject")}
                />
              )}
            </Field>
            <Field id="email-body" label={t("Message")} optional error={err("body")}>
              {(d) => (
                <textarea
                  id="email-body"
                  className="input input--area"
                  rows={3}
                  placeholder={t("Pre-filled message body")}
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
            label={t("Phone number")}
            error={err("phone")}
            hint={t("Include the country code (e.g. +91) so it works from anywhere.")}
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
            <Field id="wifi-ssid" label={t("Network name (SSID)")} error={err("ssid")}>
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
            <Field id="wifi-security" label={t("Security")}>
              {(d) => (
                <div className="segmented" role="radiogroup" aria-label={t("Wi-Fi security")} aria-describedby={d}>
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
                      {t(label)}
                    </label>
                  ))}
                </div>
              )}
            </Field>
            {fields.wifi.security !== "nopass" && (
              <Field id="wifi-password" label={t("Password")} error={err("password")}>
                {(d) => (
                  <input
                    id="wifi-password"
                    className="input"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={fields.wifi.security === "WEP" ? t("5 or 13 characters") : t("8–63 characters")}
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
              <span>{t("Hidden network")}</span>
            </label>
          </>
        )}

        {kind === "contact" && (
          <>
            <Field id="contact-name" label={t("Name")} optional error={err("name")}>
              {(d) => (
                <input
                  id="contact-name"
                  className="input"
                  type="text"
                  autoComplete="name"
                  placeholder="Sushil Raj"
                  value={fields.contact.name}
                  aria-invalid={!!err("name")}
                  aria-describedby={d}
                  onChange={(e) => onChange("contact", { name: e.target.value })}
                  onBlur={() => onTouch("name")}
                />
              )}
            </Field>
            <div className="grid-2">
              <Field id="contact-phone" label={t("Phone number")} error={err("phone")} hint={t("Scanning offers “Add to contacts”.")}>
                {(d) => (
                  <input
                    id="contact-phone"
                    className="input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    value={fields.contact.phone}
                    aria-invalid={!!err("phone")}
                    aria-describedby={d}
                    onChange={(e) => onChange("contact", { phone: e.target.value })}
                    onBlur={() => onTouch("phone")}
                  />
                )}
              </Field>
              <Field id="contact-email" label={t("Email")} optional error={err("email")}>
                {(d) => (
                  <input
                    id="contact-email"
                    className="input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={fields.contact.email}
                    aria-invalid={!!err("email")}
                    aria-describedby={d}
                    onChange={(e) => onChange("contact", { email: e.target.value })}
                    onBlur={() => onTouch("email")}
                  />
                )}
              </Field>
              <Field id="contact-org" label={t("Organisation")} optional error={err("org")}>
                {(d) => (
                  <input
                    id="contact-org"
                    className="input"
                    type="text"
                    autoComplete="organization"
                    placeholder="GDG on Campus SRM"
                    value={fields.contact.org}
                    aria-invalid={!!err("org")}
                    aria-describedby={d}
                    onChange={(e) => onChange("contact", { org: e.target.value })}
                    onBlur={() => onTouch("org")}
                  />
                )}
              </Field>
              <Field id="contact-url" label={t("Website")} optional error={err("url")}>
                {(d) => (
                  <input
                    id="contact-url"
                    className="input"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    spellCheck={false}
                    placeholder="github.com/you"
                    value={fields.contact.url}
                    aria-invalid={!!err("url")}
                    aria-describedby={d}
                    onChange={(e) => onChange("contact", { url: e.target.value })}
                    onBlur={() => onTouch("url")}
                  />
                )}
              </Field>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
