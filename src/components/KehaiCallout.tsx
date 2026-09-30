import { KEHAI_URL } from "../lib/links";
import { rich, useI18n } from "../i18n/I18nContext";
import { Icon } from "./icons";

/** Cross-link to Kehai Engine for the one thing a static QR can't do. */
export function KehaiCallout() {
  const { t } = useI18n();
  return (
    <aside className="kehai-callout" aria-label={t("About Kehai Engine")}>
      <span className="kehai-callout__glyph" aria-hidden>
        気配
      </span>
      <p className="kehai-callout__eyebrow">{t("Need proof of presence?")}</p>
      <p className="kehai-callout__text">
        {rich(
          t(
            "A static code can be screenshotted and shared. For attendance, {kehai} uses signed, rotating QR codes plus location checks, so only people who are actually there can check in.",
          ),
          { kehai: <strong>Kehai Engine</strong> },
        )}
      </p>
      <a className="kehai-callout__link" href={KEHAI_URL} target="_blank" rel="noopener">
        {t("Explore Kehai Engine")} <Icon name="arrow" />
      </a>
    </aside>
  );
}
