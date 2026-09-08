import type { Db } from "../../db.js";
import { gateSourceResource } from "./finance.js";
import { acquireJobLease, checkpointJob, ensureEtlJob, releaseJobLease } from "./jobs.js";
import type { PipelineResult, PipelineStage, SourceManifest, SourceResource } from "./types.js";

export type PipelineInput = {
  manifest: SourceManifest;
  resource: SourceResource;
  dedupeKey: string;
  fixturePath?: string;
};

/** Dry pipeline: acquire → stage → validate → enrich. Never activates directory publications. */
export function runEnrichmentPipeline(db: Db, input: PipelineInput): PipelineResult {
  const gate = gateSourceResource(input.resource);
  if (!gate.ok) {
    return { ok: false, stage: "acquire", code: gate.code, publicationActivated: false };
  }

  const jobId = ensureEtlJob(db, {
    dedupeKey: input.dedupeKey,
    source: input.resource.id,
    stage: "acquire"
  });
  const lease = acquireJobLease(db, jobId);
  if (!lease) return { ok: false, stage: "acquire", code: "lease_unavailable", publicationActivated: false };

  const stages: PipelineStage[] = ["acquire", "stage", "validate", "enrich"];
  for (const stage of stages) {
    if (!checkpointJob(db, lease, stage, { fixturePath: input.fixturePath ?? null, resourceId: input.resource.id })) {
      releaseJobLease(db, lease, "failed", "lease_fenced");
      return { ok: false, stage, code: "lease_fenced", publicationActivated: false };
    }
  }

  releaseJobLease(db, lease, "succeeded");
  return { ok: true, stage: "enrich", publicationActivated: false };
}
