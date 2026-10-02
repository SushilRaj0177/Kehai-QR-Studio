/**
 * The page a "text" QR code opens: shows the message carried in the URL
 * fragment. Plain DOM (no React) so it loads instantly on a phone. The
 * text is only ever inserted with textContent, never as HTML.
 */
import { readTextPage } from "../lib/textPage";
import "./viewer.css";

const ja = navigator.language?.toLowerCase().startsWith("ja");
const T = ja
  ? {
      label: "メッセージ",
      copy: "コピー",
      copied: "コピーしました",
      share: "共有",
      empty: "このリンクにはメッセージが含まれていません。",
      emptyHint: "QRコードを読み取り直すか、送った人に確認してください。",
      privacy: "このテキストはリンクの中にだけ存在し、どこにもアップロードされていません。",
      make: "自分の QR コードを作る",
    }
  : {
      label: "Message",
      copy: "Copy text",
      copied: "Copied",
      share: "Share",
      empty: "This link doesn't contain a message.",
      emptyHint: "Try scanning the code again, or ask whoever shared it.",
      privacy: "This text lives inside the link itself. It was never uploaded anywhere.",
      make: "Make your own QR code",
    };
if (ja) document.documentElement.lang = "ja";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** Text with http(s) links made tappable; everything stays textContent. */
function linkified(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const re = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;
  let last = 0;
  for (const m of text.matchAll(re)) {
    frag.append(text.slice(last, m.index));
    const a = el("a", "viewer__link", m[0]);
    a.href = m[0];
    a.rel = "noopener noreferrer nofollow";
    a.target = "_blank";
    frag.append(a);
    last = m.index! + m[0].length;
  }
  frag.append(text.slice(last));
  return frag;
}

function render() {
  const root = document.getElementById("viewer")!;
  root.replaceChildren();
  const text = readTextPage(window.location.hash);

  const brand = el("a", "viewer__brand");
  brand.href = "/";
  brand.append(el("span", "viewer__mark", "符"), el("span", "viewer__name", "KEHAI"), el("span", "viewer__sub", "QR STUDIO"));
  root.append(brand);

  const card = el("section", "viewer__card");
  if (text === null || !text.trim()) {
    document.title = "Message · Kehai QR Studio";
    card.append(el("p", "viewer__empty", T.empty), el("p", "viewer__hint", T.emptyHint));
    root.append(card);
  } else {
    document.title = `${text.trim().slice(0, 48)}${text.length > 48 ? "…" : ""} · Kehai QR Studio`;
    const body = el("p", "viewer__text");
    body.dataset.testid = "viewer-text";
    body.append(linkified(text));
    if (text.length <= 80 && !text.includes("\n")) body.classList.add("viewer__text--big");

    const actions = el("div", "viewer__actions");
    const copy = el("button", "viewer__btn viewer__btn--primary", T.copy);
    copy.type = "button";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Older browsers: select the text and try the legacy command. If
        // that fails too, the text stays selected for a manual copy.
        const range = document.createRange();
        range.selectNodeContents(body);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
        if (!document.execCommand?.("copy")) return;
      }
      copy.textContent = T.copied;
      setTimeout(() => (copy.textContent = T.copy), 1600);
    });
    actions.append(copy);
    if (typeof navigator.share === "function") {
      const share = el("button", "viewer__btn", T.share);
      share.type = "button";
      share.addEventListener("click", () => navigator.share({ text }).catch(() => {}));
      actions.append(share);
    }
    card.append(el("span", "viewer__label", T.label), body, actions);
    root.append(card, el("p", "viewer__privacy", T.privacy));
  }

  const make = el("a", "viewer__make", `${T.make} →`);
  make.href = "/";
  root.append(make);
}

render();
window.addEventListener("hashchange", render);
