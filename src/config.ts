import { randomBytes } from "node:crypto";

export type Config = ReturnType<typeof loadConfig>;

const ephemeralSecret = randomBytes(32).toString("hex");

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = integer(env.PORT, 3000);
  const nodeEnv = env.NODE_ENV ?? "development";
  if (nodeEnv === "production" && !env.SESSION_SECRET) throw new Error("SESSION_SECRET is required in production");
  const privacyContactEmail = env.PRIVACY_CONTACT_EMAIL?.trim() || "[CAMPAIGN OPERATOR CONTACT TO BE ADDED BEFORE PRODUCTION]";
  const trustedProxy = env.TRUSTED_PROXY?.trim().toLowerCase();
  const trustedProxySecret = env.TRUSTED_PROXY_SECRET?.trim();
  if (trustedProxy && trustedProxy !== "cloudflare") throw new Error("TRUSTED_PROXY must be cloudflare or blank");
  if (nodeEnv === "production" && trustedProxy !== "cloudflare") throw new Error("TRUSTED_PROXY=cloudflare is required in production");
  if (nodeEnv === "production" && (!trustedProxySecret || trustedProxySecret.length < 32)) throw new Error("TRUSTED_PROXY_SECRET (at least 32 characters) is required in production");
  const appBaseUrl = env.APP_BASE_URL ?? `http://localhost:${port}`;
  if (nodeEnv === "production") {
    if (!env.APP_BASE_URL) throw new Error("APP_BASE_URL is required in production");
    let url: URL;
    try { url = new URL(appBaseUrl); } catch { throw new Error("APP_BASE_URL must be a valid HTTPS URL in production"); }
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) throw new Error("APP_BASE_URL must be a valid HTTPS URL in production");
  }
  if (nodeEnv === "production" && (!isEmail(privacyContactEmail) || privacyContactEmail.includes("CAMPAIGN OPERATOR CONTACT"))) throw new Error("PRIVACY_CONTACT_EMAIL must be a real email address in production");
  const erasureLedger = parseErasureLedger(env, nodeEnv === "production");
  return {
    port,
    nodeEnv,
    privacyContactEmail,
    appBaseUrl,
    sqlitePath: env.SQLITE_PATH ?? "data/app.db",
    sessionSecret: env.SESSION_SECRET ?? ephemeralSecret,
    isEphemeralSessionSecret: !env.SESSION_SECRET,
    trustedProxy: trustedProxy === "cloudflare" ? "cloudflare" as const : undefined,
    trustedProxySecret,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY,
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
    adminEmails: (env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
    accessTeamDomain: env.CF_ACCESS_TEAM_DOMAIN,
    accessAud: env.CF_ACCESS_AUD,
    accessTestJwks: env.NODE_ENV === "test" ? env.CF_ACCESS_TEST_JWKS : undefined,
    r2AccountId: env.R2_ACCOUNT_ID,
    r2AccessKeyId: env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: env.R2_SECRET_ACCESS_KEY,
    r2Bucket: env.R2_BUCKET,
    r2Endpoint: env.R2_ENDPOINT,
    r2Region: env.R2_REGION ?? "auto",
    emailApiKey: env.EMAIL_PROVIDER_API_KEY,
    emailFrom: env.EMAIL_FROM,
    backupEndpoint: env.BACKUP_S3_ENDPOINT,
    backupAccessKey: env.BACKUP_S3_ACCESS_KEY,
    backupSecretKey: env.BACKUP_S3_SECRET_KEY,
    backupBucket: env.BACKUP_S3_BUCKET,
    backupRegion: env.BACKUP_S3_REGION ?? "auto",
    erasureLedger,
    rateLimitSupport: integer(env.RATE_LIMIT_SUPPORT, 5),
    rateLimitVerify: integer(env.RATE_LIMIT_VERIFY, 10),
    rateLimitPreview: integer(env.RATE_LIMIT_PREVIEW, 30),
    rateLimitAction: integer(env.RATE_LIMIT_ACTION, 30),
    rateLimitResponses: integer(env.RATE_LIMIT_RESPONSES, 3),
    responsePutTimeoutMs: Math.min(integer(env.RESPONSE_PUT_TIMEOUT_MS, 30_000), 30_000),
    erasureLedgerPutTimeoutMs: Math.min(integer(env.ERASURE_LEDGER_PUT_TIMEOUT_MS, 10_000), 30_000)
  };
}

function parseErasureLedger(env: NodeJS.ProcessEnv, required: boolean) {
  const endpoint = env.ERASURE_LEDGER_S3_ENDPOINT?.trim(); const accessKey = env.ERASURE_LEDGER_S3_ACCESS_KEY?.trim();
  const secretKey = env.ERASURE_LEDGER_S3_SECRET_KEY; const bucket = env.ERASURE_LEDGER_S3_BUCKET?.trim();
  const region = env.ERASURE_LEDGER_S3_REGION?.trim() || "auto"; const activeVersion = env.ERASURE_LEDGER_ACTIVE_KEY_VERSION?.trim();
  const keys = parseLedgerKeys(env.ERASURE_LEDGER_HMAC_KEYS);
  if (required && (!endpoint || !accessKey || !secretKey || !bucket || !activeVersion || !keys.size)) throw new Error("Complete ERASURE_LEDGER_S3 and ERASURE_LEDGER_HMAC configuration is required in production");
  if (endpoint) { let parsed: URL; try { parsed = new URL(endpoint); } catch { throw new Error("ERASURE_LEDGER_S3_ENDPOINT must be a valid URL"); } if (!parsed.protocol.startsWith("http") || (required && parsed.protocol !== "https:") || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("ERASURE_LEDGER_S3_ENDPOINT must be a valid S3 URL"); }
  if (bucket !== undefined && (!bucket || bucket.length > 63 || !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(bucket))) throw new Error("ERASURE_LEDGER_S3_BUCKET is invalid");
  if (activeVersion && !keys.has(activeVersion)) throw new Error("ERASURE_LEDGER_ACTIVE_KEY_VERSION must name a configured HMAC key");
  return { endpoint, accessKey, secretKey, bucket, region, activeVersion, keys };
}

function parseLedgerKeys(value: string | undefined) {
  const keys = new Map<string, Buffer>(); if (!value?.trim()) return keys;
  for (const item of value.split(",")) { const [version, encoded, ...extra] = item.trim().split(":"); if (!version || !encoded || extra.length || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(version) || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error("ERASURE_LEDGER_HMAC_KEYS has an invalid versioned key set"); let key: Buffer; try { key = Buffer.from(encoded, "base64url"); } catch { throw new Error("ERASURE_LEDGER_HMAC_KEYS has an invalid key encoding"); } if (key.length < 32 || keys.has(version) || key.toString("base64url") !== encoded.replace(/=+$/, "")) throw new Error("ERASURE_LEDGER_HMAC_KEYS requires valid base64url keys"); keys.set(version, key); }
  return keys;
}

function integer(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
