export type SourceStatus = "verified" | "unavailable" | "blocked";

export type ManifestLimits = {
  timeoutMs: number;
  maxBytes: number;
  maxRecords: number;
};

export type SourceResource = {
  id: string;
  electionNumber?: number;
  resourceId?: string;
  status: SourceStatus;
  reason?: string;
};

export type ManifestSource = {
  id: string;
  kind: string;
  packageId?: string;
  status: SourceStatus;
  hosts: string[];
  reason?: string;
  resources: SourceResource[];
};

export type SourceManifest = {
  version: number;
  parserVersion: string;
  limits: ManifestLimits;
  allowedHosts: string[];
  sources: ManifestSource[];
};

export type SourceSnapshotRow = {
  id: number;
  source: string;
  resource_id: string | null;
  url: string;
  fetched_at: string;
  published_at: string | null;
  content_hash: string;
  parser_version: string;
  media_type: string | null;
  artifact_ref: string | null;
  extraction_state: string;
};

export type ElectionRow = {
  id: number;
  number: number;
  title_he: string | null;
  publication_status: string;
  published_at: string | null;
  snapshot_id: number | null;
};

export type DirectoryPublicationRow = {
  id: number;
  election_id: number;
  version: number;
  status: string;
  previous_publication_id: number | null;
  snapshot_id: number | null;
  activated_at: string | null;
};

export type ElectionCoverage = {
  elections: number;
  electoralLists: number;
  people: number;
  candidacies: number;
  activePublications: number;
};

export type BoundedFetchRequest = {
  url: string;
  allowedHosts: readonly string[];
  timeoutMs: number;
  maxBytes: number;
};

export type BoundedFetchResult = {
  url: string;
  status: number;
  mediaType: string | null;
  body: Uint8Array;
};

export type IdentityMatchBase = {
  id: number;
  personId: number | null;
  proposedKnessetPersonId: string | null;
  normalizedKey: string | null;
  algorithmVersion: string;
  score: number | null;
  featuresJson: string | null;
  createdAt: string;
};

export type IdentityMatchProposal =
  | (IdentityMatchBase & { state: "pending" })
  | (IdentityMatchBase & { state: "accepted" })
  | (IdentityMatchBase & { state: "rejected" });

export type ContactResolution =
  | { level: "unresolved"; contactPointId: null; ownerKind: null; status: "missing" | "needs_review" }
  | { level: "individual"; contactPointId: number; ownerKind: "person"; status: "verified" | "stale" | "needs_review" }
  | { level: "party_fallback"; contactPointId: number; ownerKind: "party" | "faction"; status: "verified" | "stale" | "needs_review" };

export type FinanceEntryKind = "donation" | "refund" | "loan" | "guarantee";

export type FinanceFixtureEntry = {
  kind: FinanceEntryKind;
  amountMinor: number;
  currency: string;
  sourceEntryKey: string;
  isForeign?: boolean | null;
  subjectScope: "person" | "party";
};

export type FinanceTotals = {
  currency: string;
  grossDonationsMinor: number;
  refundsMinor: number;
  netDonationsMinor: number;
  loansMinor: number;
  guaranteesMinor: number;
  foreignShare: number | null;
};

export type FinanceCoverage =
  | { kind: "missing" }
  | { kind: "not_applicable" }
  | { kind: "not_yet_published" }
  | { kind: "failed"; errorCode: string }
  | { kind: "present"; totals: FinanceTotals };

export type SourceGateOk = { ok: true; resource: SourceResource };
export type SourceGateError = { ok: false; code: "blocked" | "unavailable"; resourceId: string; reason?: string };
export type SourceGate = SourceGateOk | SourceGateError;

export type JobLease = {
  jobId: number;
  token: string;
  expiresAt: string;
};

export type PipelineStage = "acquire" | "stage" | "validate" | "enrich";

export type PipelineResult =
  | { ok: true; stage: PipelineStage; publicationActivated: false }
  | { ok: false; stage: PipelineStage; code: string; publicationActivated: false };
