/**
 * Compares two candidate transcripts so a refresh report is generated, not written by hand.
 * Works on raw JSON: a capture that the importer would refuse can still be compared.
 */

export type NameChangeClass =
  | "truncated"
  | "punctuation"
  | "spelling"
  | "removed"
  | "added";

export type NameChange = {
  listKey: string;
  listTitleHe: string;
  oldRank: number | null;
  newRank: number | null;
  oldName: string | null;
  newName: string | null;
  kind: NameChangeClass;
};

export type ListChange = {
  listKey: string;
  oldTitle: string | null;
  newTitle: string | null;
  oldLetters: string | null;
  newLetters: string | null;
  oldCount: number;
  newCount: number;
  oldRunning: boolean | null;
  newRunning: boolean | null;
};

export type TranscriptDiff = {
  oldRows: number;
  newRows: number;
  lists: ListChange[];
  names: NameChange[];
};

type LooseList = { key: string; title: string; letters: string | null; running: boolean };
type LooseRow = { key: string; rank: number; name: string };

export function diffTranscripts(oldDoc: unknown, newDoc: unknown): TranscriptDiff {
  const before = loose(oldDoc);
  const after = loose(newDoc);
  const keys = [...new Set([...after.lists.map((list) => list.key), ...before.lists.map((list) => list.key)])];
  const lists: ListChange[] = [];
  const names: NameChange[] = [];
  for (const key of keys) {
    const oldList = before.lists.find((list) => list.key === key);
    const newList = after.lists.find((list) => list.key === key);
    const oldRows = before.rows.filter((row) => row.key === key);
    const newRows = after.rows.filter((row) => row.key === key);
    const change: ListChange = {
      listKey: key,
      oldTitle: oldList?.title ?? null,
      newTitle: newList?.title ?? null,
      oldLetters: oldList?.letters ?? null,
      newLetters: newList?.letters ?? null,
      oldCount: oldRows.length,
      newCount: newRows.length,
      oldRunning: oldList?.running ?? null,
      newRunning: newList?.running ?? null
    };
    if (change.oldTitle !== change.newTitle || change.oldLetters !== change.newLetters || change.oldCount !== change.newCount || change.oldRunning !== change.newRunning) {
      lists.push(change);
    }
    names.push(...diffNames(key, newList?.title ?? oldList?.title ?? key, oldRows, newRows));
  }
  return { oldRows: before.rows.length, newRows: after.rows.length, lists, names };
}

function diffNames(key: string, title: string, oldRows: LooseRow[], newRows: LooseRow[]): NameChange[] {
  const oldNames = new Set(oldRows.map((row) => row.name));
  const newNames = new Set(newRows.map((row) => row.name));
  let added = newRows.filter((row) => !oldNames.has(row.name));
  let removed = oldRows.filter((row) => !newNames.has(row.name));
  const changes: NameChange[] = [];
  for (const row of [...added]) {
    let match: LooseRow | undefined;
    let best = Infinity;
    for (const candidate of removed) {
      const distance = editDistance(row.name, candidate.name);
      if (distance < best) { best = distance; match = candidate; }
    }
    if (!match) continue;
    const kind: NameChangeClass | null = match.name.startsWith(row.name)
      ? "truncated"
      : bare(match.name) === bare(row.name)
        ? "punctuation"
        : best <= 2 ? "spelling" : null;
    if (!kind) continue;
    changes.push({ listKey: key, listTitleHe: title, oldRank: match.rank, newRank: row.rank, oldName: match.name, newName: row.name, kind });
    added = added.filter((entry) => entry !== row);
    removed = removed.filter((entry) => entry !== match);
  }
  for (const row of removed) changes.push({ listKey: key, listTitleHe: title, oldRank: row.rank, newRank: null, oldName: row.name, newName: null, kind: "removed" });
  for (const row of added) changes.push({ listKey: key, listTitleHe: title, oldRank: null, newRank: row.rank, oldName: null, newName: row.name, kind: "added" });
  return changes;
}

/** Markdown tables for a refresh report. */
export function renderTranscriptDiff(diff: TranscriptDiff): string {
  const counts = new Map<NameChangeClass, number>();
  for (const change of diff.names) counts.set(change.kind, (counts.get(change.kind) ?? 0) + 1);
  const cell = (value: string | number | boolean | null) => value == null ? "—" : String(value).replaceAll("|", "\\|");
  const lines = [
    `Rows: ${diff.oldRows} → ${diff.newRows}.`,
    `Name changes: ${["truncated", "punctuation", "spelling", "removed", "added"].map((kind) => `${kind} ${counts.get(kind as NameChangeClass) ?? 0}`).join(", ")}.`,
    "",
    "| List | Title | Letters | Rows | Running |",
    "| --- | --- | --- | ---: | --- |",
    ...diff.lists.map((list) => `| ${cell(list.listKey)} | ${list.oldTitle === list.newTitle ? cell(list.newTitle) : `${cell(list.oldTitle)} → ${cell(list.newTitle)}`} | ${list.oldLetters === list.newLetters ? cell(list.newLetters) : `${cell(list.oldLetters)} → ${cell(list.newLetters)}`} | ${list.oldCount === list.newCount ? list.newCount : `${list.oldCount} → ${list.newCount}`} | ${list.oldRunning === list.newRunning ? cell(list.newRunning) : `${cell(list.oldRunning)} → ${cell(list.newRunning)}`} |`),
    "",
    "| List | Rank | Before | After | Class |",
    "| --- | --- | --- | --- | --- |",
    ...diff.names.map((change) => `| ${cell(change.listTitleHe)} | ${cell(change.oldRank)} → ${cell(change.newRank)} | ${cell(change.oldName)} | ${cell(change.newName)} | ${change.kind} |`)
  ];
  return `${lines.join("\n")}\n`;
}

function loose(doc: unknown): { lists: LooseList[]; rows: LooseRow[] } {
  const root = (doc ?? {}) as { lists?: unknown; rows?: unknown };
  if (!Array.isArray(root.lists) || !Array.isArray(root.rows)) throw new Error("transcript needs lists and rows arrays");
  const lists = root.lists.map((entry) => {
    const list = entry as Record<string, unknown>;
    return {
      key: String(list.officialListKey ?? list.listTitleHe),
      title: String(list.listTitleHe ?? ""),
      letters: list.ballotLetters == null ? null : String(list.ballotLetters),
      running: list.running !== false
    };
  });
  const rows = root.rows.map((entry) => {
    const row = entry as Record<string, unknown>;
    return { key: String(row.officialListKey), rank: Number(row.rank), name: String(row.fullNameHe ?? "") };
  });
  return { lists, rows };
}

function bare(name: string): string {
  return name.replace(/[\s,\-–'׳]/g, "");
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length]!;
}
