# Secrets and external credentials

Store production values in the Render service environment. Limit dashboard access, never paste values into issues/logs, and rotate a credential immediately if it enters Git history. Use separate staging and production credentials.

| Credential | Obtain it | Manage and rotate it |
|---|---|---|
| `SESSION_SECRET` | Generate with `openssl rand -hex 32`. | Render environment. Rotating invalidates outstanding CSRF and deletion-confirmation tokens; deploy during a quiet window. |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Dashboard → Turnstile → Add widget. | Public site key may appear in HTML; the secret stays in Render. Rotate in Cloudflare, update both values together, then test every public form. |
| `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` | Cloudflare Zero Trust → Settings for the team domain; Access → Applications → the `/admin*` application for its audience tag. | These identify the JWT issuer/audience rather than granting API access. Maintain the SSO + mandatory-2FA policy in Zero Trust and remove former admins there. |
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → account overview / R2. | Identifier, not a secret; keep it with the response-storage configuration. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare R2 → Manage R2 API tokens → create an object read/write token scoped to the response bucket. | Render environment. Create the replacement first, update Render, test upload/admin download, then revoke the old token. Never use a global account token. |
| `R2_BUCKET` | Create a private bucket in Cloudflare R2. | Keep it private. The app serves files only to Access-authenticated admins. `R2_ENDPOINT`/`R2_REGION` are configuration for another S3-compatible provider. |
| `EMAIL_PROVIDER_API_KEY` | Resend dashboard → API Keys (the implementation uses Resend's HTTPS API). | Scope to sending mail, store in Render, rotate by overlapping keys when possible, and review provider delivery logs without logging verification URLs. |
| `EMAIL_FROM` | Verify a sender domain/address in Resend (DNS records are managed in Cloudflare or the authoritative DNS provider). | Configuration rather than a secret. Re-verify after domain/DNS changes; use a campaign-owned address. |
| `BACKUP_S3_ACCESS_KEY` / `BACKUP_S3_SECRET_KEY` | Create a read/write token at the external S3/R2/B2 provider, scoped only to the backup bucket. | Store in Render. Rotate by updating Render, running `npm run backup`, restoring that object to a scratch path, then revoking the old key. |
| `BACKUP_S3_ENDPOINT` / `BACKUP_S3_BUCKET` / `BACKUP_S3_REGION` | The chosen external object's S3-compatible endpoint, private bucket, and signing region. | Configuration rather than secret. Use a bucket outside the Render disk failure domain and lifecycle rules retaining ≥7 daily and weekly copies. |

`PORT`, `NODE_ENV`, `APP_BASE_URL`, `SQLITE_PATH`, `R2_PUBLIC_URL`, and `RATE_LIMIT_*` are configuration, not credentials. Render sets `PORT`; the Blueprint sets `/data/app.db`. `R2_PUBLIC_URL` is intentionally unused because response evidence is private.

## Cloudflare Access policy

Create a self-hosted Access application covering both the public domain's `/admin*` path and any direct hostname policy Cloudflare supports. Require the intended identity group and 2FA. The origin still validates every JWT; absent, expired, wrong-audience, or wrong-issuer tokens receive 403, including direct `onrender.com` access.

## Rotation checklist

1. Create the replacement credential with the minimum scope.
2. Update it in Render without deleting the old provider credential.
3. Redeploy and test the exact dependent path.
4. Revoke the old credential.
5. Record who rotated it and when in the team's secret manager—not in this repository.

