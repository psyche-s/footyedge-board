import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const s=fs.readFileSync("ui/part2.html","utf8");
const exact={
  "cze.1":"https://assets.football-logos.cc/logos/czech-republic/512x512/chance-liga.8511af91.png",
  "tur.1":"https://assets.football-logos.cc/logos/turkey/512x512/super-lig.e5930ec5.png",
  "ksa.1":"https://assets.football-logos.cc/logos/saudi-arabia/512x512/saudi-professional-league.59d5c8af.png",
  "por.1":"https://assets.football-logos.cc/logos/portugal/512x512/primeira-liga--white.c5c27520.png",
  "eng.2":"https://assets.football-logos.cc/logos/england/512x512/efl-championship.2766b536.png"
};
test("exactly supplied league images take priority in both filter and match header",()=>{
  const remote=s.slice(s.indexOf("const REMOTE_LEAGUE_LOGOS={"),s.indexOf("};",s.indexOf("const REMOTE_LEAGUE_LOGOS={"))+2);
  const local=s.slice(s.indexOf("const LEAGUE_LOGOS={"),s.indexOf("};",s.indexOf("const LEAGUE_LOGOS={"))+2);
  for(const [id,url] of Object.entries(exact)){
    assert.ok(remote.includes(JSON.stringify(id)+":"+JSON.stringify(url)),id+" remote");
    assert.ok(local.includes(JSON.stringify(id)+":"+JSON.stringify(url)),id+" primary");
  }
  assert.ok(s.includes("leagueIconHtml(id))"),"League filter should use shared leagueIconHtml");
  assert.ok(s.includes("leagueIconHtml(g.league,g.leagueLogo)"),"Game header should use same mapping");
  assert.ok(s.includes("object-fit:contain"),"League images may not be cropped");
});
test("Czech league appears in the available-league filter order",()=>{
  assert.ok(s.includes('"ksa.1","cze.1","esp.1"'));
});
