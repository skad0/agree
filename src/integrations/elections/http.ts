import type { BoundedFetchRequest, BoundedFetchResult } from "./types.js";

const MAX_REDIRECTS = 3;

export async function fetchBounded(request: BoundedFetchRequest, fetchImpl: typeof fetch = fetch): Promise<BoundedFetchResult> {
  let current = parseHttpsUrl(request.url);
  assertAllowedHost(current, request.allowedHosts);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await fetchImpl(current.href, { redirect: "manual", signal: AbortSignal.timeout(request.timeoutMs) });
    } catch {
      throw new Error(`election source fetch failed for ${current.hostname}`);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || hop === MAX_REDIRECTS) throw new Error(`election source redirect rejected for ${current.hostname}`);
      current = parseHttpsUrl(new URL(location, current).href);
      assertAllowedHost(current, request.allowedHosts);
      continue;
    }
    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader && Number(lengthHeader) > request.maxBytes) throw new Error(`election source response too large from ${current.hostname}`);
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > request.maxBytes) throw new Error(`election source response too large from ${current.hostname}`);
    return {
      url: current.href,
      status: response.status,
      mediaType: response.headers.get("content-type"),
      body
    };
  }
  throw new Error(`election source redirect rejected for ${current.hostname}`);
}

function parseHttpsUrl(value: string): URL {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error("election source URL is invalid"); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("election source URL must be HTTPS without credentials");
  return parsed;
}

function assertAllowedHost(url: URL, allowedHosts: readonly string[]): void {
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.some((allowed) => allowed.toLowerCase() === host)) throw new Error(`election source host is not allowlisted: ${host}`);
}
