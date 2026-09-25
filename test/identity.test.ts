import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { locales } from "../src/i18n.js";

test("identity links resolve from localized pages and preserve strict CSP", async () => {
  const runtime = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test", APP_BASE_URL: "https://rafmeshutaf.org.il" } });
  try {
    for (const locale of locales) {
      const response = await runtime.app.request(`/${locale}`);
      const html = await response.text();
      assert.match(html, new RegExp(`<title>[^<]*${locale === "he" ? "רף משותף" : "Common Bar"}`));
      assert.doesNotMatch(response.headers.get("content-security-policy")!, /unsafe-inline/);
      assert.doesNotMatch(html, /\sstyle=/);
      const links = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)" href="([^"]+)"/g)];
      assert.equal(links.length, 4);
      for (const [, url] of links) {
        const asset = await runtime.app.request(url!);
        assert.equal(asset.status, 200, url);
        assert.match(asset.headers.get("cache-control")!, /immutable/);
      }
      const imageUrl = html.match(/property="og:image" content="([^"]+)"/)![1]!;
      assert.equal(new URL(imageUrl).origin, "https://rafmeshutaf.org.il");
      const image = await runtime.app.request(new URL(imageUrl).pathname);
      const bytes = Buffer.from(await image.arrayBuffer());
      assert.equal(bytes.readUInt32BE(16), 1200);
      assert.equal(bytes.readUInt32BE(20), 630);
      if (locale === "he") {
        const download = await runtime.app.request("/og-image.png");
        assert.deepEqual(bytes, Buffer.from(await download.arrayBuffer()));
      }
    }
    const scorecard = await runtime.app.request("/he/scorecard");
    assert.equal(scorecard.status, 200);
    assert.match(await scorecard.text(), /twitter:card" content="summary_large_image/);
  } finally { runtime.close(); }
});

test("stable identity downloads, manifest targets, and legacy ICO are usable", async () => {
  const runtime = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test" } });
  try {
    const response = await runtime.app.request("/manifest.json");
    assert.equal(response.headers.get("content-type"), "application/manifest+json");
    assert.match(response.headers.get("cache-control")!, /must-revalidate/);
    const manifest = await response.json();
    assert.equal((await runtime.app.request(manifest.start_url)).status, 200);
    assert.equal(manifest.icons.length, 2);
    for (const icon of manifest.icons) {
      assert.equal(icon.purpose, "any maskable");
      const response = await runtime.app.request(icon.src);
      assert.equal(response.headers.get("content-type"), icon.type);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
    }
    for (const [path, width, height] of [
      ["apple-touch-icon.png", 180, 180], ["x-profile-avatar.png", 400, 400],
      ["x-banner.png", 1500, 500], ["og-image.png", 1200, 630],
    ] as const) {
      const response = await runtime.app.request(`/${path}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/png");
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.readUInt32BE(16), width);
      assert.equal(bytes.readUInt32BE(20), height);
    }
    const ico = Buffer.from(await (await runtime.app.request("/favicon.ico")).arrayBuffer());
    assert.equal(ico.readUInt16LE(2), 1);
    assert.equal(ico.readUInt16LE(4), 3);
    assert.deepEqual([ico[6], ico[22], ico[38]], [16, 32, 48]);
    for (const name of ["favicon", "icon", "logo", "logo-light", "logo-mark", "logo-mark-light", "logo-monochrome", "x-profile-avatar", "x-banner", "og-image"]) {
      const response = await runtime.app.request(`/${name}.svg`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/svg+xml");
      const svg = await response.text();
      assert.match(svg, /viewBox="0 0 \d+ \d+"/);
      assert.doesNotMatch(svg, /<text\b|<style\b|<script\b|\sstyle=|<image\b|@font-face/);
    }
    assert.equal((await runtime.app.request("/source/NotoSans.ttf")).status, 404);
  } finally { runtime.close(); }
});
