import type { MutableRefObject } from "react";
import type { ScanState } from "../hooks/useScanCheck";
import type { QrDesign } from "../lib/design";
import type { ReadabilityIssue } from "../lib/readability";
import { Icon } from "./icons";

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
}

function ScanBadge({ scan, issues }: { scan: ScanState; issues: ReadabilityIssue[] }) {
  const hasError = issues.some((i) => i.severity === "error");
  const hasWarn = issues.some((i) => i.severity === "warn");

  let tone = "idle";
  let title = "Waiting for content";
  let detail = "Fill in the details to generate a code.";
  if (scan.status === "checking") {
    tone = "checking";
    title = "Checking scan…";
    detail = "Decoding the rendered code.";
  } else if (scan.status === "ok") {
    tone = hasError ? "bad" : hasWarn ? "warn" : "good";
    title = hasError ? "Scans here — risky on phones" : hasWarn ? "Scans, with caveats" : "Scan verified";
    detail = hasError || hasWarn ? "Decoded correctly, but see the warnings below." : "The rendered code decodes back to your exact content.";
  } else if (scan.status === "mismatch") {
    tone = "bad";
    title = "Decodes to the wrong content";
    detail = "Something in the design is corrupting the data. Try higher error correction.";
  } else if (scan.status === "unreadable") {
    tone = "bad";
    title = "Won't scan";
    detail = "The rendered code can't be decoded. Fix the issues below.";
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

export function Preview(props: Props) {
  const { containerRef, payload, placeholder, design, scan, issues, busy, canCopy, canShare, onShare, onDownload, onCopy, onSave } = props;
  const disabled = !payload || busy !== null;

  return (
    <div className="preview">
      <div className="preview__stage" data-testid="preview-stage">
        <div ref={containerRef} className="preview__canvas" data-testid="qr-preview" hidden={!payload} />
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
        {design.size} × {design.size} px · level {design.errorLevel}
      </p>

      <ScanBadge scan={scan} issues={payload ? issues : []} />

      {payload && issues.length > 0 && (
        <ul className="issues" aria-label="Readability warnings">
          {issues.map((i) => (
            <li key={i.id} className={`issue issue--${i.severity}`}>
              <Icon name={i.severity === "error" ? "x" : "alert"} />
              <span>
                <strong>{i.title}.</strong> {i.detail}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button type="button" className="btn btn--primary" disabled={disabled} onClick={() => onDownload("png")}>
          <span>{busy === "png" ? "Preparing…" : "Download PNG"}</span>
          <span className="btn__disc">
            <Icon name="download" />
          </span>
        </button>
        <div className={`actions__row${canShare ? " actions__row--4" : ""}`}>
          <button type="button" className="btn btn--ghost" disabled={disabled} onClick={() => onDownload("svg")}>
            <Icon name="download" /> SVG
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={disabled || !canCopy}
            title={canCopy ? undefined : "Your browser can't copy images"}
            onClick={onCopy}
          >
            <Icon name="copy" /> Copy
          </button>
          {canShare && (
            <button type="button" className="btn btn--ghost" disabled={disabled} onClick={onShare}>
              <Icon name="share" /> Share
            </button>
          )}
          <button type="button" className="btn btn--ghost" disabled={disabled} onClick={onSave}>
            <Icon name="save" /> Save
          </button>
        </div>
        {!payload && <p className="muted small center">Complete the form to enable downloads.</p>}
      </div>

      {payload && (
        <details className="payload">
          <summary>Encoded content</summary>
          <code data-testid="payload">{payload}</code>
        </details>
      )}
    </div>
  );
}
