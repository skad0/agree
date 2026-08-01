# AWS S3 operations guide

This guide configures the app's external SQLite backups and immutable erasure
ledger on **AWS S3**. It is an operator procedure, not evidence that AWS has
been configured for this repository. Keep both buckets private and use
separate credentials and buckets for backups and the ledger.

## 1. Architecture and environment mapping

Create two buckets in the required AWS region:

- `backup`: private and versioned; contains `daily/` and `weekly/` backups.
- `erasure-ledger`: private, versioned, and created with S3 Object Lock
  enabled; contains the signed manifest and event objects.

The app's S3-compatible client requires an HTTPS endpoint, AWS SigV4, and
**path-style** requests (`/<bucket>/<key>`), rather than virtual-hosted
requests. For AWS, use a regional endpoint such as
`https://s3.eu-west-1.amazonaws.com`, and set the region to the actual AWS
region (`eu-west-1` there). Do not use `auto` for either `*_S3_REGION`.
Do not put credentials in an endpoint URL.

Set these values in Render (names and bucket names are non-secret; keys and
HMAC material are secret):

| Variable | AWS S3 value |
|---|---|
| `BACKUP_S3_ENDPOINT` | Regional S3 endpoint, e.g. `https://s3.us-east-1.amazonaws.com` |
| `BACKUP_S3_ACCESS_KEY` / `BACKUP_S3_SECRET_KEY` | Credentials for the backup-writer role |
| `BACKUP_S3_BUCKET` | Private backup bucket name |
| `BACKUP_S3_REGION` | Actual bucket region, e.g. `us-east-1` |
| `ERASURE_LEDGER_S3_ENDPOINT` | Regional S3 endpoint in the ledger region |
| `ERASURE_LEDGER_S3_ACCESS_KEY` / `ERASURE_LEDGER_S3_SECRET_KEY` | Credentials for the runtime ledger-writer role |
| `ERASURE_LEDGER_S3_BUCKET` | Private Object-Lock-enabled ledger bucket name |
| `ERASURE_LEDGER_S3_REGION` | Actual ledger bucket region, never `auto` |
| `ERASURE_LEDGER_HMAC_KEYS` | Versioned `version:base64url-key` entries; preserve historical entries |
| `ERASURE_LEDGER_ACTIVE_KEY_VERSION` | Version selected for new signatures |
| `PRIVACY_CONTACT_EMAIL` | Real operational privacy contact address |

Escrow HMAC keys outside the deployment. Never commit, print, or put them in
this guide.

## 2. Create and protect the ledger bucket

1. Choose the region and create the ledger bucket with **Object Lock enabled
   at bucket creation** (the S3 `ObjectLockEnabledForBucket` option). Enable
   versioning as part of setup. Object Lock cannot be retrofitted.
2. Block all public access, disable public ACL/policies, and require HTTPS.
3. Prefer **Compliance mode**. Set default retention to at least 120 days;
   121–125 days gives useful margin. Confirm the default covers the manifest
   and event prefixes.
4. A bucket default is necessary: the current app sends ordinary PUTs and
   does not set Object-Lock headers.
5. Bootstrap the signed manifest at `erasure-ledger/v1/manifest.json` and
   retain event objects under `erasure-events/v1/`. Runtime has no delete
   permission and no runtime delete operation. Use legal holds only when an
   explicit legal process requires one, not for routine retention.

Object Lock does not prevent new versions or delete markers; it prevents
deletion of protected versions until their retention permits it.

## 3. Create and lifecycle the backup bucket

1. Create a separate private bucket, enable versioning, block public access,
   and require HTTPS.
2. Configure lifecycle actions explicitly for current versions, noncurrent
   versions, expired delete markers, and incomplete multipart uploads. Select
   retention covering the required daily/weekly recovery horizon (the launch
   gate is 90 days).
3. A 90-day expiration for current objects alone is insufficient in a
   versioned bucket: old versions remain and delete markers accumulate.
   Verify each lifecycle action in operator evidence.

If backups must also be immutable, create this bucket with Object Lock at
creation and at least 90-day retention. Otherwise, versioning plus the
complete lifecycle above is recommended; do not add Object Lock later.

## 4. Least-privilege IAM

Use separate credentials for these roles:

- **Backup writer:** `s3:PutObject` only on `daily/*` and `weekly/*` in the
  backup bucket. No list, get, delete-version, lifecycle, or Object Lock
  permissions.
- **Runtime ledger writer:** `s3:PutObject` only on the ledger manifest and
  event prefixes. No delete, list, get, retention-bypass, bucket
  configuration, or Object Lock configuration permission.
- **Restore reader/list operator:** `s3:ListBucket` restricted to the backup
  and ledger prefixes, plus `s3:GetObject` and `s3:GetObjectVersion` on those
  same prefixes. Keep this credential out of the web process.
- **Break-glass Object Lock/bucket administrator:** separate approved role
  for bucket creation, versioning, Object Lock, retention/legal holds,
  lifecycle, encryption, and bucket-policy changes. Record every use.

Runtime roles must not have `s3:DeleteObjectVersion`,
`s3:BypassGovernanceRetention`, or Object-Lock configuration permissions. Do
not grant `s3:*`; scope bucket and object resources to these buckets/prefixes.

## 5. Encryption

SSE-S3 bucket-default encryption is the simple option and is sufficient for
many deployments. SSE-KMS adds customer-key control and audit detail, but
also adds cost, availability, and key-policy operations. With SSE-KMS, grant
writers the needed KMS `Encrypt`/`GenerateDataKey` permissions and the
restore reader `Decrypt`, scoped to the selected key. Test key rotation and
restore before choosing KMS.

## 6. Bootstrap and validation

After production values exist and default ledger retention is active, run:

```sh
npm run build && node dist/scripts/setup-erasure-ledger.js
```

Record only non-secret output, identifiers, Object Lock/lifecycle evidence,
and operator/time evidence. Never record keys or HMAC values.

1. Deploy and confirm the app boot/config check succeeds.
2. Trigger a backup; verify its prefix, encryption, version ID, writer scope,
   and private access.
3. Perform a controlled deletion; verify live deletion, queued attachment
   work, and a new protected ledger event without exposing personal content.
4. Stop the service and run a scratch restore with the separate restore
   reader. Confirm no `app.db-wal` or `app.db-shm` sidecars, then use the
   exact README flags:

   ```sh
   AGREE_RESTORE_SERVICE_STOPPED=1 AGREE_RESTORE_CONFIRMED=1 npm run restore -- daily/2026-07-19.db
   ```

   Inspect the non-PII deterministic report and integrity/foreign-key checks
   before activation. Never restore against a live writer. Restore
   intentionally fails closed when the ledger is unavailable, incomplete, or
   fails authentication.

## 7. Ongoing operations

Rotate credentials by creating replacements, testing, then revoking old ones.
Escrow every historical HMAC key for the life of restorable backups. Prefer
Compliance mode for the ledger; Governance permits an authorized retention
bypass. Budget for retained versions, Object Lock storage, requests, KMS, and
restore transfer. Lifecycle cannot delete a protected version, though it may
create delete markers or process eligible versions. Retain lifecycle,
version, Object Lock, IAM, encryption, bootstrap, backup, deletion, and
scratch-restore evidence without personal appeal text. No bucket is public.

## 8. Troubleshooting and irreversible choices

- Object Lock cannot be enabled later. Create a correct new bucket and make a
  deliberate, documented migration; do not treat a copy as immutable before
  its new versions are protected.
- A protected-version delete returning 403 is expected. Do not grant runtime
  bypass; wait for retention or use an approved process.
- Changing default retention does not shorten existing object retention.
- For a wrong bucket, region, endpoint, or `auto` region, correct environment
  and IAM scope and rerun validation. Redact diagnostics and rotate any
  disclosed secret; never expose credentials.

## Official AWS references

- [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html)
- [`CreateBucket` and `ObjectLockEnabledForBucket`](https://docs.aws.amazon.com/AmazonS3/latest/API/API_CreateBucket.html)
- [Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html)
- [Lifecycle configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [S3 IAM authorization](https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazons3.html)
- [S3 server-side encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/serv-side-encryption.html)
