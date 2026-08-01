import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Config } from "./config.js";
import { putErasureLedgerObject } from "./s3.js";

const SUBJECT_DOMAIN = "agree/erasure-subject/v1\0";
const EVENT_DOMAIN = "agree/erasure-event/v1\0";
const MANIFEST_DOMAIN = "agree/erasure-manifest/v1\0";
export const ERASURE_EVENT_SCHEMA_VERSION = "v1";
export const ERASURE_LEDGER_MANIFEST_KEY = "erasure-ledger/v1/manifest.json";
export type ErasureEvent = { schemaVersion: typeof ERASURE_EVENT_SCHEMA_VERSION; eventId: string; keyVersion: string; subjectTag: string; eraseThrough: string; recordedAt: string; mac: string };
export type ErasureLedgerManifest = { schemaVersion: typeof ERASURE_EVENT_SCHEMA_VERSION; ledgerPrefix: "erasure-events/v1/"; keyVersion: string; createdAt: string; mac: string };

export function normalizeSubject(value: string) { return value.trim().toLowerCase(); }
export function createErasureEvent(config: Config, normalizedEmail: string, eraseThrough: string, recordedAt = eraseThrough, eventId = randomBytes(32).toString("base64url")): ErasureEvent {
  if (!isIsoTimestamp(eraseThrough) || !isIsoTimestamp(recordedAt)) throw new Error("Erasure event timestamps must be canonical ISO timestamps");
  const version = config.erasureLedger.activeVersion; const key = version ? config.erasureLedger.keys.get(version) : undefined; if (!version || !key) throw new Error("Erasure ledger signing key is not configured");
  const subjectTag = hmac(key, SUBJECT_DOMAIN + normalizeSubject(normalizedEmail)); const canonical = canonicalEvent({ schemaVersion: ERASURE_EVENT_SCHEMA_VERSION, eventId, keyVersion: version, subjectTag, eraseThrough, recordedAt });
  return { ...canonical, mac: hmac(key, EVENT_DOMAIN + canonicalRepresentation(canonical)) };
}
export function verifyErasureEvent(config: Config, event: ErasureEvent) { const key = config.erasureLedger.keys.get(event.keyVersion); if (!key || !isValidEvent(event)) return false; return safeEqual(event.mac, hmac(key, EVENT_DOMAIN + canonicalRepresentation(canonicalEvent(event)))); }
export function parseErasureEvent(data: Uint8Array): ErasureEvent {
  let value: unknown; try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data)); } catch { throw new Error("Erasure ledger event is not valid JSON"); }
  if (!isValidEvent(value)) throw new Error("Erasure ledger event schema is invalid");
  return value;
}
export function subjectTag(config: Config, keyVersion: string, normalizedEmail: string) { const key = config.erasureLedger.keys.get(keyVersion); if (!key) throw new Error("Erasure ledger key version is unknown"); return hmac(key, SUBJECT_DOMAIN + normalizeSubject(normalizedEmail)); }
export function eventDigest(events: ErasureEvent[]) { return createHash("sha256").update(events.map((event) => JSON.stringify(event)).join("\n")).digest("hex"); }
export function serializeErasureEvent(event: ErasureEvent) { return new TextEncoder().encode(JSON.stringify(event)); }
export function createErasureLedgerManifest(config: Config, createdAt = new Date().toISOString()): ErasureLedgerManifest {
  const keyVersion = config.erasureLedger.activeVersion; const key = keyVersion ? config.erasureLedger.keys.get(keyVersion) : undefined;
  if (!keyVersion || !key || !isIsoTimestamp(createdAt)) throw new Error("Erasure ledger signing key is not configured");
  const body: Omit<ErasureLedgerManifest, "mac"> = { schemaVersion: ERASURE_EVENT_SCHEMA_VERSION, ledgerPrefix: "erasure-events/v1/", keyVersion, createdAt };
  return { ...body, mac: hmac(key, MANIFEST_DOMAIN + JSON.stringify([body.schemaVersion, body.ledgerPrefix, body.keyVersion, body.createdAt])) };
}
export function serializeErasureLedgerManifest(manifest: ErasureLedgerManifest) { return new TextEncoder().encode(JSON.stringify(manifest)); }
export function verifyErasureLedgerManifest(config: Config, value: unknown) {
  const manifest = value as Partial<ErasureLedgerManifest>; const key = typeof manifest?.keyVersion === "string" ? config.erasureLedger.keys.get(manifest.keyVersion) : undefined;
  if (!key || manifest.schemaVersion !== ERASURE_EVENT_SCHEMA_VERSION || manifest.ledgerPrefix !== "erasure-events/v1/" || typeof manifest.createdAt !== "string" || !isIsoTimestamp(manifest.createdAt) || typeof manifest.mac !== "string") return false;
  return safeEqual(manifest.mac, hmac(key, MANIFEST_DOMAIN + JSON.stringify([manifest.schemaVersion, manifest.ledgerPrefix, manifest.keyVersion, manifest.createdAt])));
}
export async function setupErasureLedger(config: Config) { const manifest = createErasureLedgerManifest(config); await putErasureLedgerObject(config, ERASURE_LEDGER_MANIFEST_KEY, serializeErasureLedgerManifest(manifest)); return manifest; }
export async function recordErasureEvent(config: Config, normalizedEmail: string, eraseThrough: string) { const event = createErasureEvent(config, normalizedEmail, eraseThrough); await putErasureLedgerObject(config, `erasure-events/v1/${event.eventId}.json`, serializeErasureEvent(event)); return event; }
function canonicalEvent(event: Omit<ErasureEvent, "mac"> | ErasureEvent) { return { schemaVersion: event.schemaVersion, eventId: event.eventId, keyVersion: event.keyVersion, subjectTag: event.subjectTag, eraseThrough: event.eraseThrough, recordedAt: event.recordedAt }; }
function canonicalRepresentation(event: Omit<ErasureEvent, "mac">) { return JSON.stringify([event.schemaVersion, event.eventId, event.keyVersion, event.subjectTag, event.eraseThrough, event.recordedAt]); }
function hmac(key: Buffer, value: string) { return createHmac("sha256", key).update(value).digest("base64url"); }
function isIsoTimestamp(value: string) { return Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
function isValidEvent(value: unknown): value is ErasureEvent { const event = value as Partial<ErasureEvent>; return !!event && event.schemaVersion === ERASURE_EVENT_SCHEMA_VERSION && typeof event.eventId === "string" && /^[A-Za-z0-9_-]{8,}$/.test(event.eventId) && typeof event.keyVersion === "string" && typeof event.subjectTag === "string" && /^[A-Za-z0-9_-]{40,}$/.test(event.subjectTag) && typeof event.eraseThrough === "string" && isIsoTimestamp(event.eraseThrough) && typeof event.recordedAt === "string" && isIsoTimestamp(event.recordedAt) && typeof event.mac === "string" && /^[A-Za-z0-9_-]{40,}$/.test(event.mac); }
function safeEqual(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }
