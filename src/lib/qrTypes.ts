/**
 * QR content types: what the user can encode, the fields each type needs,
 * how those fields are validated, and how they are turned into the payload
 * string a phone's camera understands.
 *
 * Everything here is pure (no DOM, no React) so it is fully unit-tested.
 */
import { en, type Translate } from "../i18n/i18n";

export type QrKind = "url" | "text" | "email" | "phone" | "wifi" | "contact";

export type WifiSecurity = "WPA" | "WEP" | "nopass";

export interface UrlFields {
  url: string;
}
export interface TextFields {
  text: string;
}
export interface EmailFields {
  address: string;
  subject: string;
  body: string;
}
export interface PhoneFields {
  phone: string;
}
export interface WifiFields {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}

export interface ContactFields {
  name: string;
  org: string;
  phone: string;
  email: string;
  url: string;
}

export interface FieldsByKind {
  url: UrlFields;
  text: TextFields;
  email: EmailFields;
  phone: PhoneFields;
  wifi: WifiFields;
  contact: ContactFields;
}

/** Every kind's current field values, so switching tabs never loses input. */
export type AllFields = { [K in QrKind]: FieldsByKind[K] };

/** Field name -> error message. Empty object means valid. */
export type FieldErrors = Partial<Record<string, string>>;

export const KINDS: { id: QrKind; label: string; hint: string }[] = [
  { id: "url", label: "URL", hint: "Open a website" },
  { id: "text", label: "Text", hint: "Show plain text" },
  { id: "email", label: "Email", hint: "Draft an email" },
  { id: "phone", label: "Phone", hint: "Start a call" },
  { id: "wifi", label: "Wi-Fi", hint: "Join a network" },
  { id: "contact", label: "Contact", hint: "Save a contact" },
];

export const DEFAULT_FIELDS: AllFields = {
  url: { url: "" },
  text: { text: "" },
  email: { address: "", subject: "", body: "" },
  phone: { phone: "" },
  wifi: { ssid: "", password: "", security: "WPA", hidden: false },
  contact: { name: "", org: "", phone: "", email: "", url: "" },
};

/** Upper bound on payload size. A version-40 code at level L holds 2,953
 * bytes; staying well under keeps codes small enough to scan comfortably. */
export const MAX_TEXT_LENGTH = 1200;

// ---------------------------------------------------------------- URL

/** Adds https:// when the user typed a bare domain like "gdg.community.dev". */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function validateUrl(f: UrlFields, t: Translate = en): FieldErrors {
  const raw = f.url.trim();
  if (!raw) return { url: t("Enter a website address.") };
  if (/\s/.test(raw)) return { url: t("A URL can't contain spaces.") };
  let parsed: URL;
  try {
    parsed = new URL(normalizeUrl(raw));
  } catch {
    return { url: t("That doesn't look like a valid URL.") };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url: t("Only http:// and https:// links are supported.") };
  }
  const host = parsed.hostname;
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (host !== "localhost" && !isIp && !/\.[a-z]{2,}$/i.test(host)) {
    return { url: t("Add a domain ending, e.g. example.com.") };
  }
  if (raw.length > MAX_TEXT_LENGTH) return { url: t("Keep URLs under {max} characters.", { max: MAX_TEXT_LENGTH }) };
  return {};
}

// ---------------------------------------------------------------- Text

export function validateText(f: TextFields, t: Translate = en): FieldErrors {
  if (!f.text.trim()) return { text: t("Enter some text to encode.") };
  if (f.text.length > MAX_TEXT_LENGTH) {
    return { text: t("That's {n} characters — keep it under {max} so the code stays scannable.", { n: f.text.length, max: MAX_TEXT_LENGTH }) };
  }
  return {};
}

// ---------------------------------------------------------------- Email

// Deliberately practical rather than RFC-5322-complete: one @, a dotted
// domain, no spaces. This rejects the typos people actually make.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function validateEmail(f: EmailFields, t: Translate = en): FieldErrors {
  const errors: FieldErrors = {};
  const address = f.address.trim();
  if (!address) errors.address = t("Enter the recipient's email address.");
  else if (!EMAIL_RE.test(address)) errors.address = t("That email address isn't valid.");
  if (f.subject.length > 200) errors.subject = t("Keep the subject under 200 characters.");
  if (f.body.length > 800) errors.body = t("Keep the message under 800 characters.");
  return errors;
}

export function encodeEmail(f: EmailFields): string {
  const params: string[] = [];
  if (f.subject.trim()) params.push(`subject=${encodeURIComponent(f.subject.trim())}`);
  if (f.body.trim()) params.push(`body=${encodeURIComponent(f.body.trim())}`);
  return `mailto:${f.address.trim()}${params.length ? `?${params.join("&")}` : ""}`;
}

// ---------------------------------------------------------------- Phone

/** Keeps a leading + and the digits; drops spaces, dashes, dots, brackets. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

export function validatePhone(f: PhoneFields, t: Translate = en): FieldErrors {
  const raw = f.phone.trim();
  if (!raw) return { phone: t("Enter a phone number.") };
  if (raw.lastIndexOf("+") > 0) return { phone: t("A + can only appear at the start.") };
  if (!/^\+?[\d\s\-().]+$/.test(raw)) return { phone: t("Use digits, spaces, dashes or brackets only (and an optional leading +).") };
  const digits = raw.replace(/\D/g, "");
  // E.164 caps international numbers at 15 digits; 3 allows short codes
  // like emergency or service numbers.
  if (digits.length < 3) return { phone: t("That number is too short.") };
  if (digits.length > 15) return { phone: t("Phone numbers have at most 15 digits.") };
  return {};
}

// ---------------------------------------------------------------- Wi-Fi

/** The Wi-Fi QR format uses ; , : " and \ as syntax, so they must be escaped. */
export function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

export function validateWifi(f: WifiFields, t: Translate = en): FieldErrors {
  const errors: FieldErrors = {};
  const ssidBytes = new TextEncoder().encode(f.ssid).length;
  if (!f.ssid.trim()) errors.ssid = t("Enter the network name (SSID).");
  else if (ssidBytes > 32) errors.ssid = t("Network names are at most 32 bytes.");

  if (f.security === "WPA") {
    const isHexKey = /^[0-9a-f]{64}$/i.test(f.password);
    if (!f.password) errors.password = t("WPA/WPA2 networks need a password.");
    else if (!isHexKey && (f.password.length < 8 || f.password.length > 63)) {
      errors.password = t("WPA passwords are 8–63 characters (or a 64-digit hex key).");
    }
  } else if (f.security === "WEP") {
    const len = f.password.length;
    const ascii = len === 5 || len === 13;
    const hex = (len === 10 || len === 26) && /^[0-9a-f]+$/i.test(f.password);
    if (!f.password) errors.password = t("WEP networks need a key.");
    else if (!ascii && !hex) errors.password = t("WEP keys are 5 or 13 characters, or 10 or 26 hex digits.");
  }
  return errors;
}

export function encodeWifi(f: WifiFields): string {
  const parts = [`T:${f.security}`, `S:${escapeWifi(f.ssid)}`];
  if (f.security !== "nopass") parts.push(`P:${escapeWifi(f.password)}`);
  if (f.hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

// ---------------------------------------------------------------- Contact (vCard)

export function validateContact(f: ContactFields, t: Translate = en): FieldErrors {
  const errors: FieldErrors = {};
  if (!f.name.trim()) errors.name = t("Enter a name.");
  else if (f.name.length > 100) errors.name = t("Keep the name under 100 characters.");
  if (f.org.length > 100) errors.org = t("Keep the organisation under 100 characters.");
  if (f.phone.trim()) {
    const e = validatePhone({ phone: f.phone }, t).phone;
    if (e) errors.phone = e;
  }
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) errors.email = t("That email address isn't valid.");
  if (f.url.trim()) {
    const e = validateUrl({ url: f.url }, t).url;
    if (e) errors.url = e;
  }
  return errors;
}

/** vCard text values escape \ , ; and newlines (RFC 2426 §4). */
export function escapeVcard(value: string): string {
  return value.replace(/([\\,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

/** A vCard 3.0 card: phones offer "Add to contacts" when they scan it. */
export function encodeContact(f: ContactFields): string {
  const name = f.name.trim().replace(/\s+/g, " ");
  const parts = name.split(" ");
  const family = parts.length > 1 ? parts.pop()! : "";
  const given = parts.join(" ");
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${escapeVcard(family)};${escapeVcard(given)};;;`, `FN:${escapeVcard(name)}`];
  if (f.org.trim()) lines.push(`ORG:${escapeVcard(f.org.trim())}`);
  if (f.phone.trim()) lines.push(`TEL;TYPE=CELL:${normalizePhone(f.phone)}`);
  if (f.email.trim()) lines.push(`EMAIL:${f.email.trim()}`);
  if (f.url.trim()) lines.push(`URL:${normalizeUrl(f.url)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

// ---------------------------------------------------------------- dispatch

export function validate<K extends QrKind>(kind: K, fields: FieldsByKind[K], t: Translate = en): FieldErrors {
  switch (kind) {
    case "url":
      return validateUrl(fields as UrlFields, t);
    case "text":
      return validateText(fields as TextFields, t);
    case "email":
      return validateEmail(fields as EmailFields, t);
    case "phone":
      return validatePhone(fields as PhoneFields, t);
    case "wifi":
      return validateWifi(fields as WifiFields, t);
    case "contact":
      return validateContact(fields as ContactFields, t);
    default:
      return {};
  }
}

/** The payload to encode, or null while the input is invalid/incomplete. */
export function encode<K extends QrKind>(kind: K, fields: FieldsByKind[K]): string | null {
  if (Object.keys(validate(kind, fields)).length > 0) return null;
  switch (kind) {
    case "url":
      return normalizeUrl((fields as UrlFields).url);
    case "text":
      return (fields as TextFields).text;
    case "email":
      return encodeEmail(fields as EmailFields);
    case "phone":
      return `tel:${normalizePhone((fields as PhoneFields).phone)}`;
    case "wifi":
      return encodeWifi(fields as WifiFields);
    case "contact":
      return encodeContact(fields as ContactFields);
    default:
      return null;
  }
}

/** Short human label for history entries ("Wi-Fi · CampusNet"). */
export function describe<K extends QrKind>(kind: K, fields: FieldsByKind[K]): string {
  switch (kind) {
    case "url":
      return normalizeUrl((fields as UrlFields).url).replace(/^https?:\/\//, "");
    case "text":
      return (fields as TextFields).text.trim().slice(0, 60);
    case "email":
      return (fields as EmailFields).address.trim();
    case "phone":
      return (fields as PhoneFields).phone.trim();
    case "wifi":
      return (fields as WifiFields).ssid;
    case "contact":
      return (fields as ContactFields).name.trim();
    default:
      return "";
  }
}

/** True when the user hasn't typed anything yet (show a hint, not an error). */
export function isEmpty<K extends QrKind>(kind: K, fields: FieldsByKind[K]): boolean {
  switch (kind) {
    case "url":
      return !(fields as UrlFields).url.trim();
    case "text":
      return !(fields as TextFields).text.trim();
    case "email": {
      const e = fields as EmailFields;
      return !e.address.trim() && !e.subject.trim() && !e.body.trim();
    }
    case "phone":
      return !(fields as PhoneFields).phone.trim();
    case "wifi": {
      const w = fields as WifiFields;
      return !w.ssid && !w.password;
    }
    case "contact":
      return !Object.values(fields as ContactFields).some((v) => v.trim());
    default:
      return true;
  }
}
