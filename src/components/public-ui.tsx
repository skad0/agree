import type { Child } from "hono/jsx";
import { t, type Locale } from "../i18n.js";

export function DocumentIntro({ title, lede }: { title: string; lede: string }) {
  return <div class="document-intro"><h1>{title}</h1><p class="lede">{lede}</p></div>;
}

export function JourneyIntro({ eyebrow, title, lede, headingId }: { eyebrow?: Child; title: Child; lede?: Child; headingId?: string }) {
  return <div class="journey-intro">{eyebrow ? <p class="eyebrow">{eyebrow}</p> : null}<h1 id={headingId}>{title}</h1>{lede ? <p class="lede">{lede}</p> : null}</div>;
}

export function DocumentSurface({ children }: { children: Child }) {
  return <div class="document-surface">{children}</div>;
}

export function AskPanel({ locale }: { locale: Locale }) {
  return <div class="document-ask">
    <div><h2>{t(locale, "navRequest")}</h2><p>{t(locale, "subtitle")}</p></div>
    <PrimaryAction href={`/${locale}/request`}>{t(locale, "navRequest")}</PrimaryAction>
  </div>;
}

export function Surface({ children, class: className = "", emphasis = false }: { children: Child; class?: string; emphasis?: boolean }) {
  return <div class={`surface${emphasis ? " surface-emphasis" : ""}${className ? ` ${className}` : ""}`}>{children}</div>;
}

export function Callout({ children, tone = "blue" }: { children: Child; tone?: "blue" | "muted" | "caution" }) {
  return <div class={`callout callout-${tone}`}>{children}</div>;
}

export function PrimaryAction({ children, href, type = "submit", class: className = "" }: { children: Child; href?: string; type?: "button" | "submit"; class?: string }) {
  return href ? <a class={`primary-action${className ? ` ${className}` : ""}`} href={href}>{children}</a>
    : <button class={`primary-action${className ? ` ${className}` : ""}`} type={type}>{children}</button>;
}

export function PortraitStack({ count = 0, names = [] }: { count?: number; names?: string[] }) {
  const visible = Math.min(names.length, 4);
  return <div class="portrait-stack" dir="ltr" aria-hidden="true">
    {Array.from({ length: visible || Math.min(count, 4) }).map((_, index) => <span class="portrait-slot" key={index} />)}
    {count > visible && <span class="portrait-overflow">+{count - visible}</span>}
  </div>;
}
