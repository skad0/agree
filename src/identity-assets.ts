import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Explicit allowlist: public source artwork is served without exposing arbitrary disk paths.
const files = [
  "favicon.svg", "favicon.ico", "icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png",
  "manifest.json", "logo.svg", "logo-light.svg", "logo-mark.svg", "logo-mark-light.svg", "logo-monochrome.svg",
  "x-profile-avatar.svg", "x-profile-avatar.png", "x-banner.svg", "x-banner.png", "og-image.svg", "og-image.png",
] as const;
const types: Record<string, string> = {
  svg: "image/svg+xml", ico: "image/x-icon", png: "image/png", json: "application/manifest+json",
};
export const identityAssets = files.map(name => {
  const body = readFileSync(new URL(`../public/${name}`, import.meta.url));
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 12);
  const dot = name.lastIndexOf(".");
  return { name, body, type: types[name.slice(dot + 1)]!, path: `/${name}`,
    hashedPath: `/assets/${name.slice(0, dot)}-${hash}${name.slice(dot)}` };
});
export function identityPath(name: typeof files[number]) {
  return identityAssets.find(asset => asset.name === name)!.hashedPath;
}
