import type { RecentEntry } from "../lib/history";
import { KINDS } from "../lib/qrTypes";
import { Icon } from "./icons";

interface Props {
  recent: RecentEntry[];
  onUse: (entry: RecentEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const kindLabel = (k: string) => KINDS.find((x) => x.id === k)?.label ?? k;

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ts).toLocaleDateString();
}

export function RecentList({ recent, onUse, onRemove, onClear }: Props) {
  return (
    <section className="panel recent" aria-labelledby="recent-title">
      <div className="panel__head">
        <div>
          <span className="eyebrow">03 · History</span>
          <h2 id="recent-title">Recent codes</h2>
        </div>
        {recent.length > 0 && (
          <button type="button" className="link-button" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="muted recent__empty">
          Codes you download, copy or save appear here — stored only in this browser, so they're still here after a refresh.
        </p>
      ) : (
        <ul className="recent__grid" data-testid="recent-list">
          {recent.map((e) => (
            <li key={e.id} className="recent-card">
              <button type="button" className="recent-card__use" onClick={() => onUse(e)} aria-label={`Reuse ${kindLabel(e.kind)} code: ${e.label}`}>
                <img src={e.thumbnail} alt="" width={72} height={72} />
                <span className="recent-card__text">
                  <span className="recent-card__kind">{kindLabel(e.kind)}</span>
                  <span className="recent-card__label">{e.label || "Untitled"}</span>
                  <span className="recent-card__time">{timeAgo(e.createdAt)}</span>
                </span>
              </button>
              <button type="button" className="icon-button" aria-label={`Remove ${e.label}`} onClick={() => onRemove(e.id)}>
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
