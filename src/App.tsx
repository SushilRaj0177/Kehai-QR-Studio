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
import { usePressRipple } from "./hooks/usePressRipple";
import { DEFAULT_DESIGN, PRESETS, applyPreset, matchingPreset, type QrDesign } from "./lib/design";
import { DEFAULT_FIELDS, KINDS, describe, encode, validate, type AllFields, type QrKind } from "./lib/qrTypes";
import { analyze } from "./lib/readability";
import { canCopyImage, canShareImage, copyImage, downloadBlob, fileBaseName, makeThumbnail, shareImage } from "./lib/exporting";
import { newId, type RecentEntry } from "./lib/history";
import { decodeShareLink, encodeShareLink, type SharedState } from "./lib/shareLink";
import { KEHAI_URL, REPO_URL } from "./lib/links";
import { I18nContext, rich, useLangState } from "./i18n/I18nContext";

type Toast = { tone: "ok" | "error" | "info"; text: string } | null;

const PLACEHOLDERS: Record<QrKind, string> = {
  url: "Enter a link to see your code.",
  text: "Type some text to see your code.",
  email: "Add a recipient to see your code.",
  phone: "Enter a number to see your code.",
  wifi: "Enter your network details to see your code.",
  contact: "Enter a phone number to see your code.",
};

export default function App() {
  const i18n = useLangState();
  const { t, lang, setLang } = i18n;
  const { theme, toggle } = useTheme();
  usePressRipple();
  const { recent, add, remove, clear } = useRecent();

  // A design link (#d=…) opens straight into its state, with no flash of the defaults.
  const [shared] = useState(() => decodeShareLink(window.location.hash));
  const [kind, setKind] = useState<QrKind>(shared?.kind ?? "url");
  const [fields, setFields] = useState<AllFields>(() =>
    shared ? { ...DEFAULT_FIELDS, [shared.kind]: { ...DEFAULT_FIELDS[shared.kind], ...shared.fields } } : DEFAULT_FIELDS,
  );
  const [design, setDesign] = useState<QrDesign>(shared?.design ?? DEFAULT_DESIGN);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const current = fields[kind];
  const errors = useMemo(() => validate(kind, current, t), [kind, current, t]);
  const payload = useMemo(() => encode(kind, current), [kind, current]);
  const issues = useMemo(() => (payload ? analyze(payload, design, t) : []), [payload, design, t]);
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
        text: raised
          ? t("Added {domain}'s logo and raised error correction to High — remove or replace it under Logo.", { domain })
          : t("Added {domain}'s logo — remove or replace it under Logo.", { domain }),
      }),
    [notify, t],
  );
  const siteLogo = useSiteLogo({ kind, payload, design, setDesign, onFound: onSiteLogoFound });

  /** Upload (src) or remove (null) the centre logo. */
  const onLogo = useCallback(
    (src: string | null) => {
      const d = design;
      if (!src && d.logo.origin === "site" && d.logo.siteDomain) siteLogo.dismiss(d.logo.siteDomain);
      const raise = !!src && !d.logo.src && (d.errorLevel === "L" || d.errorLevel === "M");
      if (raise) notify({ tone: "info", text: t("Error correction raised to High to make room for the logo.") });
      setDesign((cur) => ({
        ...cur,
        errorLevel: raise ? "H" : cur.errorLevel,
        logo: { ...cur.logo, src, origin: src ? "upload" : null, siteDomain: null },
      }));
    },
    [design, notify, siteLogo, t],
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
        if (!blob) throw new Error(t("Nothing to download yet."));
        downloadBlob(blob, `${fileBaseName(describe(kind, current))}.${ext}`);
        await remember(ext === "png" ? blob : null);
        notify({ tone: "ok", text: t("Downloaded {format}.", { format: ext.toUpperCase() }) });
      } catch (e) {
        notify({ tone: "error", text: e instanceof Error ? e.message : t("Download failed.") });
      } finally {
        setBusy(null);
      }
    },
    [payload, getBlob, kind, current, remember, notify, t],
  );

  const shareSupported = useMemo(() => canShareImage(), []);
  const copySupported = useMemo(() => canCopyImage(), []);

  const pngOrThrow = useCallback(async () => {
    const blob = await getBlob("png");
    if (!blob) throw new Error(t("Nothing to export yet."));
    return blob;
  }, [getBlob, t]);

  /** Opens the native share sheet; returns false if the user cancelled. */
  const share = useCallback(
    async (blob: Blob) => {
      try {
        await shareImage(blob, `${fileBaseName(describe(kind, current))}.png`, t("QR code"));
        return true;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return false;
        throw e;
      }
    },
    [kind, current, t],
  );

  const onCopy = useCallback(async () => {
    setBusy("copy");
    // Start the clipboard write *now*, inside the click, with the image as a
    // promise — waiting for the render first loses the user-gesture
    // permission in stricter browsers (Samsung Internet, Safari).
    const image = pngOrThrow();
    try {
      await copyImage(image);
      await remember(await image);
      notify({ tone: "ok", text: t("Copied the image to your clipboard.") });
    } catch {
      // Some mobile browsers refuse to put images on the clipboard at all:
      // fall back to the share sheet, where "Copy" or any app is one tap away.
      try {
        const blob = await image;
        if (shareSupported) {
          if (await share(blob)) {
            await remember(blob);
            notify({ tone: "info", text: t("This browser can't copy images, so the share menu opened instead.") });
          }
        } else {
          notify({ tone: "error", text: t("This browser doesn't allow copying images — use Download instead.") });
        }
      } catch {
        notify({ tone: "error", text: t("Couldn't copy or share the image — use Download instead.") });
      }
    } finally {
      setBusy(null);
    }
  }, [pngOrThrow, remember, notify, shareSupported, share, t]);

  const onShare = useCallback(async () => {
    setBusy("share");
    try {
      const blob = await pngOrThrow();
      if (await share(blob)) await remember(blob);
    } catch {
      notify({ tone: "error", text: t("Sharing failed — use Download instead.") });
    } finally {
      setBusy(null);
    }
  }, [pngOrThrow, share, remember, notify, t]);

  const onSave = useCallback(async () => {
    setBusy("save");
    try {
      await remember();
      notify({ tone: "ok", text: t("Saved to recent codes.") });
    } finally {
      setBusy(null);
    }
  }, [remember, notify, t]);

  const onUse = useCallback(
    (entry: RecentEntry) => {
      setKind(entry.kind);
      // Text codes saved before page mode existed were raw text: keep them that way.
      const legacy = entry.kind === "text" && !("asPage" in entry.fields) ? { asPage: false } : {};
      setFields((f) => ({ ...f, [entry.kind]: { ...DEFAULT_FIELDS[entry.kind], ...legacy, ...entry.fields } }));
      setDesign({ ...DEFAULT_DESIGN, ...entry.design, logo: { ...DEFAULT_DESIGN.logo, ...entry.design.logo } });
      setTouched(new Set());
      notify({ tone: "info", text: t("Loaded “{label}” — edit away.", { label: entry.label || t("code") }) });
      document.getElementById("studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [notify, t],
  );

  const openShared = useCallback((s: SharedState) => {
    setKind(s.kind);
    setFields((f) => ({ ...f, [s.kind]: { ...DEFAULT_FIELDS[s.kind], ...s.fields } }));
    setDesign(s.design);
    setTouched(new Set());
  }, []);

  // Tidy the address bar once a link has been opened, and handle a link
  // pasted into this same tab (only the hash changes, so there's no reload).
  useEffect(() => {
    const clear = () => history.replaceState(null, "", window.location.pathname + window.location.search);
    if (shared) {
      clear();
      notify({ tone: "info", text: t("Opened a shared design.") });
    }
    const onHash = () => {
      const s = decodeShareLink(window.location.hash);
      if (!s) return;
      openShared(s);
      clear();
      notify({ tone: "info", text: t("Opened a shared design.") });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const onCopyLink = useCallback(async () => {
    const url = window.location.origin + window.location.pathname + encodeShareLink(kind, current, design);
    const note = kind === "wifi" && fields.wifi.password ? t("Link copied — it includes the Wi-Fi password.") : t("Link copied. Anyone who opens it gets this exact code.");
    try {
      await navigator.clipboard.writeText(url);
      notify({ tone: "ok", text: note });
    } catch {
      window.prompt(t("Copy this link:"), url);
    }
  }, [kind, current, design, fields.wifi.password, notify, t]);

  const kindLabel = t(KINDS.find((k) => k.id === kind)?.label ?? "");

  return (
    <I18nContext.Provider value={i18n}>
    <div className="app">
      <div className="backdrop" aria-hidden>
        <span className="backdrop__kanji">符</span>
      </div>

      <header className="topbar">
        <a className="brand" href="/" aria-label={t("Kehai QR Studio home")}>
          <span className="brand__mark" aria-hidden>
            符
          </span>
          <span className="brand__name">
            KEHAI <span className="brand__sub">QR STUDIO</span>
          </span>
        </a>
        <nav className="topbar__actions" aria-label={t("Site")}>
          <a className="pill-link" href={KEHAI_URL} target="_blank" rel="noopener">
            <span className="pill-link__dot" aria-hidden /> Kehai Engine
          </a>
          <a className="icon-button" href={REPO_URL} target="_blank" rel="noopener" aria-label={t("Source on GitHub")}>
            <Icon name="github" />
          </a>
          <button
            type="button"
            className="lang-toggle"
            onClick={() => setLang(lang === "en" ? "ja" : "en")}
            aria-label={lang === "en" ? "日本語に切り替える (Switch to Japanese)" : "Switch to English (英語に切り替える)"}
            data-testid="lang-toggle"
          >
            {lang === "en" ? <span lang="ja">日本語</span> : <span lang="en">EN</span>}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
            }}
            aria-label={theme === "dark" ? t("Switch to light theme") : t("Switch to dark theme")}
            data-testid="theme-toggle"
          >
            <span className="theme-icon" key={theme} aria-hidden>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </span>
          </button>
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow eyebrow--accent">{t("QR code generator & designer")}</p>
        <h1>{rich(t("Design QR codes that {accent}"), { accent: <span className="accent">{t("actually scan.")}</span> })}</h1>
        <p className="hero__sub">
          {t(
            "Links, text, email, phone, Wi-Fi and contact cards — styled your way, verified live by decoding the exact image you'll download. Runs entirely in your browser.",
          )}
        </p>
      </section>

      <main className="layout" id="studio">
        <section className="panel panel--content" aria-labelledby="content-title">
          <div className="panel__head">
            <div>
              <span className="eyebrow">01 · {t("Content")}</span>
              <h2 id="content-title">{t("What should it open?")}</h2>
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

        <aside className="panel panel--preview" aria-label={t("{kind} QR preview", { kind: kindLabel })}>
          <Preview
            containerRef={containerRef}
            payload={payload}
            placeholder={t(PLACEHOLDERS[kind])}
            design={design}
            scan={scan}
            issues={issues}
            busy={busy}
            canCopy={copySupported || shareSupported}
            canShare={shareSupported}
            onShare={onShare}
            onDownload={onDownload}
            onCopy={onCopy}
            onSave={onSave}
            onCopyLink={onCopyLink}
          />
          <KehaiCallout />
        </aside>

        <section className="panel panel--design" aria-labelledby="design-title">
          <div className="panel__head">
            <div>
              <span className="eyebrow">02 · {t("Design")}</span>
              <h2 id="design-title">{t("Make it yours")}</h2>
            </div>
            <button type="button" className="link-button" onClick={() => setDesign((d) => ({ ...DEFAULT_DESIGN, logo: d.logo }))}>
              {t("Reset")}
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
          <strong>{t("Private by design.")}</strong>{" "}
          {t(
            "There is no server: what you type and upload stays on this page. The only outside request is optional — a link's domain name is sent to a public favicon service to fetch its logo.",
          )}
        </p>
        <p className="footer__links">
          {rich(t("Part of the {kehai} ecosystem"), {
            kehai: (
              <a href={KEHAI_URL} target="_blank" rel="noopener">
                Kehai
              </a>
            ),
          })}{" "}
          ·{" "}
          <a href={REPO_URL} target="_blank" rel="noopener">
            {t("Source")}
          </a>
        </p>
      </footer>

      <div className={`toast${toast ? ` toast--${toast.tone} is-visible` : ""}`} role="status" aria-live="polite" data-testid="toast">
        {toast?.text}
      </div>
    </div>
    </I18nContext.Provider>
  );
}
