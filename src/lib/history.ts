import type { QrDesign } from "./design";
import type { AllFields, QrKind } from "./qrTypes";

/**
 * Recent QR codes, persisted in localStorage so they survive a refresh.
 * Each entry stores everything needed to restore the editor exactly
 * (kind, the kind's fields, full design) plus a small thumbnail.
 */

export interface RecentEntry {
  id: string;
  kind: QrKind;
  fields: AllFields[QrKind];
  design: QrDesign;
  /** The encoded payload, used for de-duplication. */
  payload: string;
  label: string;
  thumbnail: string;
  createdAt: number;
}

export const STORAGE_KEY = "kqs.recent.v1";
export const MAX_RECENT = 12;
/** Logos above this size are dropped from history to protect the ~5 MB quota. */
export const MAX_STORED_LOGO_CHARS = 150_000;

export function loadRecent(storage: Storage = localStorage): RecentEntry[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, MAX_RECENT);
  } catch {
    // Corrupt JSON or storage disabled (private mode): start fresh.
    return [];
  }
}

function isEntry(v: unknown): v is RecentEntry {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.kind === "string" &&
    typeof e.payload === "string" &&
    typeof e.thumbnail === "string" &&
    typeof e.createdAt === "number" &&
    !!e.design &&
    !!e.fields
  );
}

/** Same content and same look = same entry (bumped to the top, not duplicated). */
export function fingerprint(entry: Pick<RecentEntry, "payload" | "design">): string {
  return JSON.stringify([entry.payload, { ...entry.design, logo: { ...entry.design.logo, src: entry.design.logo.src?.slice(-64) ?? null } }]);
}

export function addRecent(list: RecentEntry[], entry: RecentEntry): RecentEntry[] {
  const safe: RecentEntry =
    entry.design.logo.src && entry.design.logo.src.length > MAX_STORED_LOGO_CHARS
      ? { ...entry, design: { ...entry.design, logo: { ...entry.design.logo, src: null } } }
      : entry;
  const key = fingerprint(safe);
  return [safe, ...list.filter((e) => fingerprint(e) !== key)].slice(0, MAX_RECENT);
}

export function removeRecent(list: RecentEntry[], id: string): RecentEntry[] {
  return list.filter((e) => e.id !== id);
}

/**
 * Persist, trimming the oldest entries if the browser's quota is exceeded.
 * Returns the list that was actually saved.
 */
export function saveRecent(list: RecentEntry[], storage: Storage = localStorage): RecentEntry[] {
  let toSave = list;
  while (true) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      return toSave;
    } catch {
      if (toSave.length === 0) return toSave;
      toSave = toSave.slice(0, -1);
    }
  }
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
