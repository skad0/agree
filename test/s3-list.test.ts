import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import { listStoreObjects, type Store } from "../src/s3.js";

const store: Store = { endpoint: "http://s3.test", accessKey: "access", secretKey: "secret", bucket: "ledger", region: "auto" };

test("ListObjectsV2 signs RFC3986 sorted queries across pages", async () => {
  const original = globalThis.fetch; const requests: URL[] = []; let page = 0;
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input)); requests.push(url); assert.equal(verifySignature(url, init?.headers as HeadersInit), true);
    page++; return new Response(page === 1 ? `<?xml version="1.0"?><ListBucketResult><Contents><Key>erasure-events/v1/a.json</Key></Contents><IsTruncated>true</IsTruncated><NextContinuationToken>token /+*</NextContinuationToken></ListBucketResult>` : `<?xml version="1.0"?><ListBucketResult><Contents><Key>erasure-events/v1/b.json</Key></Contents><IsTruncated>false</IsTruncated></ListBucketResult>`, { status: 200 });
  }) as typeof fetch;
  try { assert.deepEqual(await listStoreObjects(store, "erasure-events/v1/"), ["erasure-events/v1/a.json", "erasure-events/v1/b.json"]); } finally { globalThis.fetch = original; }
  assert.equal(requests[0]!.search, "?list-type=2&prefix=erasure-events%2Fv1%2F");
  assert.equal(requests[1]!.search, "?list-type=2&prefix=erasure-events%2Fv1%2F&continuation-token=token+%2F%2B*" /* URL serialization; signature uses RFC3986 */);
});

test("ListObjectsV2 rejects long token cycles and incomplete documents", async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0; globalThis.fetch = (async () => { calls++; return new Response(`<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>${calls === 1 ? "a" : "b"}</NextContinuationToken></ListBucketResult>`, { status: 200 }); }) as typeof fetch;
    await assert.rejects(listStoreObjects(store, "erasure-events/v1/"), /continuation token/);
    globalThis.fetch = (async () => new Response("<?xml version=\"1.0\"><ListBucketResult><IsTruncated>false</IsTruncated>", { status: 200 })) as typeof fetch;
    await assert.rejects(listStoreObjects(store, "erasure-events/v1/"), /incomplete|malformed/);
  } finally { globalThis.fetch = original; }
});

function verifySignature(url: URL, headers: HeadersInit) {
  const values = new Headers(headers); const amzDate = values.get("x-amz-date")!; const payloadHash = values.get("x-amz-content-sha256")!; const authorization = values.get("authorization")!; const signature = authorization.match(/Signature=([0-9a-f]+)$/)![1]!;
  const canonicalQuery = [...url.searchParams].map(([key, value]) => [encode(key), encode(value)] as const).sort(([a, b], [c, d]) => a === c ? b.localeCompare(d) : a.localeCompare(c)).map(([key, value]) => `${key}=${value}`).join("&");
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`; const signedHeaders = "host;x-amz-content-sha256;x-amz-date"; const canonical = `GET\n${url.pathname}\n${canonicalQuery}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`; const date = amzDate.slice(0, 8); const scope = `${date}/${store.region}/s3/aws4_request`; const key = hmac(hmac(hmac(hmac(`AWS4${store.secretKey}`, date), store.region), "s3"), "aws4_request");
  return createHmac("sha256", key).update(`AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonical)}`).digest("hex") === signature;
}
function encode(value: string) { return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`); }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key: string | Buffer, value: string) { return createHmac("sha256", key).update(value).digest(); }
