import { KEHAI_URL } from "../lib/links";
import { Icon } from "./icons";

/** Cross-link to Kehai Engine for the one thing a static QR can't do. */
export function KehaiCallout() {
  return (
    <aside className="kehai-callout" aria-label="About Kehai Engine">
      <span className="kehai-callout__glyph" aria-hidden>
        気配
      </span>
      <p className="kehai-callout__eyebrow">Need proof of presence?</p>
      <p className="kehai-callout__text">
        A static code can be screenshotted and shared. For attendance, <strong>Kehai Engine</strong> uses signed, rotating QR codes plus
        location checks, so only people who are actually there can check in.
      </p>
      <a className="kehai-callout__link" href={KEHAI_URL} target="_blank" rel="noopener">
        Explore Kehai Engine <Icon name="arrow" />
      </a>
    </aside>
  );
}
