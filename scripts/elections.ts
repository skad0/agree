import { loadConfig } from "../src/config.js";
import { openDatabase } from "../src/db.js";
import { electionCoverage, fetchBounded, loadSourceManifest } from "../src/integrations/elections/index.js";

const command = parseCommand(process.argv[2]);
const config = loadConfig();

switch (command) {
  case "source-check":
    await sourceCheck(config.electionEtlSourceManifest || process.argv[3], config.electionEtlEnabled);
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

function parseCommand(value: string | undefined): "source-check" | "report" {
  if (value === "source-check" || value === "report") return value;
  console.error("usage: elections source-check|report");
  process.exit(1);
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
