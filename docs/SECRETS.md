# Secrets and external credentials

For the recommended AWS S3 setup of the external backup and immutable
erasure-ledger stores, follow [AWS_S3_SETUP.md](AWS_S3_SETUP.md). This
repository does not create or configure AWS resources.

Store production values in the Render service environment. Limit dashboard access, never paste values into issues/logs, and rotate a credential immediately if it enters Git history. Use separate staging and production credentials.

| Credential | Obtain it | Manage and rotate it |
|---|---|---|
| `SESSION_SECRET` | Generate with `openssl rand -hex 32`. | Render environment. Rotating invalidates outstanding CSRF, deletion-confirmation, and response-submission tokens; deploy during a quiet window. |
| `TRUSTED_PROXY_SECRET` | Generate a separate high-entropy value, for example `openssl rand -hex 32`. | Render environment and the Cloudflare edge rule below. Rotate both sides together; requests with a missing or old proof are treated as direct/untrusted traffic. |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Dashboard → Turnstile → Add widget. | Public site key may appear in HTML; the secret stays in Render. Rotate in Cloudflare, update both values together, then test every public form. |
| `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` | Cloudflare Zero Trust → Settings for the team domain; Access → Applications → the `/admin*` application for its audience tag. | These identify the JWT issuer/audience rather than granting API access. Maintain the SSO + mandatory-2FA policy in Zero Trust and remove former admins there. |
| `ADMIN_EMAILS` | Chosen by you: comma-separated emails allowed to become app admins. | Not a secret, but an authorization boundary: Access controls who reaches `/admin`, this list controls who is provisioned as an admin inside the app. Keep it minimal; remove people both here and in Zero Trust. |
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → account overview / R2. | Identifier, not a secret; keep it with the response-storage configuration. |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Cloudflare R2 → Manage R2 API tokens → create an object read/write token scoped to the response bucket, including object delete. | Render environment. Grant only response-bucket `PutObject`, `GetObject`, and `DeleteObject`; create the replacement first, update Render, test upload/admin download/delete, then revoke the old token. Never use a global account token. |
| `R2_BUCKET` | Create a private bucket in Cloudflare R2. | Keep it private. The app serves files only to Access-authenticated admins. `R2_ENDPOINT`/`R2_REGION` are configuration for another S3-compatible provider. |
| `EMAIL_PROVIDER_API_KEY` | Resend dashboard → API Keys (the implementation uses Resend's HTTPS API). | Scope to sending mail, store in Render, rotate by overlapping keys when possible, and review provider delivery logs without logging verification URLs. |
| `EMAIL_FROM` | Verify a sender domain/address in Resend (DNS records are managed in Cloudflare or the authoritative DNS provider). | Configuration rather than a secret. Re-verify after domain/DNS changes; use a campaign-owned address. |
| `BACKUP_S3_ACCESS_KEY` / `BACKUP_S3_SECRET_KEY` | AWS credentials for a role scoped only to the private backup bucket's writer prefixes. | Store in Render. Rotate by updating Render, running `npm run backup`, restoring that object to a scratch path, then revoking the old key. |
| `BACKUP_S3_ENDPOINT` / `BACKUP_S3_BUCKET` / `BACKUP_S3_REGION` | AWS regional S3 endpoint, private versioned backup bucket, and actual AWS signing region; do not use `auto`. | Configuration rather than secret. Use the lifecycle and version controls in [AWS_S3_SETUP.md](AWS_S3_SETUP.md). |
| `ERASURE_LEDGER_S3_*` / `ERASURE_LEDGER_HMAC_KEYS` | Separate private, versioned AWS S3 bucket created with Object Lock, plus escrowed versioned HMAC keys. | Restore-only IAM should list/get the prefix; runtime has put-only access and no delete. Retain the prefix ≥120 days. Historical keys must remain available for restore. The HMAC and manifest checks are application authentication; AWS Object Lock supplies provider immutability. |

`PORT`, `NODE_ENV`, `APP_BASE_URL`, `SQLITE_PATH`, `R2_PUBLIC_URL`, and `RATE_LIMIT_*` are configuration, not credentials. Render sets `PORT`; the Blueprint sets `/data/app.db`. `R2_PUBLIC_URL` is intentionally unused because response evidence is private.

## Production perimeter contract

Production must have all of these values before the process will listen:

- `SESSION_SECRET`: non-empty, high entropy, and kept only in Render's secret environment.
- `APP_BASE_URL`: explicitly set to the public `https://` URL, with no credentials, query, or fragment.
- `TRUSTED_PROXY=cloudflare`.
- `TRUSTED_PROXY_SECRET`: a separate generated secret of at least 32 characters.

The application never uses `X-Forwarded-For`. It honors `CF-Connecting-IP` only when the request also contains an exact, constant-time-checked `X-Edge-Proxy-Proof` value equal to `TRUSTED_PROXY_SECRET`; otherwise all requests share the in-process fallback identity.

## Cloudflare edge-to-origin proof

Create a Cloudflare Transform Rule (or a Worker on the production route) that runs on every request forwarded to the origin:

1. Remove any incoming `X-Edge-Proxy-Proof` and `CF-Connecting-IP` values first.
2. Set `X-Edge-Proxy-Proof` to the secret value matching Render's `TRUSTED_PROXY_SECRET`.
3. Leave Cloudflare's single `CF-Connecting-IP` value for the client address.

Do not expose the proof value to browsers, redirects, logs, cache keys, or client-controlled request paths. A Worker must set the header on the origin subrequest after deleting the incoming copy; a Transform Rule must overwrite rather than append. Keep the production hostname proxied through Cloudflare and configure the origin firewall/network policy to allow only Cloudflare-to-origin traffic. Disable or restrict the direct Render hostname (and any origin IP) so a client cannot bypass the edge rule. The application still rejects unproved direct-origin headers, but network restriction prevents origin probing and resource abuse.

Cache only public `GET` pages and immutable same-origin assets. Bypass cache for every `POST`, `/admin*`, `/verify-email`, support/request/response/delete routes, requests carrying `Set-Cookie`, and all attachment responses. Never publish an object-storage URL for an attachment.

## Cloudflare Access policy

Create a self-hosted Access application covering both the public domain's `/admin*` path and any direct hostname policy Cloudflare supports. Require the intended identity group and 2FA. The origin still validates every JWT; absent, expired, wrong-audience, or wrong-issuer tokens receive 403, including direct `onrender.com` access.

## Rotation checklist

1. Create the replacement credential with the minimum scope.
2. Update it in Render without deleting the old provider credential.
3. Redeploy and test the exact dependent path.
4. Revoke the old credential.
5. Record who rotated it and when in the team's secret manager—not in this repository.

For `TRUSTED_PROXY_SECRET`, generate a replacement, update the Cloudflare rule and Render environment in a coordinated window, deploy, make a request through Cloudflare, and confirm the old proof is rejected before retiring the old value. For `SESSION_SECRET`, expect all outstanding signed sessions/tokens to become invalid.

## Deletion, backups, and verification

Privacy deletion removes/anonymizes matching live SQLite records and queues response attachment deletion. Object deletion is retried by maintenance and failures remain visible in application logs and work metadata. It cannot erase copies already written to external backup storage; the provider's 90-day lifecycle is the backup deletion control. Verify a deletion by checking the live record, attachment work queue/object state, and—without exposing personal data—confirming that the next backup follows the configured lifecycle. Perform a restore drill to a scratch database, run integrity checks, and repeat `/health`, Access, content, moderation, and attachment checks before treating the drill as complete.

Before launch, configure all production inputs before boot; keyless startup is only a local-development mode. For AWS bucket creation, Object Lock, lifecycle, IAM, encryption, and the stopped-service scratch restore, follow [AWS_S3_SETUP.md](AWS_S3_SETUP.md). Then run `npm run build && node dist/scripts/setup-erasure-ledger.js`; record its non-secret output and AWS evidence. These are manual launch gates, not controls configured by this repository.
