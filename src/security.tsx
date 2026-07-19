import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Config } from "./config.js";

export function issueCsrf(context: Context, config: Config) {
  const nonce = randomBytes(18).toString("base64url");
  const token = `${nonce}.${signature(nonce, config.sessionSecret)}`;
  setCookie(context, "csrf", token, { httpOnly: true, secure: config.nodeEnv === "production", sameSite: "Lax", path: "/", maxAge: 7200 });
  return token;
}

export function validCsrf(context: Context, config: Config, body: Record<string, unknown>) {
  const token = text(body.csrf);
  const cookie = getCookie(context, "csrf");
  if (!token || token !== cookie) return false;
  const [nonce, mac] = token.split(".");
  if (!nonce || !mac) return false;
  const expected = signature(nonce, config.sessionSecret);
  return mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

export async function validTurnstile(context: Context, config: Config, body: Record<string, unknown>) {
  if (!config.turnstileSiteKey && !config.turnstileSecretKey) return true;
  if (!config.turnstileSiteKey || !config.turnstileSecretKey) return false;
  const token = text(body["cf-turnstile-response"]);
  if (!token) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: config.turnstileSecretKey, response: token, remoteip: clientIp(context) })
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: unknown };
    return result.success === true;
  } catch { return false; }
}

export function Turnstile({ config }: { config: Config }) {
  if (!config.turnstileSiteKey) return null;
  return <><div class="cf-turnstile" data-sitekey={config.turnstileSiteKey}></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script></>;
}

export function createRateLimiter() {
  const buckets = new Map<string, { count: number; resetsAt: number }>();
  return (context: Context, route: string, limit: number, windowSeconds: number) => {
    const key = `${route}:${clientIp(context)}`;
    const now = Date.now();
    // ponytail: in-memory limits fit the mandated single instance; move to edge storage if multi-instance is introduced.
    if (buckets.size > 10_000) for (const [bucketKey, bucket] of buckets) if (bucket.resetsAt <= now) buckets.delete(bucketKey);
    const current = buckets.get(key);
    if (!current || current.resetsAt <= now) {
      buckets.set(key, { count: 1, resetsAt: now + windowSeconds * 1000 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}

export function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function values(value: unknown) {
  return (Array.isArray(value) ? value : [value]).map(text).filter(Boolean);
}

function clientIp(context: Context) {
  return context.req.header("CF-Connecting-IP") ?? context.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "local";
}

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}
