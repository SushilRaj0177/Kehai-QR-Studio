import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContentForm } from "./components/ContentForm";
import { DesignPanel } from "./components/DesignPanel";
import { Preview } from "./components/Preview";
import { RecentList } from "./components/RecentList";
import { KehaiCallout } from "./components/KehaiCallout";
import { Icon } from "./components/icons";
import { useQrRenderer } from "./hooks/useQrRenderer";
import { useScanCheck } from "./hooks/useScanCheck";
import { useTheme } from "./hooks/useTheme";
import { useRecent } from "./hooks/useRecent";
import { useSiteLogo } from "./hooks/useSiteLogo";
import { DEFAULT_DESIGN, PRESETS, applyPreset, matchingPreset, type QrDesign } from "./lib/design";
import { DEFAULT_FIELDS, KINDS, describe, encode, validate, type AllFields, type QrKind } from "./lib/qrTypes";
import { analyze } from "./lib/readability";
import { canCopyImage, copyImage, downloadBlob, fileBaseName, makeThumbnail } from "./lib/exporting";
import { newId, type RecentEntry } from "./lib/history";
import { KEHAI_URL, REPO_URL } from "./lib/links";

type Toast = { tone: "ok" | "error" | "info"; text: string } | null;

const PLACEHOLDERS: Record<QrKind, string> = {
  url: "Enter a link to see your code.",
  text: "Type some text to see your code.",
  email: "Add a recipient to see your code.",
  phone: "Enter a number to see your code.",
  wifi: "Enter your network details to see your code.",
};

export default function App() {
  const { theme, toggle } = useTheme();
  const { recent, add, remove, clear } = useRecent();

  const [kind, setKind] = useState<QrKind>("url");
  const [fields, setFields] = useState<AllFields>(DEFAULT_FIELDS);
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const current = fields[kind];
  const errors = useMemo(() => validate(kind, current), [kind, current]);
  const payload = useMemo(() => encode(kind, current), [kind, current]);
  const issues = useMemo(() => (payload ? analyze(payload, design) : []), [payload, design]);
  const activePreset = useMemo(() => matchingPreset(design), [design]);

  const { containerRef, getBlob } = useQrRenderer(payload, design);
  const scan = useScanCheck(payload, design, getBlob);

  const notify = useCallback((next: Toast) => {
    window.clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const onChangeFields = useCallback(<K extends QrKind>(k: K, patch: Partial<AllFields[K]>) => {
    setFields((f) => ({ ...f, [k]: { ...f[k], ...patch } }));
  }, []);

  const onKind = useCallback((k: QrKind) => {
    setKind(k);
    setTouched(new Set());
  }, []);

  const onTouch = useCallback((field: string) => {
    setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));
  }, []);

  const onDesign = useCallback((patch: Partial<QrDesign>) => setDesign((d) => ({ ...d, ...patch })), []);

  const onPreset = useCallback((id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (preset) setDesign((d) => applyPreset(d, preset));
  }, []);

  const onSiteLogoFound = useCallback(
    (domain: string, raised: boolean) =>
      notify({
        tone: "info",
        text: `Added ${domain}'s logo${raised ? " and raised error correction to High" : ""} — remove or replace it under Logo.`,
      }),
    [notify],
  );
  const siteLogo = useSiteLogo({ kind, payload, design, setDesign, onFound: onSiteLogoFound });

  /** Upload (src) or remove (null) the centre logo. */
  const onLogo = useCallback(
    (src: string | null) => {
      const d = design;
      if (!src && d.logo.origin === "site" && d.logo.siteDomain) siteLogo.dismiss(d.logo.siteDomain);
      const raise = !!src && !d.logo.src && (d.errorLevel === "L" || d.errorLevel === "M");
      if (raise) notify({ tone: "info", text: "Error correction raised to High to make room for the logo." });
      setDesign((cur) => ({
        ...cur,
        errorLevel: raise ? "H" : cur.errorLevel,
        logo: { ...cur.logo, src, origin: src ? "upload" : null, siteDomain: null },
      }));
    },
    [design, notify, siteLogo],
  );

  const remember = useCallback(
    async (pngBlob?: Blob | null) => {
      if (!payload) return;
      const blob = pngBlob ?? (await getBlob("png"));
      if (!blob) return;
      const entry: RecentEntry = {
        id: newId(),
        kind,
        fields: current,
        design,
        payload,
        label: describe(kind, current),
        thumbnail: await makeThumbnail(blob),
        createdAt: Date.now(),
      };
      add(entry);
    },
    [payload, getBlob, kind, current, design, add],
  );

  const onDownload = useCallback(
    async (ext: "png" | "svg") => {
      if (!payload) return;
      setBusy(ext);
      try {
        const blob = await getBlob(ext);
        if (!blob) throw new Error("Nothing to download yet.");
        downloadBlob(blob, `${fileBaseName(describe(kind, current))}.${ext}`);
        await remember(ext === "png" ? blob : null);
        notify({ tone: "ok", text: `Downloaded ${ext.toUpperCase()}.` });
      } catch (e) {
        notify({ tone: "error", text: e instanceof Error ? e.message : "Download failed." });
      } finally {
        setBusy(null);
      }
    },
    [payload, getBlob, kind, current, remember, notify],
  );

  const onCopy = useCallback(async () => {
    setBusy("copy");
    try {
      const blob = await getBlob("png");
      if (!blob) throw new Error("Nothing to copy yet.");
      await copyImage(blob);
      await remember(blob);
      notify({ tone: "ok", text: "Copied the image to your clipboard." });
    } catch (e) {
      notify({ tone: "error", text: e instanceof Error && e.message ? e.message : "Your browser blocked clipboard access." });
    } finally {
      setBusy(null);
    }
  }, [getBlob, remember, notify]);

  const onSave = useCallback(async () => {
    setBusy("save");
    try {
      await remember();
      notify({ tone: "ok", text: "Saved to recent codes." });
    } finally {
      setBusy(null);
    }
  }, [remember, notify]);

  const onUse = useCallback(
    (entry: RecentEntry) => {
      setKind(entry.kind);
      setFields((f) => ({ ...f, [entry.kind]: { ...DEFAULT_FIELDS[entry.kind], ...entry.fields } }));
      setDesign({ ...DEFAULT_DESIGN, ...entry.design, logo: { ...DEFAULT_DESIGN.logo, ...entry.design.logo } });
      setTouched(new Set());
      notify({ tone: "info", text: `Loaded “${entry.label || "code"}” — edit away.` });
      document.getElementById("studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [notify],
  );

  const kindLabel = KINDS.find((k) => k.id === kind)?.label ?? "";

  return (
    <div className="app">
      <div className="backdrop" aria-hidden>
        <span className="backdrop__kanji">符</span>
      </div>

      <header className="topbar">
        <a className="brand" href="/" aria-label="Kehai QR Studio home">
          <span className="brand__mark" aria-hidden>
            符
          </span>
          <span className="brand__name">
            KEHAI <span className="brand__sub">QR STUDIO</span>
          </span>
        </a>
        <nav className="topbar__actions" aria-label="Site">
          <a className="pill-link" href={KEHAI_URL} target="_blank" rel="noopener">
            <span className="pill-link__dot" aria-hidden /> Kehai Engine
          </a>
          <a className="icon-button" href={REPO_URL} target="_blank" rel="noopener" aria-label="Source on GitHub">
            <Icon name="github" />
          </a>
          <button
            type="button"
            className="icon-button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            data-testid="theme-toggle"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow eyebrow--accent">QR code generator &amp; designer</p>
        <h1>
          Design QR codes that <span className="accent">actually scan.</span>
        </h1>
        <p className="hero__sub">
          Links, text, email, phone and Wi-Fi — styled your way, verified live by decoding the exact image you'll download. Runs entirely in
          your browser.
        </p>
      </section>

      <main className="layout" id="studio">
        <section className="panel panel--content" aria-labelledby="content-title">
          <div className="panel__head">
            <div>
              <span className="eyebrow">01 · Content</span>
              <h2 id="content-title">What should it open?</h2>
            </div>
          </div>
          <ContentForm
            kind={kind}
            fields={fields}
            errors={errors}
            visible={touched}
            onKind={onKind}
            onChange={onChangeFields}
            onTouch={onTouch}
          />
        </section>

        <aside className="panel panel--preview" aria-label={`${kindLabel} QR preview`}>
          <Preview
            containerRef={containerRef}
            payload={payload}
            placeholder={PLACEHOLDERS[kind]}
            design={design}
            scan={scan}
            issues={issues}
            busy={busy}
            canCopy={canCopyImage()}
            onDownload={onDownload}
            onCopy={onCopy}
            onSave={onSave}
          />
          <KehaiCallout />
        </aside>

        <section className="panel panel--design" aria-labelledby="design-title">
          <div className="panel__head">
            <div>
              <span className="eyebrow">02 · Design</span>
              <h2 id="design-title">Make it yours</h2>
            </div>
            <button type="button" className="link-button" onClick={() => setDesign((d) => ({ ...DEFAULT_DESIGN, logo: d.logo }))}>
              Reset
            </button>
          </div>
          <DesignPanel
            design={design}
            activePreset={activePreset}
            onChange={onDesign}
            onPreset={onPreset}
            onLogo={onLogo}
            siteLogo={siteLogo.status}
            autoLogo={siteLogo.enabled}
            onAutoLogo={siteLogo.setEnabled}
            onRestoreSiteLogo={siteLogo.restore}
          />
        </section>

        <div className="layout__recent">
          <RecentList recent={recent} onUse={onUse} onRemove={remove} onClear={clear} />
        </div>
      </main>

      <footer className="footer">
        <p>
          <strong>Private by design.</strong> There is no server: what you type and upload stays on this page. The only outside
          request is optional — a link's domain name is sent to a public favicon service to fetch its logo.
        </p>
        <p className="footer__links">
          Part of the <a href={KEHAI_URL} target="_blank" rel="noopener">Kehai</a> ecosystem ·{" "}
          <a href={REPO_URL} target="_blank" rel="noopener">
            Source
          </a>
        </p>
      </footer>

      <div className={`toast${toast ? ` toast--${toast.tone} is-visible` : ""}`} role="status" aria-live="polite" data-testid="toast">
        {toast?.text}
      </div>
    </div>
  );
}
