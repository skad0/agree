# AWS S3 / object storage — not used

**Status: obsolete for the action-only deploy.**

The product persists on the Render `/data` SQLite disk. It does **not** require:

- external SQLite backup buckets (`BACKUP_S3_*`)
- Cloudflare R2 / S3 response-file buckets (`R2_*`)
- an immutable erasure-ledger bucket (`ERASURE_LEDGER_S3_*`)

Privacy deletion updates live SQLite. Reply uploads without object storage remain unavailable (text-only replies still work). Optional legacy CLI helpers (`npm run backup`, `npm run restore`, `setup-erasure-ledger`) may still exist in the tree for operators who deliberately configure unused object-store env vars; they are not part of production setup.

See [SECRETS.md](SECRETS.md) and [ACTION_ONLY_PRIVACY_PLAN.md](ACTION_ONLY_PRIVACY_PLAN.md).
