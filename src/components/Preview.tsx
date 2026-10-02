import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject } from "react";
import type { ScanState } from "../hooks/useScanCheck";
import type { QrDesign } from "../lib/design";
import type { ReadabilityIssue } from "../lib/readability";
import type { StressId, StressResult } from "../lib/scanCheck";
import { Icon } from "./icons";
import { useI18n } from "../i18n/I18nContext";

interface Props {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  payload: string | null;
  placeholder: string;
  design: QrDesign;
  scan: ScanState;
  issues: ReadabilityIssue[];
  busy: string | null;
  canCopy: boolean;
  /** Web Share with files is available (mostly phones). */
  canShare: boolean;
  onShare: () => void;
  onDownload: (ext: "png" | "svg") => void;
  onCopy: () => void;
  onSave: () => void;
  onCopyLink: () => void;
  /** Object URL of the exact PNG, for the browser's long-press "copy/save image" menu (touch only). */
  imageUrl?: string | null;
  /** Briefly highlight the code (e.g. to show where to long-press). */
  highlight?: boolean;
}

function ScanBadge({ scan, issues }: { scan: ScanState; issues: ReadabilityIssue[] }) {
  const { t } = useI18n();
  const hasError = issues.some((i) => i.severity === "error");
  const hasWarn = issues.some((i) => i.severity === "warn");

  let tone = "idle";
  let title = t("Waiting for content");
  let detail = t("Fill in the details to generate a code.");
  if (scan.status === "checking") {
    tone = "checking";
    title = t("Checking scan…");
    detail = t("Decoding the rendered code.");
  } else if (scan.status === "ok") {
    tone = hasError ? "bad" : hasWarn ? "warn" : "good";
    title = hasError ? t("Scans here — risky on phones") : hasWarn ? t("Scans, with caveats") : t("Scan verified");
    detail = hasError || hasWarn ? t("Decoded correctly, but see the warnings below.") : t("The rendered code decodes back to your exact content.");
  } else if (scan.status === "mismatch") {
    tone = "bad";
    title = t("Decodes to the wrong content");
    detail = t("Something in the design is corrupting the data. Try higher error correction.");
  } else if (scan.status === "error") {
    tone = "idle";
    title = t("Couldn't run the scan check");
    detail = t("This is a problem with the checker, not your code. Reload the page to try again.");
  } else if (scan.status === "unreadable") {
    tone = "bad";
    title = t("Won't scan");
    detail = t("The rendered code can't be decoded. Fix the issues below.");
  }

  return (
    <div className={`scan-badge scan-badge--${tone}`} role="status" aria-live="polite" data-testid="scan-status" data-state={tone}>
      <span className="scan-badge__icon">
        {tone === "good" ? <Icon name="check" /> : tone === "bad" ? <Icon name="x" /> : tone === "warn" ? <Icon name="alert" /> : <Icon name="spark" />}
      </span>
      <span>
        <strong>{title}</strong>
        <span className="scan-badge__detail">{detail}</span>
      </span>
    </div>
  );
}

const STRESS: { id: StressId; label: string; hint: string }[] = [
  { id: "small", label: "Small", hint: "Seen at 120 px, like a small print from arm's length" },
  { id: "blur", label: "Blurry", hint: "Slightly out of focus" },
  { id: "dim", label: "Dim light", hint: "Contrast crushed, like a dark room" },
];

function StressChips({ stress }: { stress: StressResult }) {
  const { t } = useI18n();
  const passed = STRESS.filter((s) => stress[s.id]).length;
  return (
    <div className="stress" data-testid="stress" data-passed={passed}>
      <span className="stress__label">{t("Camera stress test")}</span>
      <ul className="stress__list">
        {STRESS.map((s) => (
          <li key={s.id} className={`stress__chip${stress[s.id] ? " is-pass" : " is-fail"}`} title={t(s.hint)} data-id={s.id} data-pass={stress[s.id]}>
            <Icon name={stress[s.id] ? "check" : "x"} />
            {t(s.label)}
            <span className="visually-hidden">{stress[s.id] ? t("passed") : t("failed")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One Download button that asks which format: a picture (PNG, the default,
 * shows in a phone's gallery) or a vector (SVG, for designers). JPG is
 * deliberately not offered: its compression smudges the squares.
 */
function DownloadMenu({ disabled, busy, onDownload }: { disabled: boolean; busy: boolean; onDownload: (ext: "png" | "svg") => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    itemsRef.current[0]?.focus({ preventScroll: true });
    const onDown = (e: globalThis.PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
  };
  const pick = (ext: "png" | "svg") => {
    setOpen(false);
    onDownload(ext);
  };
  const onMenuKey = (e: ReactKeyboardEvent) => {
    const items = itemsRef.current.filter(Boolean) as HTMLButtonElement[];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const options = [
    { ext: "png" as const, title: t("Picture (PNG)"), note: t("Best for phones, chats and printing. Shows up with your photos.") },
    { ext: "svg" as const, title: t("Vector (SVG)"), note: t("For designers: scales to any size. Won't appear in your photo gallery.") },
  ];

  return (
    <div className="download" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn--primary"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="download"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{busy ? t("Preparing…") : t("Download")}</span>
        <span className="btn__disc">
          <Icon name="download" />
        </span>
      </button>
      {open && (
        <div className="download__menu" role="menu" aria-label={t("Download format")} onKeyDown={onMenuKey}>
          {options.map((o, i) => (
            <button
              key={o.ext}
              ref={(el) => (itemsRef.current[i] = el)}
              type="button"
              role="menuitem"
              className="download__item"
              data-testid={`download-${o.ext}`}
              onClick={() => pick(o.ext)}
            >
              <span className="download__title">
                {o.title}
                {o.ext === "png" && <span className="download__badge">{t("Recommended")}</span>}
              </span>
              <span className="download__note">{o.note}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Preview(props: Props) {
  const { containerRef, payload, placeholder, design, scan, issues, busy, canCopy, canShare, onShare, onDownload, onCopy, onSave, onCopyLink, imageUrl, highlight } = props;
  const { t } = useI18n();
  const disabled = !payload || busy !== null;

  return (
    <div className="preview">
      <div className={`preview__stage${highlight ? " is-highlighted" : ""}`} data-testid="preview-stage">
        <div ref={containerRef} className="preview__canvas" data-testid="qr-preview" hidden={!payload} />
        {payload && imageUrl && (
          // Invisible copy of the exact PNG over the code: long-pressing it
          // opens the browser's own image menu (copy / save / share), which
          // works where the clipboard API doesn't (Samsung Internet).
          <img className="preview__longpress" src={imageUrl} alt={t("QR code")} data-testid="longpress-image" />
        )}
        {!payload && (
          <div className="preview__empty">
            <span className="preview__empty-glyph" aria-hidden>
              符
            </span>
            <p>{placeholder}</p>
          </div>
        )}
      </div>
      <p className="preview__meta">
        {design.size} × {design.size} px · {t("level {level}", { level: design.errorLevel })}
      </p>

      <ScanBadge scan={scan} issues={payload ? issues : []} />
      {payload && scan.status === "ok" && scan.stress && <StressChips stress={scan.stress} />}

      {payload && issues.length > 0 && (
        <ul className="issues" aria-label={t("Readability warnings")}>
          {issues.map((i) => (
            <li key={i.id} className={`issue issue--${i.severity}`}>
              <Icon name={i.severity === "error" ? "x" : "alert"} />
              <span>
                <strong>{i.title}{t(".")}</strong> {i.detail}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <DownloadMenu disabled={disabled} busy={busy === "png" || busy === "svg"} onDownload={onDownload} />
        <div className={`actions__row${canShare ? " actions__row--3" : ""}`}>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={disabled || !canCopy}
            title={canCopy ? undefined : t("Your browser can't copy images")}
            onClick={onCopy}
          >
            <Icon name="copy" /> {t("Copy")}
          </button>
          {canShare && (
            <button type="button" className="btn btn--ghost" disabled={disabled} onClick={onShare}>
              <Icon name="share" /> {t("Share")}
            </button>
          )}
          <button type="button" className="btn btn--ghost" disabled={disabled} onClick={onSave}>
            <Icon name="save" /> {t("Save")}
          </button>
        </div>
        {payload && (
          <button type="button" className="link-button link-button--center" onClick={onCopyLink} data-testid="copy-link">
            <Icon name="link" /> {t("Copy design link")}
          </button>
        )}
        {!payload && <p className="muted small center">{t("Complete the form to enable downloads.")}</p>}
      </div>

      {payload && (
        <details className="payload">
          <summary>{t("Encoded content")}</summary>
          <code data-testid="payload">{payload}</code>
        </details>
      )}
    </div>
  );
}
