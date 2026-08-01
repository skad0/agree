import { createHash, createHmac } from "node:crypto";
import type { Config } from "./config.js";

export const RESPONSE_PUT_TIMEOUT_MS = 30_000;

export function hasObjectStorage(config: Config) {
  return Boolean(config.r2AccountId && config.r2AccessKeyId && config.r2SecretAccessKey && config.r2Bucket);
}

export type Store = { endpoint?: string; accountId?: string; accessKey: string; secretKey: string; bucket: string; region: string };

export function responseStore(config: Config): Store {
  if (!hasObjectStorage(config)) throw new Error("Object storage is not configured");
  return { endpoint: config.r2Endpoint, accountId: config.r2AccountId, accessKey: config.r2AccessKeyId!, secretKey: config.r2SecretAccessKey!, bucket: config.r2Bucket!, region: config.r2Region };
}

export function erasureLedgerStore(config: Config): Store {
  const ledger = config.erasureLedger;
  if (!ledger.endpoint || !ledger.accessKey || !ledger.secretKey || !ledger.bucket) throw new Error("Erasure ledger storage is not configured");
  return { endpoint: ledger.endpoint, accessKey: ledger.accessKey, secretKey: ledger.secretKey, bucket: ledger.bucket, region: ledger.region };
}

export async function putErasureLedgerObject(config: Config, key: string, data: Uint8Array) {
  return putStoreObject(erasureLedgerStore(config), key, "application/json", data, config.erasureLedgerPutTimeoutMs);
}

export async function putObject(config: Config, key: string, mime: string, data: Uint8Array, timeoutMs = config.responsePutTimeoutMs ?? RESPONSE_PUT_TIMEOUT_MS) {
  return putStoreObject(responseStore(config), key, mime, data, timeoutMs);
}

export async function putStoreObject(store: Store, key: string, mime: string, data: Uint8Array, timeoutMs = RESPONSE_PUT_TIMEOUT_MS) {
  const base = new URL(store.endpoint ?? `https://${store.accountId}.r2.cloudflarestorage.com`);
  const path = `/${encodeURIComponent(store.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const url = new URL(path, base);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = hash(data);
  const canonicalHeaders = `content-type:${mime}\nhost:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const scope = `${date}/${store.region}/s3/aws4_request`;
  const canonicalRequest = `PUT\n${url.pathname}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${store.secretKey}`, date), store.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const response = await fetch(url, {
    method: "PUT",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "content-type": mime,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${store.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    },
    body: data as BodyInit
  });
  if (!response.ok) throw new Error(`Object upload failed (${response.status})`);
}

export async function getStoreObject(store: Store, key: string) {
  const base = new URL(store.endpoint ?? `https://${store.accountId}.r2.cloudflarestorage.com`);
  const path = `/${encodeURIComponent(store.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const url = new URL(path, base); const now = new Date(); const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); const date = amzDate.slice(0, 8);
  const payloadHash = hash(""); const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`; const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const scope = `${date}/${store.region}/s3/aws4_request`; const canonicalRequest = `GET\n${url.pathname}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${store.secretKey}`, date), store.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const response = await fetch(url, { headers: { "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, authorization: `AWS4-HMAC-SHA256 Credential=${store.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` } });
  if (!response.ok) throw new Error(`Object download failed (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

/** List a complete S3 prefix. An incomplete page is an error, never a partial result. */
export async function listStoreObjects(store: Store, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  const seenTokens = new Set<string>();
  for (;;) {
    if (token) { if (seenTokens.has(token)) throw new Error("Object listing repeated a continuation token"); seenTokens.add(token); }
    const base = new URL(store.endpoint ?? `https://${store.accountId}.r2.cloudflarestorage.com`);
    const url = new URL(`/${encodeURIComponent(store.bucket)}`, base);
    url.searchParams.set("list-type", "2"); url.searchParams.set("prefix", prefix);
    if (token) url.searchParams.set("continuation-token", token);
    const response = await signedRequest(store, url, "GET", "");
    if (!response.ok) throw new Error(`Object listing failed (${response.status})`);
    const xml = await response.text();
    const document = xml.replace(/^\s*<\?xml\s[^?]*\?>\s*/i, "").trim();
    if (!/^<ListBucketResult(?:\s[^>]*)?>[\s\S]*<\/ListBucketResult>$/.test(document)) throw new Error("Object listing response is incomplete or malformed");
    const markers = [...document.matchAll(/<IsTruncated>\s*(true|false)\s*<\/IsTruncated>/gi)];
    if (markers.length !== 1) throw new Error("Object listing must contain one valid IsTruncated field");
    const marker = markers[0]![1]!.toLowerCase();
    const truncated = marker === "true";
    const contents = [...document.matchAll(/<Contents(?:\s[^>]*)?>([\s\S]*?)<\/Contents>/gi)];
    if (tagCount(document, "Contents", false) !== tagCount(document, "Contents", true)) throw new Error("Object listing contents are not fully closed");
    for (const content of contents) {
      const match = content[1]!.match(/<Key>([\s\S]*?)<\/Key>/i);
      if (!match || !match[1] || /[\u0000-\u001f]/.test(match[1])) throw new Error("Object listing content has no valid key");
      const key = unescapeXml(match[1]);
      if (!key.startsWith(prefix)) throw new Error("Object listing returned a key outside its prefix");
      keys.push(key);
    }
    if (!truncated) return keys;
    const next = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/i)?.[1];
    if (!next || !(token = unescapeXml(next).trim()) || /[<>\u0000-\u001f]/.test(token)) throw new Error("Object listing was truncated without a valid continuation token");
  }
}

export async function listErasureLedgerObjects(config: Config) {
  return listStoreObjects(erasureLedgerStore(config), "erasure-events/v1/");
}

export async function deleteObject(config: Config, key: string) {
  return deleteStoreObject(responseStore(config), key);
}

export async function deleteStoreObject(store: Store, key: string) {
  const base = new URL(store.endpoint ?? `https://${store.accountId}.r2.cloudflarestorage.com`);
  const path = `/${encodeURIComponent(store.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`;
  const url = new URL(path, base); const now = new Date(); const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); const date = amzDate.slice(0, 8);
  const payloadHash = hash(""); const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`; const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const scope = `${date}/${store.region}/s3/aws4_request`; const canonicalRequest = `DELETE\n${url.pathname}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${store.secretKey}`, date), store.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const response = await fetch(url, { method: "DELETE", signal: AbortSignal.timeout(10_000), headers: { "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, authorization: `AWS4-HMAC-SHA256 Credential=${store.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` } });
  if (response.status >= 200 && response.status < 300 || response.status === 404) return;
  throw new Error(`Object delete failed (${response.status})`);
}

async function signedRequest(store: Store, url: URL, method: string, body: string) {
  const now = new Date(); const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); const date = amzDate.slice(0, 8);
  const payloadHash = hash(body); const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date"; const scope = `${date}/${store.region}/s3/aws4_request`;
  const canonicalRequest = `${method}\n${url.pathname}\n${canonicalQuery(url)}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${hash(canonicalRequest)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${store.secretKey}`, date), store.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return fetch(url, { method, signal: AbortSignal.timeout(30_000), headers: { "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate, authorization: `AWS4-HMAC-SHA256 Credential=${store.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` } });
}

function unescapeXml(value: string) { return value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&"); }
function canonicalQuery(url: URL) {
  return [...url.searchParams].map(([key, value]) => [rfc3986(key), rfc3986(value)] as const).sort(([a, b], [c, d]) => a === c ? b.localeCompare(d) : a.localeCompare(c)).map(([key, value]) => `${key}=${value}`).join("&");
}
function rfc3986(value: string) { return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`); }
function tagCount(xml: string, name: string, closing: boolean) { return [...xml.matchAll(new RegExp(`<${closing ? "/" : ""}${name}(?:\\s[^>]*)?>`, "gi"))].length; }

function hash(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key: string | Buffer, value: string) { return createHmac("sha256", key).update(value).digest(); }
