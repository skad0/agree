import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type SelectionSecrets = { sessionSecret: string };

export const SELECTION_MAX = 5;
export const SELECTION_TTL_SECONDS = 2 * 60 * 60;

const SELECTION_DOMAIN = "agree/recipient-selection/v1\0";
const CONTACT_PROOF_DOMAIN = "agree/request-contact-proof/v1\0";

export type PublicationRef = { electionId: number; publicationId: number } | null;

export type SelectionHandoff = {
  demandIds: number[];
  remainingIds: number[];
};

export type SelectionBasket = {
  ids: number[];
  electionId: number | null;
  publicationId: number | null;
  exp: number;
  handoff: SelectionHandoff | null;
};

export type BasketRead =
  | { ok: true; basket: SelectionBasket }
  | { ok: false; reason: "tampered" | "expired" | "version"; basket: SelectionBasket };

export type AddResult = { basket: SelectionBasket; error?: "limit" | "ineligible" };

export type ContactDestination = {
  id: number;
  name: string;
  email: string | null;
  whatsapp: string | null;
  contactable: boolean;
  /** How the address was chosen for send/review. Direct recipient fields win over party fallback. */
  channel: "direct" | "party_fallback" | "none";
};

export type SharedMailboxGroup = {
  key: string;
  count: number;
  ids: number[];
};

type Wire = {
  ids: number[];
  electionId: number | null;
  publicationId: number | null;
  exp: number;
  demandIds: number[] | null;
  remainingIds: number[] | null;
};

export function emptyBasket(now = Date.now(), publication: PublicationRef = null): SelectionBasket {
  return {
    ids: [],
    electionId: publication?.electionId ?? null,
    publicationId: publication?.publicationId ?? null,
    exp: Math.floor(now / 1000) + SELECTION_TTL_SECONDS,
    handoff: null
  };
}

export function readBasket(token: unknown, config: SelectionSecrets, options: { now?: number; publication?: PublicationRef } = {}): BasketRead {
  const now = options.now ?? Date.now();
  const publication = options.publication ?? null;
  const fresh = emptyBasket(now, publication);
  if (typeof token !== "string" || !token.trim()) return { ok: true, basket: fresh };
  if (!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: "tampered", basket: fresh };
  const parts = token.split(".");
  const payload = parts[1]!;
  const mac = parts[2]!;
  const expected = selectionMac(payload, config.sessionSecret);
  const actual = Buffer.from(mac, "ascii");
  const wanted = Buffer.from(expected, "ascii");
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return { ok: false, reason: "tampered", basket: fresh };
  const basket = parseWire(payload);
  if (!basket) return { ok: false, reason: "tampered", basket: fresh };
  if (!samePublication(basket, publication)) return { ok: false, reason: "version", basket: fresh };
  if (basket.exp <= Math.floor(now / 1000)) return { ok: false, reason: "expired", basket: fresh };
  return { ok: true, basket };
}

export function signBasket(basket: SelectionBasket, config: SelectionSecrets): string {
  const payload = Buffer.from(JSON.stringify(toWire(basket)), "utf8").toString("base64url");
  return `v1.${payload}.${selectionMac(payload, config.sessionSecret)}`;
}

export function addRecipient(basket: SelectionBasket, id: number, eligible: ReadonlySet<number>, now = Date.now()): AddResult {
  if (!Number.isInteger(id) || id <= 0 || !eligible.has(id)) return { basket, error: "ineligible" };
  if (basket.ids.includes(id)) return { basket };
  if (basket.ids.length >= SELECTION_MAX) return { basket, error: "limit" };
  return { basket: touch({ ...basket, ids: [...basket.ids, id], handoff: null }, now) };
}

export function removeRecipient(basket: SelectionBasket, id: number, now = Date.now()): SelectionBasket {
  const ids = basket.ids.filter((item) => item !== id);
  const handoff = basket.handoff
    ? { demandIds: basket.handoff.demandIds, remainingIds: basket.handoff.remainingIds.filter((item) => item !== id) }
    : null;
  return touch({ ...basket, ids, handoff: ids.length ? handoff : null }, now);
}

export function beginHandoff(basket: SelectionBasket, demandIds: number[]): SelectionBasket | undefined {
  const unique = uniquePositive(demandIds);
  if (!unique.length || !basket.ids.length) return undefined;
  return { ...basket, handoff: { demandIds: unique, remainingIds: [...basket.ids] } };
}

export function completeCurrent(basket: SelectionBasket): SelectionBasket {
  if (!basket.handoff) return basket;
  return { ...basket, handoff: { demandIds: basket.handoff.demandIds, remainingIds: basket.handoff.remainingIds.slice(1) } };
}

export function currentRecipientId(basket: SelectionBasket): number | undefined {
  if (basket.handoff) return basket.handoff.remainingIds[0];
  return basket.ids[0];
}

export function contactFingerprint(destination: Pick<ContactDestination, "email" | "whatsapp">): string {
  return createHash("sha256").update(`${(destination.email ?? "").trim().toLowerCase()}\n${(destination.whatsapp ?? "").trim()}`).digest("hex");
}

export function issueContactProof(requestId: number, fingerprint: string, config: SelectionSecrets, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + SELECTION_TTL_SECONDS;
  const payload = `${requestId}.${exp}.${fingerprint}`;
  return `v1.${payload}.${contactMac(payload, config.sessionSecret)}`;
}

export function verifyContactProof(token: unknown, requestId: number, fingerprint: string, config: SelectionSecrets, now = Date.now()): boolean {
  if (typeof token !== "string" || !/^v1\.[1-9]\d*\.\d{10,13}\.[a-f0-9]{64}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[1] !== String(requestId) || parts[3] !== fingerprint) return false;
  const exp = Number(parts[2]);
  if (!Number.isSafeInteger(exp) || exp <= Math.floor(now / 1000)) return false;
  const payload = `${parts[1]}.${parts[2]}.${parts[3]}`;
  const expected = contactMac(payload, config.sessionSecret);
  const actual = Buffer.from(parts[4]!, "ascii");
  const wanted = Buffer.from(expected, "ascii");
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function sharedMailboxGroups(rows: ContactDestination[]): SharedMailboxGroup[] {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = destinationKey(row);
    if (!key) continue;
    const ids = groups.get(key) ?? [];
    ids.push(row.id);
    groups.set(key, ids);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .map(([key, ids]) => ({ key, count: ids.length, ids }));
}

export function destinationKey(row: Pick<ContactDestination, "email" | "whatsapp">): string | null {
  const email = row.email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  const whatsapp = row.whatsapp?.trim();
  if (whatsapp) return `whatsapp:${whatsapp}`;
  return null;
}

function touch(basket: SelectionBasket, now: number): SelectionBasket {
  return { ...basket, exp: Math.floor(now / 1000) + SELECTION_TTL_SECONDS };
}

function samePublication(basket: SelectionBasket, publication: PublicationRef): boolean {
  return basket.electionId === (publication?.electionId ?? null) && basket.publicationId === (publication?.publicationId ?? null);
}

function toWire(basket: SelectionBasket): Wire {
  return {
    ids: basket.ids,
    electionId: basket.electionId,
    publicationId: basket.publicationId,
    exp: basket.exp,
    demandIds: basket.handoff?.demandIds ?? null,
    remainingIds: basket.handoff?.remainingIds ?? null
  };
}

function parseWire(payload: string): SelectionBasket | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const wire = parsed as Partial<Wire>;
  const ids = uniquePositive(wire.ids);
  if (!Array.isArray(wire.ids) || ids.length !== wire.ids.length || ids.length > SELECTION_MAX) return undefined;
  const electionId = optionalId(wire.electionId);
  const publicationId = optionalId(wire.publicationId);
  if (electionId === false || publicationId === false) return undefined;
  if (!Number.isSafeInteger(wire.exp) || (wire.exp as number) <= 0) return undefined;
  const demandIds = wire.demandIds === null ? null : Array.isArray(wire.demandIds) ? uniquePositive(wire.demandIds) : undefined;
  const remainingIds = wire.remainingIds === null ? null : Array.isArray(wire.remainingIds) ? uniquePositive(wire.remainingIds) : undefined;
  if (demandIds === undefined || remainingIds === undefined) return undefined;
  if ((demandIds === null) !== (remainingIds === null)) return undefined;
  if (demandIds && remainingIds) {
    if (!demandIds.length || demandIds.length !== wire.demandIds!.length) return undefined;
    if (remainingIds.length !== wire.remainingIds!.length) return undefined;
    if (remainingIds.some((id) => !ids.includes(id))) return undefined;
  }
  return {
    ids,
    electionId,
    publicationId,
    exp: wire.exp as number,
    handoff: demandIds && remainingIds ? { demandIds, remainingIds } : null
  };
}

function optionalId(value: unknown): number | null | false {
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  return false;
}

function uniquePositive(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const ids: number[] = [];
  for (const item of value) {
    if (!Number.isInteger(item) || item <= 0 || ids.includes(item)) return [];
    ids.push(item);
  }
  return ids;
}

function selectionMac(payload: string, secret: string) {
  return createHmac("sha256", secret).update(SELECTION_DOMAIN + payload).digest("base64url");
}

function contactMac(payload: string, secret: string) {
  return createHmac("sha256", secret).update(CONTACT_PROOF_DOMAIN + payload).digest("base64url");
}
