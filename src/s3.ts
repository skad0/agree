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

function hash(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key: string | Buffer, value: string) { return createHmac("sha256", key).update(value).digest(); }
