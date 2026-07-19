import { randomBytes } from "node:crypto";

export type Config = ReturnType<typeof loadConfig>;

const ephemeralSecret = randomBytes(32).toString("hex");

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = integer(env.PORT, 3000);
  return {
    port,
    nodeEnv: env.NODE_ENV ?? "development",
    appBaseUrl: env.APP_BASE_URL ?? `http://localhost:${port}`,
    sqlitePath: env.SQLITE_PATH ?? "data/app.db",
    sessionSecret: env.SESSION_SECRET ?? ephemeralSecret,
    isEphemeralSessionSecret: !env.SESSION_SECRET,
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
    rateLimitSupport: integer(env.RATE_LIMIT_SUPPORT, 5),
    rateLimitVerify: integer(env.RATE_LIMIT_VERIFY, 10),
    rateLimitPreview: integer(env.RATE_LIMIT_PREVIEW, 30),
    rateLimitAction: integer(env.RATE_LIMIT_ACTION, 30),
    rateLimitResponses: integer(env.RATE_LIMIT_RESPONSES, 3)
  };
}

function integer(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
