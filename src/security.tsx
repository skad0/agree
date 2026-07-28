import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Config } from "./config.js";

const REQUEST_CAPABILITY_TTL_SECONDS = 24 * 60 * 60;
const REQUEST_CAPABILITY_DOMAIN = "agree/request-capability/v1\0";
const RESPONSE_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const RESPONSE_TOKEN_DOMAIN = "agree/response-submission/v1\0";

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

/** Issue an opaque, non-persisted capability bound to one generated request. */
export function issueRequestCapability(requestId: number, config: Config, now = Date.now()) {
  const canonicalId = canonicalRequestId(requestId);
  if (!canonicalId) throw new RangeError("requestId must be a positive safe integer");
  const expires = Math.floor(now / 1000) + REQUEST_CAPABILITY_TTL_SECONDS;
  const payload = `${canonicalId}.${expires}`;
  return `v1.${payload}.${requestCapabilitySignature(payload, config.sessionSecret)}`;
}

/** Verify syntax, request binding, expiry, and the HMAC without accepting malformed tokens. */
export function verifyRequestCapability(token: unknown, requestId: number, config: Config, now = Date.now()) {
  const canonicalId = canonicalRequestId(requestId);
  if (!canonicalId || typeof token !== "string" || !/^v1\.[1-9]\d*\.\d{10,13}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[1] !== canonicalId) return false;
  const expires = Number(parts[2]);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(now / 1000)) return false;
  const expected = requestCapabilitySignature(`${parts[1]}.${parts[2]}`, config.sessionSecret);
  const actual = Buffer.from(parts[3]!, "ascii");
  const wanted = Buffer.from(expected, "ascii");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function issueResponseSubmissionToken(config: Config, now = Date.now()) {
  const issued = Math.floor(now / 1000);
  const expires = issued + RESPONSE_TOKEN_TTL_SECONDS;
  const nonce = randomBytes(32).toString("base64url");
  const payload = `v1.${issued}.${expires}.${nonce}`;
  return `${payload}.${responseTokenSignature(payload, config.sessionSecret)}`;
}

export function verifyResponseSubmissionToken(token: unknown, config: Config, now = Date.now()) {
  if (typeof token !== "string" || !/^v1\.\d{10,13}\.\d{10,13}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const parts = token.split(".");
  const issued = Number(parts[1]); const expires = Number(parts[2]);
  if (!Number.isSafeInteger(issued) || !Number.isSafeInteger(expires) || expires <= issued || issued > Math.floor(now / 1000) || expires <= Math.floor(now / 1000)) return false;
  const expected = responseTokenSignature(parts.slice(0, 4).join("."), config.sessionSecret);
  const actual = Buffer.from(parts[4]!, "ascii"); const wanted = Buffer.from(expected, "ascii");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function hashResponseSubmissionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
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

function canonicalRequestId(value: number) {
  return Number.isSafeInteger(value) && value > 0 ? String(value) : "";
}

function requestCapabilitySignature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(REQUEST_CAPABILITY_DOMAIN + payload).digest("base64url");
}

function responseTokenSignature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(RESPONSE_TOKEN_DOMAIN + payload).digest("base64url");
}
