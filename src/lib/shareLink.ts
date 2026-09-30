/**
 * Design links: the studio's state (type, content, design) packed into the
 * URL fragment, so a link reopens exactly the same code. The fragment is
 * never sent to a server.
 *
 * Links can come from anyone, so decoding trusts nothing: every value is
 * type-checked, enums are matched against the known options, numbers are
 * clamped and colours must be hex. Logos are never carried (no images from
 * strangers). A website's logo is simply looked up again.
 */
import {
  CORNER_DOT_STYLES,
  CORNER_STYLES,
  DEFAULT_DESIGN,
  DOT_STYLES,
  ERROR_LEVELS,
  MARGIN_MAX,
  SIZE_MAX,
  SIZE_MIN,
  type QrDesign,
} from "./design";
import { DEFAULT_FIELDS, KINDS, type AllFields, type QrKind } from "./qrTypes";

export const LINK_PREFIX = "#d=";
const MAX_STRING = 2000;

export interface SharedState {
  kind: QrKind;
  fields: Partial<AllFields[QrKind]>;
  design: QrDesign;
}

function toBase64Url(text: string): string {
  const bin = Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64: string): string {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeShareLink(kind: QrKind, fields: AllFields[QrKind], design: QrDesign): string {
  const { logo, ...rest } = design;
  const d = { ...rest, logo: { size: logo.size, hideDots: logo.hideDots } };
  return LINK_PREFIX + toBase64Url(JSON.stringify({ v: 1, k: kind, f: fields, d }));
}

const HEX = /^#[0-9a-f]{6}$/i;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : fallback;
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const hex = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

function sanitizeDesign(raw: unknown): QrDesign {
  const d = obj(raw);
  const g = obj(d.gradient);
  const l = obj(d.logo);
  const D = DEFAULT_DESIGN;
  return {
    size: Math.round(num(d.size, SIZE_MIN, SIZE_MAX, D.size)),
    margin: Math.round(num(d.margin, 0, MARGIN_MAX, D.margin)),
    foreground: hex(d.foreground, D.foreground),
    background: hex(d.background, D.background),
    gradient: {
      enabled: bool(g.enabled, D.gradient.enabled),
      type: oneOf(g.type, ["linear", "radial"] as const, D.gradient.type),
      color: hex(g.color, D.gradient.color),
      rotation: Math.round(num(g.rotation, 0, 360, D.gradient.rotation)),
    },
    errorLevel: oneOf(d.errorLevel, ERROR_LEVELS.map((e) => e.id), D.errorLevel),
    dotStyle: oneOf(d.dotStyle, DOT_STYLES.map((o) => o.id), D.dotStyle),
    cornerStyle: oneOf(d.cornerStyle, CORNER_STYLES.map((o) => o.id), D.cornerStyle),
    cornerDotStyle: oneOf(d.cornerDotStyle, CORNER_DOT_STYLES.map((o) => o.id), D.cornerDotStyle),
    logo: { ...D.logo, size: num(l.size, 0.1, 0.4, D.logo.size), hideDots: bool(l.hideDots, D.logo.hideDots) },
  };
}

function sanitizeFields(kind: QrKind, raw: unknown): Partial<AllFields[QrKind]> {
  const f = obj(raw);
  const out: Record<string, string | boolean> = {};
  for (const [key, def] of Object.entries(DEFAULT_FIELDS[kind])) {
    const v = f[key];
    if (typeof def === "string" && typeof v === "string") out[key] = v.slice(0, MAX_STRING);
    if (typeof def === "boolean" && typeof v === "boolean") out[key] = v;
  }
  if (kind === "wifi" && "security" in out) out.security = oneOf(out.security, ["WPA", "WEP", "nopass"] as const, "WPA");
  return out as Partial<AllFields[QrKind]>;
}

/** Parses a location hash; null if it isn't a (valid) design link. */
export function decodeShareLink(hash: string): SharedState | null {
  if (!hash.startsWith(LINK_PREFIX)) return null;
  try {
    const data = obj(JSON.parse(fromBase64Url(hash.slice(LINK_PREFIX.length))));
    if (data.v !== 1) return null;
    const kind = oneOf(data.k, KINDS.map((k) => k.id), "url");
    if (data.k !== kind) return null;
    return { kind, fields: sanitizeFields(kind, data.f), design: sanitizeDesign(data.d) };
  } catch {
    return null;
  }
}
