import type { Hono } from "hono";
import type { Db } from "./db.js";
import type { Config } from "./config.js";
import { isLocale, t } from "./i18n.js";
import { s } from "./share-copy.js";
import { Layout } from "./layout.js";
import { privateNoStore, publicCache, publicCampaignActive, rememberLocale } from "./public-state.js";
import { unavailable } from "./share-pages.js";
import { normalizeHebrew } from "./integrations/elections/normalize-hebrew.js";

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
export function registerCandidateRoutes(app:Hono,db:Db,config:Config) {
  app.get("/:locale/candidates",context => {
    const locale=context.req.param("locale"); if (!isLocale(locale)) return context.notFound();
    rememberLocale(context,locale,config);
    if (!publicCampaignActive(db)) return unavailable(context,locale,t(locale,"formDisabled"),503);
    if (context.req.url.includes("?")) {privateNoStore(context);context.header("X-Robots-Tag","noindex");} else publicCache(context);
    const publication=candidatePublication(db,config.electionEtlElectionNumber ?? 26);
    const lists=publication ? candidateLists(db,publication.snapshotId) : [];
    const q=(context.req.query("q") ?? "").slice(0,100).trim();
    const requestedList=context.req.query("list") ?? "";
    const list=lists.find(row=>String(row.id)===requestedList);
    const terms=normalizeHebrew(q).split(/\s+/).filter(Boolean);
    const matches=publication ? candidateRows(db,publication.snapshotId).filter(row=>(!list || row.listId===list.id) && terms.every(term=>normalizeHebrew(`${row.name} ${row.listTitle} ${row.letters ?? ""}`).includes(term))) : [];
    const count=Math.max(1,Math.ceil(matches.length/20));
    const rawPage=context.req.query("page") ?? "1";
    const wanted=/^[1-9]\d{0,6}$/.test(rawPage) ? Number(rawPage) : 1;
    const page=Math.min(wanted,count);
    const query=(pageNumber:number)=>new URLSearchParams({...q?{q}:{},...list?{list:String(list.id)}:{},...pageNumber>1?{page:String(pageNumber)}:{}}).toString();
    const status=publication?.approvalState === "approved" ? t(locale,"directoryListsApproved") : publication?.approvalState === "submitted_not_approved" ? t(locale,"directoryListsSubmitted") : s(locale,"unknown");
    return context.html(<Layout locale={locale} title={s(locale,"candidates")} path={context.req.path}
      languageHref={next=>`/${next}/candidates?lang=1${query(page) ? `&${query(page)}` : ""}`}>
      <h1>{s(locale,"candidates")}</h1>
      {context.req.query("notice")==="retired" ? <p role="status">{s(locale,"retired")}</p> : null}
      {publication ? <section class="candidate-provenance">
        <p><strong>{status.replace("{n}",String(publication.electionNumber))}</strong></p>
        <p><a href={publication.sourceUrl} rel="noreferrer">{s(locale,"source")}</a> · {s(locale,"checked")}: <bdi><time dateTime={publication.checked}>{publication.checked.slice(0,10)}</time></bdi></p>
        <p>{s(locale,"coverage")}: <bdi>{lists.filter(row=>row.roster).length}/{lists.length}</bdi></p><p>{s(locale,"original")}</p>
      </section> : <p role="status">{s(locale,"noData")}</p>}
      {publication ? <>
        <form method="get" class="candidate-filters">
          <label>{s(locale,"search")}<input type="search" name="q" value={q} maxLength={100} /></label>
          <label>{s(locale,"allLists")}<select name="list"><option value="">{s(locale,"allLists")}</option>{lists.map(row=><option value={row.id} selected={list?.id===row.id} lang="he" dir="rtl">{row.title}{row.roster ? "" : ` — ${s(locale,"missingRoster")}`}</option>)}</select></label>
          <button type="submit">{s(locale,"search")}</button><a href={`/${locale}/candidates`}>{s(locale,"clear")}</a>
        </form>
        {(requestedList && !list) || wanted!==page || rawPage!==String(wanted) ? <p role="status">{s(locale,"filterReset")}</p> : null}
        <p>{s(locale,"order")}</p><p role="status">{s(locale,"results")}: {matches.length} · <bdi>{page}/{count}</bdi></p>
        {list && !list.roster ? <p>{s(locale,"missingRoster")}</p> : !matches.length ? <p>{t(locale,"directoryEmpty")}</p> : null}
        <ol class="candidate-list">{matches.slice((page-1)*20,page*20).map(row=><li><h2><bdi lang="he" dir="rtl">{row.name}</bdi></h2><p><bdi lang="he" dir="rtl">{row.listTitle}{row.letters ? ` (${row.letters})` : ""}</bdi> · {t(locale,"directoryListRank").replace("{n}",String(row.rank))}</p></li>)}</ol>
        <nav class="candidate-pages" aria-label={s(locale,"results")}>
          {page>1 ? <a rel="prev" href={`/${locale}/candidates?${query(page-1)}`}>{s(locale,"previous")}</a> : null}
          {page<count ? <a rel="next" href={`/${locale}/candidates?${query(page+1)}`}>{s(locale,"next")}</a> : null}
        </nav>
      </> : null}
      <p><a href={`/${locale}`}>{s(locale,"all")}</a></p>
    </Layout>);
  });
}
