import { getStoreObject } from "../src/s3.js";
import { loadConfig } from "../src/config.js";
import { ERASURE_LEDGER_MANIFEST_KEY, setupErasureLedger, verifyErasureLedgerManifest } from "../src/erasure-ledger.js";

if (process.argv.includes("--help")) throw new Error("Usage: npm run build && node dist/scripts/setup-erasure-ledger.js");
const config = loadConfig();
const manifest = await setupErasureLedger(config);
const store = {
  endpoint: config.erasureLedger.endpoint!, accessKey: config.erasureLedger.accessKey!, secretKey: config.erasureLedger.secretKey!,
  bucket: config.erasureLedger.bucket!, region: config.erasureLedger.region
};
const fetched = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await getStoreObject(store, ERASURE_LEDGER_MANIFEST_KEY))) as unknown;
if (!verifyErasureLedgerManifest(config, fetched)) throw new Error("Ledger manifest verification failed after upload");
console.log(JSON.stringify({ key: ERASURE_LEDGER_MANIFEST_KEY, keyVersion: manifest.keyVersion, verified: true }));
