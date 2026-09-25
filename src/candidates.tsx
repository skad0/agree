import type { Hono } from "hono";
import type { Db } from "./db.js";
import type { Config } from "./config.js";
import { isLocale } from "./i18n.js";
import { rememberLocale } from "./public-state.js";

export type CandidatePublication = {id:number;snapshotId:number;electionNumber:number;approvalState:string;sourceUrl:string;checked:string};
export function candidatePublication(db: Db, electionNumber=26): CandidatePublication | undefined {
  return db.prepare(`SELECT p.id, p.snapshot_id AS snapshotId, e.number AS electionNumber,
    m.approval_state AS approvalState,s.url AS sourceUrl,s.fetched_at AS checked
    FROM directory_publications p JOIN elections e ON e.id=p.election_id
    JOIN election_snapshot_metadata m ON m.snapshot_id=p.snapshot_id AND m.election_id=e.id
    JOIN source_snapshots s ON s.id=p.snapshot_id WHERE p.status='active' AND e.number=?`).get(electionNumber) as CandidatePublication | undefined;
}
type List = {id:number;title:string;letters:string|null;roster:number;sourceUrl:string|null};
export function candidateLists(db: Db,snapshotId:number): List[] {
  return db.prepare(`SELECT list_id AS id,title_he AS title,ballot_letters AS letters,roster_published AS roster,source_url AS sourceUrl
    FROM electoral_list_versions WHERE snapshot_id=? ORDER BY title_he,list_id`).all(snapshotId) as List[];
}
export function candidateRows(db: Db,snapshotId:number) {
  return db.prepare(`SELECT v.id,v.full_name_raw AS name,v.rank,v.list_id AS listId,l.title_he AS listTitle,l.ballot_letters AS letters
    FROM candidacy_versions v JOIN electoral_list_versions l ON l.list_id=v.list_id AND l.snapshot_id=v.snapshot_id
    WHERE v.snapshot_id=? AND v.status='listed' ORDER BY l.title_he,v.rank,v.id`).all(snapshotId) as {id:number;name:string;rank:number;listId:number;listTitle:string;letters:string|null}[];
}
export function registerCandidateRoutes(app: Hono, _db: Db, config: Config) {
  app.get("/:locale/candidates", context => {
    const locale = context.req.param("locale");
    if (!isLocale(locale)) return context.notFound();
    rememberLocale(context, locale, config);
    return context.redirect(`/${locale}`, 302);
  });
}
