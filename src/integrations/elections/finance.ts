import type { FinanceCoverage, FinanceFixtureEntry, FinanceTotals, ManifestSource, SourceGate, SourceResource } from "./types.js";

export const FINANCE_CALCULATION_VERSION = "1";

export function gateSourceResource(resource: SourceResource): SourceGate {
  if (resource.status === "verified") return { ok: true, resource };
  if (resource.status === "blocked") return { ok: false, code: "blocked", resourceId: resource.id, reason: resource.reason };
  return { ok: false, code: "unavailable", resourceId: resource.id, reason: resource.reason };
}

export function gateFinanceSource(sources: readonly ManifestSource[]): SourceGate {
  const finance = sources.find((source) => source.kind === "finance" || source.id.includes("finance"));
  if (!finance) return { ok: false, code: "unavailable", resourceId: "finance", reason: "finance source missing from manifest" };
  if (finance.status !== "verified") {
    return {
      ok: false,
      code: finance.status === "blocked" ? "blocked" : "unavailable",
      resourceId: finance.id,
      reason: finance.reason
    };
  }
  const resource = finance.resources.find((row) => row.status === "verified") ?? finance.resources[0];
  if (!resource) return { ok: false, code: "unavailable", resourceId: finance.id, reason: "no finance resources" };
  return gateSourceResource(resource);
}

export function loadFinanceCoverage(gate: SourceGate, entries: readonly FinanceFixtureEntry[] | null, subjectScope: "person" | "party" = "person"): FinanceCoverage {
  if (!gate.ok) {
    if (gate.code === "blocked") return { kind: "not_yet_published" };
    return { kind: "failed", errorCode: gate.code };
  }
  if (entries === null) return { kind: "missing" };
  if (entries.length === 0) return { kind: "not_applicable" };
  return { kind: "present", totals: summarizeFinanceEntries(entries, subjectScope) };
}

export function summarizeFinanceEntries(entries: readonly FinanceFixtureEntry[], subjectScope: "person" | "party" = "person"): FinanceTotals {
  const scoped = entries.filter((entry) => entry.subjectScope === subjectScope);
  if (!scoped.length) {
    return {
      currency: "ILS",
      grossDonationsMinor: 0,
      refundsMinor: 0,
      netDonationsMinor: 0,
      loansMinor: 0,
      guaranteesMinor: 0,
      foreignShare: null
    };
  }
  const currency = scoped[0]!.currency;
  let grossDonationsMinor = 0;
  let refundsMinor = 0;
  let loansMinor = 0;
  let guaranteesMinor = 0;
  let foreignNumerator = 0;
  let foreignDenomKnown = true;
  let donationDenom = 0;

  for (const entry of scoped) {
    if (entry.currency !== currency) continue;
    switch (entry.kind) {
      case "donation":
        grossDonationsMinor += entry.amountMinor;
        donationDenom += entry.amountMinor;
        if (entry.isForeign === true) foreignNumerator += entry.amountMinor;
        else if (entry.isForeign == null) foreignDenomKnown = false;
        break;
      case "refund":
        refundsMinor += entry.amountMinor;
        break;
      case "loan":
        loansMinor += entry.amountMinor;
        break;
      case "guarantee":
        guaranteesMinor += entry.amountMinor;
        break;
      default: {
        const _exhaustive: never = entry.kind;
        throw new Error(_exhaustive);
      }
    }
  }

  return {
    currency,
    grossDonationsMinor,
    refundsMinor,
    netDonationsMinor: grossDonationsMinor - refundsMinor,
    loansMinor,
    guaranteesMinor,
    foreignShare: foreignDenomKnown && donationDenom > 0 ? foreignNumerator / donationDenom : null
  };
}
