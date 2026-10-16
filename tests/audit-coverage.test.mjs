import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {audit} from "../scripts/audit-coverage.mjs";

test("accurately distinguishes missing cache from historical data and rights",()=>{
 const root=mkdtempSync(join(tmpdir(),"footy-assets-"));mkdirSync(join(root,"assets/logos/competitions"),{recursive:true});
 writeFileSync(join(root,"assets/logos/competitions/eng.1.png"),"fake");
 const config={fields:{shots:"requires_licensed_event_feed"},competitions:[
 {code:"eng.1",name:"Premier League",short:"PL",logo:"/assets/logos/competitions/eng.1.png"},
 {code:"eng.2",name:"EFL Championship",short:"EFL",logo:null},
 {code:"tur.1",name:"Turkish Süper Lig",short:"TSL",logo:null,candidate:"https://example.org/possible-logo"}]};
 const report=audit({config,logoManifest:{competitions:{"eng.1":"/assets/logos/competitions/eng.1.png"}},
  hubManifest:{leagues:[{league:"eng.1",games:200},{league:"eng.2",games:50}]},root});
 assert.equal(report.summary.cachedLogoFiles,1);
 assert.equal(report.summary.missingLogoFiles,2);
 assert.equal(report.summary.historicalLeagues,2);
 assert.equal(report.leagues[0].logo.rights,"review_required");
 assert.equal(report.leagues[1].history.status,"available_cc0");
 assert.equal(report.leagues[2].history.status,"not_in_current_hub");
 assert.equal(report.leagues[2].logo.fallback.label,"TSL");
 assert.equal(report.summary.availablePlayerEventFeeds,0);
 assert.equal(report.fields.shots,"requires_licensed_event_feed");
});

test("never invents cached logo if manifest and file disagree",()=>{
 const config={competitions:[{code:"eng.1",name:"Premier League",short:"PL",logo:"/assets/logos/competitions/eng.1.png"}],fields:{}};
 const report=audit({config,logoManifest:{competitions:{"eng.1":"present"}},
  hubManifest:{leagues:[]},root:tmpdir()});
 assert.equal(report.leagues[0].logo.status,"missing");
});
