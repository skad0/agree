export { normalizeEmail, resolveContact } from "./contacts.js";
export type { ResolveContactInput } from "./contacts.js";
export { FINANCE_CALCULATION_VERSION, gateFinanceSource, gateSourceResource, loadFinanceCoverage, summarizeFinanceEntries } from "./finance.js";
export { fetchBounded } from "./http.js";
export { acquireJobLease, checkpointJob, ensureEtlJob, releaseJobLease, verifyLeaseToken } from "./jobs.js";
export { acceptIdentityMatch, getIdentityMatch, proposeIdentityMatch, rejectIdentityMatch } from "./matching.js";
export type { ProposeMatchInput } from "./matching.js";
export { ALGORITHM_VERSION, normalizeHebrew } from "./normalize-hebrew.js";
export { runEnrichmentPipeline } from "./pipeline.js";
export type { PipelineInput } from "./pipeline.js";
export {
  activateDirectoryPublication,
  electionCoverage,
  getDirectoryPublication,
  getElectionByNumber,
  getSourceSnapshot,
  insertDirectoryPublication,
  insertElection,
  insertSourceSnapshot,
  rollbackDirectoryPublication
} from "./repository.js";
export { loadSourceManifest, parseSourceManifest } from "./source-manifest.js";
export type {
  BoundedFetchRequest,
  BoundedFetchResult,
  ContactResolution,
  DirectoryPublicationRow,
  ElectionCoverage,
  ElectionRow,
  FinanceCoverage,
  FinanceFixtureEntry,
  FinanceTotals,
  IdentityMatchProposal,
  JobLease,
  ManifestSource,
  PipelineResult,
  SourceGate,
  SourceManifest,
  SourceResource,
  SourceSnapshotRow
} from "./types.js";
