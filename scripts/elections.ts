import { readFileSync } from "node:fs";
import { loadConfig } from "../src/config.js";
import { openDatabase } from "../src/db.js";
import {
  electionCoverage,
  fetchBounded,
  gateSourceResource,
  loadSourceManifest,
  runEnrichmentPipeline
} from "../src/integrations/elections/index.js";

const command = parseCommand(process.argv[2]);
const config = loadConfig();

switch (command) {
  case "source-check":
    await sourceCheck(config.electionEtlSourceManifest || process.argv[3], config.electionEtlEnabled);
    break;
  case "dry-run":
    dryRun(config.electionEtlSourceManifest || process.argv[3], process.argv[4]);
    break;
  case "report": {
    const db = openDatabase(config.sqlitePath);
    try { console.log(JSON.stringify(electionCoverage(db))); }
    finally { db.close(); }
    break;
  }
  default: {
    const _exhaustive: never = command;
    throw new Error(_exhaustive);
  }
}

function parseCommand(value: string | undefined): "source-check" | "dry-run" | "report" {
  if (value === "source-check" || value === "dry-run" || value === "report") return value;
  console.error("usage: elections source-check|dry-run|report");
  process.exit(1);
}

function dryRun(manifestPath: string | undefined, fixturePath: string | undefined) {
  if (!manifestPath) {
    console.error("set ELECTION_ETL_SOURCE_MANIFEST or pass a manifest path");
    process.exit(1);
  }
  const manifest = loadSourceManifest(manifestPath);
  const resources = manifest.sources.flatMap((source) => source.resources);
  const blocked = resources.filter((resource) => resource.status !== "verified");
  const verified = resources.filter((resource) => resource.status === "verified");
  const refused = blocked.map((resource) => {
    const gate = gateSourceResource(resource);
    return gate.ok ? null : { id: resource.id, code: gate.code, reason: gate.reason };
  }).filter(Boolean);

  let fixtureEntries: number | null = null;
  if (fixturePath) {
    const raw = JSON.parse(readFileSync(fixturePath, "utf8")) as { entries?: unknown };
    fixtureEntries = Array.isArray(raw.entries) ? raw.entries.length : 0;
  }

  const db = openDatabase(config.sqlitePath);
  try {
    const beforeActive = electionCoverage(db).activePublications;
    const sample = verified[0];
    const pipeline = sample
      ? runEnrichmentPipeline(db, {
        manifest,
        resource: sample,
        dedupeKey: `dry-run:${sample.id}`,
        fixturePath
      })
      : { ok: false as const, stage: "acquire" as const, code: "no_verified_resource", publicationActivated: false as const };
    const afterActive = electionCoverage(db).activePublications;
    console.log(JSON.stringify({
      parserVersion: manifest.parserVersion,
      refusedBlockedOrUnavailable: refused,
      verifiedResources: verified.length,
      fixtureEntries,
      pipeline,
      activePublicationsBefore: beforeActive,
      activePublicationsAfter: afterActive,
      wroteActivePublication: afterActive > beforeActive
    }));
  } finally {
    db.close();
  }
}

async function sourceCheck(manifestPath: string | undefined, probe: boolean) {
  if (!manifestPath) {
    console.error("set ELECTION_ETL_SOURCE_MANIFEST or pass a manifest path");
    process.exit(1);
  }
  const manifest = loadSourceManifest(manifestPath);
  const resources = manifest.sources.flatMap((source) => source.resources);
  const payload: { parserVersion: string; verifiedResources: number; blockedOrUnavailable: number; probed: boolean; status?: number; bytes?: number } = {
    parserVersion: manifest.parserVersion,
    verifiedResources: resources.filter((resource) => resource.status === "verified").length,
    blockedOrUnavailable: resources.filter((resource) => resource.status !== "verified").length,
    probed: false
  };
  if (probe) {
    const ckan = manifest.sources.find((source) => source.kind === "ckan_package" && source.packageId && source.status === "verified");
    if (ckan?.packageId) {
      const result = await fetchBounded({
        url: `https://data.gov.il/api/3/action/package_show?id=${encodeURIComponent(ckan.packageId)}`,
        allowedHosts: manifest.allowedHosts,
        timeoutMs: manifest.limits.timeoutMs,
        maxBytes: manifest.limits.maxBytes
      });
      payload.probed = true;
      payload.status = result.status;
      payload.bytes = result.body.byteLength;
    }
  }
  console.log(JSON.stringify(payload));
}
