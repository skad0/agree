import type { Locale } from "../i18n.js";
import { s } from "../share-copy.js";
import { socialLinks } from "../issues.js";

export function ShareOptions({locale, id, title, text, url}: {locale: Locale; id: string; title: string; text: string; url: string}) {
  return <details class="share-options" data-share data-share-title={title} data-share-text={text} data-share-url={url}
    data-copied={s(locale,"copied")} data-copy-failed={s(locale,"copyFailed")} data-share-failed={s(locale,"shareFailed")}>
    <summary>{s(locale,"share")}<span class="sr-only">: {title}</span></summary>
    <div class="share-content">
      <p>{text}</p>
      <label for={`share-url-${id}`}>{s(locale,"link")}</label>
      <input id={`share-url-${id}`} class="share-url" type="text" dir="ltr" readOnly value={url} />
      <div class="share-controls">
        <button hidden type="button" data-share-copy>{s(locale,"copy")}</button>
        {socialLinks(title,text,url).map(link => <a href={link.href} rel="noreferrer">{link.label}</a>)}
        <button hidden type="button" data-share-native>{s(locale,"more")}</button>
      </div>
      <p class="share-note">{s(locale,"external")}</p>
      <p class="share-status" role="status" aria-live="polite" aria-atomic="true"></p>
    </div>
  </details>;
}
