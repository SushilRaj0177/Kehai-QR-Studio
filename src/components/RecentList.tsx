import type { RecentEntry } from "../lib/history";
import { KINDS } from "../lib/qrTypes";
import { Icon } from "./icons";
import { useI18n } from "../i18n/I18nContext";
import type { Translate } from "../i18n/i18n";

interface Props {
  recent: RecentEntry[];
  onUse: (entry: RecentEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function timeAgo(ts: number, t: Translate, lang: string): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return t("just now");
  const m = Math.round(s / 60);
  if (m < 60) return t("{n} min ago", { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t("{n} h ago", { n: h });
  return new Date(ts).toLocaleDateString(lang);
}

export function RecentList({ recent, onUse, onRemove, onClear }: Props) {
  const { t, lang } = useI18n();
  const kindLabel = (k: string) => t(KINDS.find((x) => x.id === k)?.label ?? k);
  return (
    <section className="panel recent" aria-labelledby="recent-title">
      <div className="panel__head">
        <div>
          <span className="eyebrow">03 · {t("History")}</span>
          <h2 id="recent-title">{t("Recent codes")}</h2>
        </div>
        {recent.length > 0 && (
          <button type="button" className="link-button" onClick={onClear}>
            {t("Clear all")}
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <p className="muted recent__empty">
          {t("Codes you download, copy or save appear here — stored only in this browser, so they're still here after a refresh.")}
        </p>
      ) : (
        <ul className="recent__grid" data-testid="recent-list">
          {recent.map((e) => (
            <li key={e.id} className="recent-card">
              <button type="button" className="recent-card__use" onClick={() => onUse(e)} aria-label={t("Reuse {kind} code: {label}", { kind: kindLabel(e.kind), label: e.label })}>
                <img src={e.thumbnail} alt="" width={72} height={72} />
                <span className="recent-card__text">
                  <span className="recent-card__kind">{kindLabel(e.kind)}</span>
                  <span className="recent-card__label">{e.label || t("Untitled")}</span>
                  <span className="recent-card__time">{timeAgo(e.createdAt, t, lang)}</span>
                </span>
              </button>
              <button type="button" className="icon-button" aria-label={t("Remove {label}", { label: e.label })} onClick={() => onRemove(e.id)}>
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
