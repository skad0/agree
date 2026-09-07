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
