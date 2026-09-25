import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { locales } from "../src/i18n.js";
import { issueSlugs } from "../src/issues.js";

test("public pages never publish owner contacts or contact placeholders",async()=>{
  for(const contact of [undefined,"owner-contact@campaign.org","privacy@example.org","[CAMPAIGN OPERATOR CONTACT TO BE ADDED BEFORE PRODUCTION]"]){
    const runtime=createApp({sqlitePath:":memory:",env:{NODE_ENV:"test",PRIVACY_CONTACT_EMAIL:contact}});
    try{
      for(const locale of locales){
        for(const suffix of ["","/about","/methodology","/privacy","/candidates","/scorecard","/standard","/coalition-agreement","/first-100-days","/government-model","/delete-data",...issueSlugs.map(slug=>`/issues/${slug}`)]){
          const response=await runtime.app.request(`/${locale}${suffix}`);
          assert.equal(response.status,200);
          assert.doesNotMatch(await response.text(),/owner-contact@campaign\.org|(?:mailto|tel):|(?:name|rel)="author"|privacy@example|CAMPAIGN OPERATOR CONTACT|\{\{PRIVACY_CONTACT_EMAIL\}\}|\[personal funds|\[מקורות עצמיים/);
        }
      }
      const about=await(await runtime.app.request('/en/about')).text();
      assert.doesNotMatch(about,/Funding|Connections|Directors and editors disclose/);
      const methodology=await(await runtime.app.request('/en/methodology')).text();
      assert.doesNotMatch(methodology,/paused|Historical request|report a source error/);
      const privacy=await(await runtime.app.request('/en/privacy')).text();
      assert.match(privacy,/Historical appeal records/);
      assert.match(privacy,/href="\/en\/delete-data"/);
    }finally{runtime.close();}
  }
});
