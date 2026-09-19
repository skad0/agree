import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createApp } from "../src/app.js";
import { locales } from "../src/i18n.js";
import { issueSlugs, socialLinks } from "../src/issues.js";
import { importCandidateSource, parseCandidateSource, activatePublication } from "../src/integrations/elections/import.js";

const setup = () => createApp({sqlitePath:":memory:",env:{NODE_ENV:"test",APP_BASE_URL:"https://example.org"}});

test("all seven locales share ten durable issues without recipients, writes, or mail",async () => {
  const {app,db,close}=setup();
  try {
    db.prepare("UPDATE recipients SET is_active=0").run();
    assert.equal(db.prepare("SELECT count(*) n FROM recipients WHERE is_active=1").get()?.n,0);
    for(const locale of locales) {
      const home=await app.request(`/${locale}`); const html=await home.text();
      assert.equal(home.status,200);
      assert.equal((html.match(/class="issue-card"/g)||[]).length,10);
      assert.doesNotMatch(html,/mailto:|\/request(?:\?|"|\/build)|recipient-proof/);
      assert.match(html,/tabIndex="-1"/i);
      for(const slug of issueSlugs) {
        const response=await app.request(`/${locale}/issues/${slug}`);
        assert.equal(response.status,200);
        const detail=await response.text();
        assert.match(detail,/data-share-copy/);
        assert.match(detail,/hidden[^>]*data-share-native|data-share-native[^>]*hidden/);
        assert.match(detail,new RegExp(`rel="canonical" href="https://example.org/${locale}/issues/${slug}"`));
        assert.equal((detail.match(/rel="alternate"/g)||[]).length,7);
        assert.doesNotMatch(detail,/<script(?![^>]*src=)|\sstyle=/);
      }
      const imageUrl=html.match(/property="og:image" content="([^"]+)"/)![1]!;
      const image=await app.request(new URL(imageUrl).pathname);
      assert.equal(image.headers.get("content-type"),"image/png");
      const bytes=Buffer.from(await image.arrayBuffer());
      assert.equal(bytes.readUInt32BE(16),1200);assert.equal(bytes.readUInt32BE(20),630);
      assert.ok(bytes.length<300000);
    }
    for(const table of ["generated_requests","request_actions","submitted_responses","supporters"])
      assert.equal(db.prepare(`SELECT count(*) n FROM ${table}`).get()?.n,0);
    assert.equal((await app.request('/en/issues/not-a-real-issue')).status,404);
  } finally {close();}
});

test("retired writes fail closed even with enabled campaign flags",async () => {
  const {app,db,close}=setup();
  try {
    db.prepare("UPDATE campaigns SET requests_enabled=1,support_enabled=1").run();
    for(const suffix of ["","/selection","/review","/build","/suggest","/preview","/action","/copy","/report-sent"]){
      const response=await app.request(`/en/request${suffix}`,{method:"POST",body:"recipient=1&demands=1"});
      assert.equal(response.status,410,suffix);assert.match(response.headers.get("cache-control")!,/no-store/);
    }
    for(const route of ["responses","responses/new","responses/thanks","support"])
      for(const method of ["GET","POST"])
        assert.equal((await app.request(`/en/${route}`,{method})).status,503);
    for(const table of ["generated_requests","request_actions","submitted_responses","supporters"])
      assert.equal(db.prepare(`SELECT count(*) n FROM ${table}`).get()?.n,0);
    const redirect=await app.request('/en/request/build?demand=1&recipient=999');
    assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/en/issues/elections-on-time');
    assert.equal((await app.request('/en/request?recipient=999')).headers.get('location'),'/en');
  } finally {close();}
});

test("historical results stay private, read-only and retain Hebrew name fallback",async () => {
  const {app,db,close}=setup();
  try {
    const recipient=Number(db.prepare("INSERT INTO recipients(type,is_active) VALUES('party',0)").run().lastInsertRowid);
    db.prepare("INSERT INTO recipient_translations(recipient_id,locale,name) VALUES(?,'he','שם היסטורי')").run(recipient);
    const id='x'.repeat(43);
    db.prepare("INSERT INTO generated_requests(public_id,recipient_id,locale,selected_demands,created_at) VALUES(?,?,'he','[1]',?)").run(id,recipient,new Date().toISOString());
    const result=await app.request(`/en/request/result?request=${id}`);const html=await result.text();
    assert.equal(result.status,200);assert.match(result.headers.get('cache-control')!,/no-store/);
    assert.equal(result.headers.get('x-robots-tag'),'noindex');
    assert.match(html,/<bdi lang="he" dir="auto">שם היסטורי/);
    assert.match(html,new RegExp(`request=${id}`));assert.doesNotMatch(html,/og:|data-share|mailto:|<form/);
    assert.equal((await app.request('/en/request/result?request=1')).status,404);
  } finally {close();}
});

test("candidate directory uses only an activated snapshot and bounds filters and paging",async()=>{
  const {app,db,close}=setup();
  try {
    assert.match(await (await app.request('/en/candidates')).text(),/not published here yet/);
    const source=parseCandidateSource(JSON.parse(readFileSync('data/elections/knesset-26-lists.json','utf8')));
    const draft=importCandidateSource(db,source,JSON.stringify(source));assert.ok(draft.ok);if(!draft.ok)return;
    assert.match(await (await app.request('/en/candidates')).text(),/not published here yet/);
    assert.ok(activatePublication(db,draft.publicationId).ok);
    for(const locale of locales){
      const response=await app.request(`/${locale}/candidates`);const html=await response.text();
      assert.equal(response.status,200);assert.match(html,/38\/38/);assert.match(html,/1379/);
      assert.equal((html.match(/<h2><bdi lang="he"/g)||[]).length,20);
      assert.doesNotMatch(html,/mailto:|\/request\?|name="email"/);
    }
    const bad=await app.request('/en/candidates?list=999999&page=9999999');const body=await bad.text();
    assert.match(bad.headers.get('cache-control')!,/no-store/);assert.equal(bad.headers.get('x-robots-tag'),'noindex');
    assert.match(body,/Results have been adjusted/);
    const searched=await app.request('/en/candidates?q='+encodeURIComponent(source.rows[0]!.fullNameHe));
    assert.match(await searched.text(),/lang="he" dir="rtl"/);
    assert.equal(db.prepare("SELECT count(*) n FROM recipient_entity_links").get()?.n,0);
  }finally{close();}
});

test("share destinations encode multilingual text and stable links once",()=>{
  const title='שאלה & سؤال';const text='A & B?\nשלום';const url='https://example.org/he/issues/elections-on-time';
  const links=socialLinks(title,text,url).map(link=>new URL(link.href));
  assert.equal(links[0]!.searchParams.get('text'),`${text}\n${url}`);
  assert.equal(links[1]!.searchParams.get('u'),url);
  assert.equal(links[2]!.searchParams.get('text'),text);assert.equal(links[2]!.searchParams.get('url'),url);
  assert.equal(links[3]!.searchParams.get('text'),title);
});

test("campaign pause leaves privacy available and locale preferences uncached",async()=>{
  const {app,db,close}=setup();
  try{
    for(const path of ['/en?lang=1','/en/issues/elections-on-time?lang=1']){
      const r=await app.request(path);assert.match(r.headers.get('cache-control')!,/no-store/);assert.match(r.headers.get('set-cookie')!,/locale=en/);
    }
    db.prepare("UPDATE campaigns SET status='archived'").run();
    for(const path of ['/en','/en/issues/elections-on-time','/en/candidates'])assert.equal((await app.request(path)).status,503);
    assert.equal((await app.request('/en/privacy')).status,200);
  }finally{close();}
});
