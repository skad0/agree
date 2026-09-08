import type { Db } from "../../db.js";
import { ALGORITHM_VERSION, normalizeHebrew } from "./normalize-hebrew.js";
import type { IdentityMatchProposal } from "./types.js";

export type ProposeMatchInput = {
  personId?: number | null;
  givenName: string;
  familyName: string;
  proposedKnessetPersonId?: string | null;
  score?: number | null;
  features?: Record<string, unknown>;
  createdAt?: string;
};

export function proposeIdentityMatch(db: Db, input: ProposeMatchInput): IdentityMatchProposal {
  const normalizedKey = normalizeHebrew(`${input.givenName} ${input.familyName}`);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const featuresJson = input.features ? JSON.stringify(input.features) : null;
  const row = db.prepare(`INSERT INTO identity_matches
    (person_id, proposed_knesset_person_id, normalized_key, algorithm_version, score, features_json, state, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?) RETURNING id`).get(
    input.personId ?? null,
    input.proposedKnessetPersonId ?? null,
    normalizedKey || null,
    ALGORITHM_VERSION,
    input.score ?? null,
    featuresJson,
    createdAt
  ) as { id: number };
  return {
    id: row.id,
    personId: input.personId ?? null,
    proposedKnessetPersonId: input.proposedKnessetPersonId ?? null,
    normalizedKey: normalizedKey || null,
    algorithmVersion: ALGORITHM_VERSION,
    score: input.score ?? null,
    featuresJson,
    createdAt,
    state: "pending"
  };
}

export function acceptIdentityMatch(db: Db, matchId: number, reviewer: string, reason?: string): IdentityMatchProposal | undefined {
  return decideMatch(db, matchId, "accepted", reviewer, reason);
}

export function rejectIdentityMatch(db: Db, matchId: number, reviewer: string, reason?: string): IdentityMatchProposal | undefined {
  return decideMatch(db, matchId, "rejected", reviewer, reason);
}

export function getIdentityMatch(db: Db, matchId: number): IdentityMatchProposal | undefined {
  const row = db.prepare(`SELECT id, person_id AS personId, proposed_knesset_person_id AS proposedKnessetPersonId,
    normalized_key AS normalizedKey, algorithm_version AS algorithmVersion, score, features_json AS featuresJson,
    state, created_at AS createdAt FROM identity_matches WHERE id = ?`).get(matchId) as
    | (Omit<IdentityMatchProposal, "state"> & { state: string })
    | undefined;
  if (!row) return undefined;
  if (row.state !== "pending" && row.state !== "accepted" && row.state !== "rejected") return undefined;
  return { ...row, state: row.state };
}

function decideMatch(db: Db, matchId: number, decision: "accepted" | "rejected", reviewer: string, reason?: string): IdentityMatchProposal | undefined {
  const existing = getIdentityMatch(db, matchId);
  if (!existing || existing.state !== "pending") return undefined;
  const createdAt = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE identity_matches SET state = ? WHERE id = ? AND state = 'pending'").run(decision, matchId);
    db.prepare(`INSERT INTO review_decisions (identity_match_id, decision, reviewer, reason, created_at)
      VALUES (?, ?, ?, ?, ?)`).run(matchId, decision, reviewer, reason ?? null, createdAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return getIdentityMatch(db, matchId);
}
