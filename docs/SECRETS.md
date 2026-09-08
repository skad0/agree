# Secrets and external credentials

Object storage (AWS S3 / Cloudflare R2 / backup buckets / erasure-ledger buckets)
is **not** part of the default action-only deploy. Persistence is the Render
`/data` disk. This repository does not create or configure cloud object stores.

Store production values in the Render service environment. Limit dashboard access, never paste values into issues/logs, and rotate a credential immediately if it enters Git history. Use separate staging and production credentials.

| Credential | Obtain it | Manage and rotate it |
|---|---|---|
| `SESSION_SECRET` | Generate with `openssl rand -hex 32`. | Render environment. Rotating invalidates outstanding CSRF, deletion-confirmation, and response-submission tokens; deploy during a quiet window. |
| `TRUSTED_PROXY_SECRET` | Generate a separate high-entropy value, for example `openssl rand -hex 32`. | Render environment and the Cloudflare edge rule below. Rotate both sides together; requests with a missing or old proof are treated as direct/untrusted traffic. |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Cloudflare Dashboard → Turnstile → Add widget. | Public site key may appear in HTML; the secret stays in Render. Rotate in Cloudflare, update both values together, then test every public form. |
| `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD` | Cloudflare Zero Trust → Settings for the team domain; Access → Applications → the `/admin*` application for its audience tag. | These identify the JWT issuer/audience rather than granting API access. Maintain the SSO + mandatory-2FA policy in Zero Trust and remove former admins there. |
| `ADMIN_EMAILS` | Chosen by you: comma-separated emails allowed to become app admins. | Not a secret, but an authorization boundary: Access controls who reaches `/admin`, this list controls who is provisioned as an admin inside the app. Keep it minimal; remove people both here and in Zero Trust. |
| `EMAIL_PROVIDER_API_KEY` | Resend dashboard → API Keys (the implementation uses Resend's HTTPS API). | Scope to sending mail, store in Render, rotate by overlapping keys when possible, and review provider delivery logs without logging verification URLs. |
| `EMAIL_FROM` | Verify a sender domain/address in Resend (DNS records are managed in Cloudflare or the authoritative DNS provider). | Configuration rather than a secret. Re-verify after domain/DNS changes; use a campaign-owned address. |

`PORT`, `NODE_ENV`, `APP_BASE_URL`, `SQLITE_PATH`, and `RATE_LIMIT_*` are configuration, not credentials. Render sets `PORT`; the Blueprint sets `/data/app.db`.

## Production perimeter contract

Production must have all of these values before the process will listen:

- `SESSION_SECRET`: non-empty, high entropy, and kept only in Render's secret environment.
- `APP_BASE_URL`: explicitly set to the public `https://` URL, with no credentials, query, or fragment.
- `TRUSTED_PROXY=cloudflare`.
- `TRUSTED_PROXY_SECRET`: a separate generated secret of at least 32 characters.
- `PRIVACY_CONTACT_EMAIL`: a real operational address (not the development placeholder).

The application never uses `X-Forwarded-For`. It honors `CF-Connecting-IP` only when the request also contains an exact, constant-time-checked `X-Edge-Proxy-Proof` value equal to `TRUSTED_PROXY_SECRET`; otherwise all requests share the in-process fallback identity.

## Cloudflare edge-to-origin proof

Create a Cloudflare Transform Rule (or a Worker on the production route) that runs on every request forwarded to the origin:

1. Remove any incoming `X-Edge-Proxy-Proof` and `CF-Connecting-IP` values first.
2. Set `X-Edge-Proxy-Proof` to the secret value matching Render's `TRUSTED_PROXY_SECRET`.
3. Leave Cloudflare's single `CF-Connecting-IP` value for the client address.

Do not expose the proof value to browsers, redirects, logs, cache keys, or client-controlled request paths. A Worker must set the header on the origin subrequest after deleting the incoming copy; a Transform Rule must overwrite rather than append. Keep the production hostname proxied through Cloudflare and configure the origin firewall/network policy to allow only Cloudflare-to-origin traffic. Disable or restrict the direct Render hostname (and any origin IP) so a client cannot bypass the edge rule. The application still rejects unproved direct-origin headers, but network restriction prevents origin probing and resource abuse.

Cache only public `GET` pages and immutable same-origin assets. Bypass cache for every `POST`, `/admin*`, `/verify-email`, support/request/response/delete routes, and requests carrying `Set-Cookie`.

## Cloudflare Access policy

Create a self-hosted Access application covering both the public domain's `/admin*` path and any direct hostname policy Cloudflare supports. Require the intended identity group and 2FA. The origin still validates every JWT; absent, expired, wrong-audience, or wrong-issuer tokens receive 403, including direct `onrender.com` access.

## Rotation checklist

1. Create the replacement credential with the minimum scope.
2. Update it in Render without deleting the old provider credential.
3. Redeploy and test the exact dependent path.
4. Revoke the old credential.
5. Record who rotated it and when in the team's secret manager—not in this repository.

For `TRUSTED_PROXY_SECRET`, generate a replacement, update the Cloudflare rule and Render environment in a coordinated window, deploy, make a request through Cloudflare, and confirm the old proof is rejected before retiring the old value. For `SESSION_SECRET`, expect all outstanding signed sessions/tokens to become invalid.

## Deletion and verification

Privacy deletion removes/anonymizes matching live SQLite records. Reply-file object deletion only applies if an object store was previously configured; the default deploy has none. Verify a deletion by checking the live record without exposing personal data. Hosting disk snapshots may retain prior database copies according to the host's retention.

Before launch, configure the production perimeter inputs above; keyless startup is only a local-development mode.
