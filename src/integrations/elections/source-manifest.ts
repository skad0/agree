import { readFileSync } from "node:fs";
import type { ManifestLimits, ManifestSource, SourceManifest, SourceResource, SourceStatus } from "./types.js";

const HOST = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set<SourceStatus>(["verified", "unavailable", "blocked"]);

export function loadSourceManifest(path: string): SourceManifest {
  if (!path.trim()) throw new Error("election source manifest path is required");
  let raw: unknown;
  try { raw = JSON.parse(readFileSync(path, "utf8")); }
  catch { throw new Error("election source manifest is missing or not valid JSON"); }
  return parseSourceManifest(raw);
}

export function parseSourceManifest(raw: unknown): SourceManifest {
  if (!isRecord(raw)) throw new Error("election source manifest must be an object");
  const version = asPositiveInt(raw.version, "version");
  if (version !== 1) throw new Error("election source manifest version is unsupported");
  const parserVersion = asNonEmptyString(raw.parserVersion, "parserVersion");
  const limits = parseLimits(raw.limits);
  const allowedHosts = asHostList(raw.allowedHosts, "allowedHosts");
  if (!Array.isArray(raw.sources) || raw.sources.length === 0) throw new Error("election source manifest sources are required");
  const sources = raw.sources.map((source, index) => parseSource(source, allowedHosts, `sources[${index}]`));
  return { version, parserVersion, limits, allowedHosts, sources };
}

function parseLimits(raw: unknown): ManifestLimits {
  if (!isRecord(raw)) throw new Error("election source manifest limits are required");
  return {
    timeoutMs: asPositiveInt(raw.timeoutMs, "limits.timeoutMs"),
    maxBytes: asPositiveInt(raw.maxBytes, "limits.maxBytes"),
    maxRecords: asPositiveInt(raw.maxRecords, "limits.maxRecords")
  };
}

function parseSource(raw: unknown, allowedHosts: string[], path: string): ManifestSource {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  const id = asNonEmptyString(raw.id, `${path}.id`);
  const kind = asNonEmptyString(raw.kind, `${path}.kind`);
  const status = asStatus(raw.status, `${path}.status`);
  const hosts = asHostList(raw.hosts, `${path}.hosts`);
  for (const host of hosts) {
    if (!allowedHosts.includes(host)) throw new Error(`${path}.hosts contains a host outside allowedHosts`);
  }
  const packageId = raw.packageId === undefined ? undefined : asNonEmptyString(raw.packageId, `${path}.packageId`);
  const reason = raw.reason === undefined ? undefined : asNonEmptyString(raw.reason, `${path}.reason`);
  if (!Array.isArray(raw.resources)) throw new Error(`${path}.resources must be an array`);
  const resources = raw.resources.map((resource, index) => parseResource(resource, `${path}.resources[${index}]`));
  if (status === "verified" && resources.filter((resource) => resource.status === "verified").length === 0) {
    throw new Error(`${path} marked verified without a verified resource`);
  }
  return { id, kind, packageId, status, hosts, reason, resources };
}

function parseResource(raw: unknown, path: string): SourceResource {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  const id = asNonEmptyString(raw.id, `${path}.id`);
  const status = asStatus(raw.status, `${path}.status`);
  const electionNumber = raw.electionNumber === undefined ? undefined : asPositiveInt(raw.electionNumber, `${path}.electionNumber`);
  const reason = raw.reason === undefined ? undefined : asNonEmptyString(raw.reason, `${path}.reason`);
  let resourceId: string | undefined;
  if (raw.resourceId !== undefined) {
    resourceId = asNonEmptyString(raw.resourceId, `${path}.resourceId`);
    if (!RESOURCE_ID.test(resourceId)) throw new Error(`${path}.resourceId is not a CKAN resource id`);
  }
  if (status === "verified" && !resourceId) throw new Error(`${path} verified resource requires resourceId`);
  return { id, electionNumber, resourceId, status, reason };
}

function asHostList(raw: unknown, path: string): string[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error(`${path} must be a non-empty host list`);
  return raw.map((item, index) => {
    const host = asNonEmptyString(item, `${path}[${index}]`).toLowerCase();
    if (!HOST.test(host)) throw new Error(`${path}[${index}] is not a hostname`);
    return host;
  });
}

function asStatus(raw: unknown, path: string): SourceStatus {
  if (typeof raw !== "string" || !STATUSES.has(raw as SourceStatus)) throw new Error(`${path} must be verified, unavailable, or blocked`);
  return raw as SourceStatus;
}

function asNonEmptyString(raw: unknown, path: string): string {
  if (typeof raw !== "string" || !raw.trim()) throw new Error(`${path} must be a non-empty string`);
  return raw.trim();
}

function asPositiveInt(raw: unknown, path: string): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) throw new Error(`${path} must be a positive integer`);
  return raw;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
