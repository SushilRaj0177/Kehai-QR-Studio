import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { QrDesign } from "../lib/design";
import type { QrKind } from "../lib/qrTypes";
import { getSiteLogo, siteDomain } from "../lib/siteLogo";

export type SiteLogoState = "off" | "idle" | "loading" | "found" | "none" | "dismissed";
export interface SiteLogoStatus {
  state: SiteLogoState;
  domain: string | null;
}

const PREF_KEY = "kqs.autoLogo";
const DEBOUNCE_MS = 700;

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

interface Options {
  kind: QrKind;
  payload: string | null;
  design: QrDesign;
  setDesign: Dispatch<SetStateAction<QrDesign>>;
  onFound: (domain: string, raisedErrorLevel: boolean) => void;
}

/**
 * For URL codes, finds the website's logo and puts it in the centre of the
 * code by default. Rules:
 * - a logo the user uploaded always wins and is never replaced;
 * - removing an auto logo remembers the domain, so it isn't re-added;
 * - changing to another site, another QR type, or turning the feature off
 *   removes a stale auto logo;
 * - adding one raises error correction to High (same as an upload).
 */
export function useSiteLogo({ kind, payload, design, setDesign, onFound }: Options) {
  const [enabled, setEnabledState] = useState<boolean>(readPref);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<SiteLogoStatus>({ state: "idle", domain: null });

  const designRef = useRef(design);
  designRef.current = design;
  const domain = kind === "url" && payload ? siteDomain(payload) : null;
  const { origin, siteDomain: logoDomain } = design.logo;

  useEffect(() => {
    // A site logo that no longer matches the current link (or the feature
    // was switched off) is stale: take it out.
    if (origin === "site" && (logoDomain !== domain || !enabled)) {
      setDesign((d) => (d.logo.origin === "site" ? { ...d, logo: { ...d.logo, src: null, origin: null, siteDomain: null } } : d));
    }

    if (!enabled) return setStatus({ state: "off", domain });
    if (!domain || origin === "upload") return setStatus({ state: "idle", domain });
    if (origin === "site" && logoDomain === domain) return setStatus({ state: "found", domain });
    if (dismissed.has(domain)) return setStatus({ state: "dismissed", domain });

    let cancelled = false;
    setStatus({ state: "loading", domain });
    const timer = window.setTimeout(async () => {
      const src = await getSiteLogo(domain);
      if (cancelled) return;
      if (!src) return setStatus({ state: "none", domain });
      const now = designRef.current;
      if (now.logo.origin === "upload") return setStatus({ state: "idle", domain });
      const raised = !now.logo.src && (now.errorLevel === "L" || now.errorLevel === "M");
      setDesign((d) =>
        d.logo.origin === "upload"
          ? d
          : {
              ...d,
              errorLevel: raised ? "H" : d.errorLevel,
              logo: { ...d.logo, src, origin: "site", siteDomain: domain },
            },
      );
      setStatus({ state: "found", domain });
      onFound(domain, raised);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // onFound/setDesign are stable callbacks from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, enabled, dismissed, origin, logoDomain]);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    try {
      localStorage.setItem(PREF_KEY, on ? "on" : "off");
    } catch {
      /* preference just won't persist */
    }
  }, []);

  /** Remember that the user removed this site's logo. */
  const dismiss = useCallback((d: string) => setDismissed((s) => new Set(s).add(d)), []);

  /** Undo a dismissal so the logo is fetched/added again. */
  const restore = useCallback((d: string) => {
    setDismissed((s) => {
      const next = new Set(s);
      next.delete(d);
      return next;
    });
  }, []);

  return { enabled, setEnabled, status, dismiss, restore };
}
