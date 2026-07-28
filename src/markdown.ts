import { marked } from "marked";

// Registered once, here, so every caller gets the link sanitiser rather than inheriting it by
// import order: anything that is not http(s), mailto, a site-relative path or a fragment is dropped.
marked.use({ walkTokens(token) {
  if ((token.type === "link" || token.type === "image") && !/^(https?:|mailto:|\/(?!\/)|#)/i.test(token.href ?? "")) token.href = "#";
} });

/** Content is authored by admins, not the public, but it is still escaped before parsing. */
export function markdown(value: string) {
  const escaped = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return String(marked.parse(escaped));
}
