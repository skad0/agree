import type { Db } from "../../db.js";
import type { ContactResolution } from "./types.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string | null {
  const stripped = raw.trim().replace(/^mailto:/i, "").trim();
  if (!stripped || stripped.includes(" ") || !EMAIL.test(stripped)) return null;
  return stripped.toLowerCase();
}

export type ResolveContactInput = {
  candidacyId: number;
  personEmail?: string | null;
  partyEmail?: string | null;
  partyId?: number | null;
  factionId?: number | null;
  factionEmail?: string | null;
  sourceRecordId?: number | null;
  observedAt?: string;
  resolvedAt?: string;
};

export function resolveContact(db: Db, input: ResolveContactInput): ContactResolution {
  const resolvedAt = input.resolvedAt ?? new Date().toISOString();
  const observedAt = input.observedAt ?? resolvedAt;

  const personEmail = input.personEmail ? normalizeEmail(input.personEmail) : null;
  if (personEmail) {
    const personId = candidacyPersonId(db, input.candidacyId);
    if (personId == null) return writeUnresolved(db, input.candidacyId, resolvedAt, "needs_review");
    const contactPointId = insertContactPoint(db, {
      personId,
      channel: "email",
      value: personEmail,
      sourceRecordId: input.sourceRecordId,
      observedAt
    });
    const resolution: ContactResolution = {
      level: "individual",
      contactPointId,
      ownerKind: "person",
      status: "verified"
    };
    writeResolution(db, input.candidacyId, resolution, resolvedAt);
    return resolution;
  }

  const partyEmail = input.partyEmail ? normalizeEmail(input.partyEmail) : null;
  if (partyEmail && input.partyId != null) {
    const contactPointId = insertContactPoint(db, {
      partyId: input.partyId,
      channel: "email",
      value: partyEmail,
      sourceRecordId: input.sourceRecordId,
      observedAt
    });
    const resolution: ContactResolution = {
      level: "party_fallback",
      contactPointId,
      ownerKind: "party",
      status: "verified"
    };
    writeResolution(db, input.candidacyId, resolution, resolvedAt);
    return resolution;
  }

  const factionEmail = input.factionEmail ? normalizeEmail(input.factionEmail) : null;
  if (factionEmail && input.factionId != null) {
    const contactPointId = insertContactPoint(db, {
      factionId: input.factionId,
      channel: "email",
      value: factionEmail,
      sourceRecordId: input.sourceRecordId,
      observedAt
    });
    const resolution: ContactResolution = {
      level: "party_fallback",
      contactPointId,
      ownerKind: "faction",
      status: "verified"
    };
    writeResolution(db, input.candidacyId, resolution, resolvedAt);
    return resolution;
  }

  return writeUnresolved(db, input.candidacyId, resolvedAt, "missing");
}

function candidacyPersonId(db: Db, candidacyId: number): number | null {
  const row = db.prepare("SELECT person_id AS personId FROM candidacies WHERE id = ?").get(candidacyId) as { personId: number | null } | undefined;
  return row?.personId ?? null;
}

function insertContactPoint(db: Db, row: {
  personId?: number;
  partyId?: number;
  factionId?: number;
  channel: "email";
  value: string;
  sourceRecordId?: number | null;
  observedAt: string;
}): number {
  const inserted = db.prepare(`INSERT INTO contact_points
    (person_id, party_id, faction_id, channel, value_normalized, source_record_id, observed_at, verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(
    row.personId ?? null,
    row.partyId ?? null,
    row.factionId ?? null,
    row.channel,
    row.value,
    row.sourceRecordId ?? null,
    row.observedAt,
    row.observedAt
  ) as { id: number };
  return inserted.id;
}

function writeUnresolved(db: Db, candidacyId: number, resolvedAt: string, status: "missing" | "needs_review"): ContactResolution {
  const resolution: ContactResolution = { level: "unresolved", contactPointId: null, ownerKind: null, status };
  writeResolution(db, candidacyId, resolution, resolvedAt);
  return resolution;
}

function writeResolution(db: Db, candidacyId: number, resolution: ContactResolution, resolvedAt: string): void {
  db.prepare(`INSERT INTO candidate_contact_resolutions
    (candidacy_id, contact_point_id, contact_level, contact_owner_kind, status, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    candidacyId,
    resolution.contactPointId,
    resolution.level,
    resolution.ownerKind,
    resolution.status,
    resolvedAt
  );
}
