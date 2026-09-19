import type { Db } from "./db.js";
import type { Locale } from "./i18n.js";
import { issueHeadings } from "./issue-headings.js";

export const issueSlugs = ["elections-on-time", "election-results", "court-rulings", "coalition-choices", "government-size", "ministerial-responsibility", "first-100-days", "october-7-inquiry", "professional-security-services", "public-agreements"] as const;
export function issueSlug(id: number) { return issueSlugs[id - 1]; }
export type Issue = { id: number; sortOrder: number; title: string; body: string; rationale: string | null; verification: string | null; exceptions: string | null; slug: string };
export function listIssues(db: Db, locale: Locale): Issue[] {
  const rows = db.prepare(`SELECT d.id, d.sort_order AS sortOrder, t.title, t.body, t.rationale, t.verification, t.exceptions
    FROM demands d JOIN campaigns c ON c.id=d.campaign_id JOIN demand_translations t ON t.demand_id=d.id AND t.locale=?
    WHERE c.status='active' AND d.is_active=1 AND d.document='standard' AND d.id BETWEEN 1 AND 10 ORDER BY d.sort_order`).all(locale) as Omit<Issue,"slug">[];
  return rows.filter(row => row.title && row.body).map(row => ({...row, title: issueHeadings[locale][row.id-1]!, slug: issueSlug(row.id)!}));
}
export function socialLinks(title: string, text: string, url: string) {
  return [
    {label: "WhatsApp", href: `https://wa.me/?${new URLSearchParams({text: `${text}\n${url}`})}`},
    {label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({u: url})}`},
    {label: "Telegram", href: `https://t.me/share/url?${new URLSearchParams({url, text})}`},
    {label: "X", href: `https://x.com/intent/post?${new URLSearchParams({text: title, url})}`}
  ];
}
