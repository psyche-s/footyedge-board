import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {rosterRows,matchRosterPlayer} from "../api/player-profile.js";
import {requestedTeams,rosterPhotos} from "../api/match-updates.js";

const XI=fs.readFileSync("ui/part2.html","utf8");
const profile=fs.readFileSync("api/player-profile.js","utf8");
const match=fs.readFileSync("api/match-updates.js","utf8");

test("abbreviated projected names uniquely match the same verified club roster",()=>{
 const roster={athletes:[{items:[
  {id:"177",displayName:"Mike Maignan",headshot:{href:"https://a.espncdn.com/i/headshots/soccer/players/full/177.png"}},
  {id:"222",displayName:"Pierre Kalulu"}
 ]}]};
 assert.equal(rosterRows(roster).length,2);
 assert.equal(matchRosterPlayer(roster,"M. Maignan")?.id,"177");
 assert.equal(matchRosterPlayer(roster,"M. Maignan","177")?.id,"177");
 assert.equal(matchRosterPlayer(roster,"P. Kalulu")?.id,"222");
 assert.equal(matchRosterPlayer(roster,"M. Maignan","222"),null);
 const ambiguous={athletes:[{items:[...roster.athletes[0].items,{id:"333",displayName:"Marco Maignan"}]}]};
 assert.equal(matchRosterPlayer(ambiguous,"M. Maignan"),null);
 assert.equal(matchRosterPlayer(ambiguous,"M. Maignan","177"),null);
});

test("club profile resolves domestic competition before declaring player unavailable",()=>{
 assert.match(profile,/fallbackLeague=String\(req\.query\.fallbackLeague\|\|""\)/);
 assert.match(profile,/new Set\(\[league,fallbackLeague\]/);
 assert.match(profile,/matchedLeague=candidate/);
 assert.match(profile,/officialId&&officialId!==teamId/);
});

test("matchday picture enrichment works even if the fixture has no official XI",()=>{
 const ids=requestedTeams({homeTeamId:"111",awayTeamId:"103",homeFallbackLeague:"ita.1",awayFallbackLeague:"ita.1"});
 assert.equal(ids.length,2);
 assert.deepEqual(ids.map(x=>x.fallbackLeague),["ita.1","ita.1"]);
 assert.deepEqual(requestedTeams({homeTeamId:"1234",homeFallbackLeague:"not-a-league"}),[]);
 assert.match(match,/const rosterHeadshots=await verifiedRosterPhotos\(league,null,hints\)/);
 assert.match(XI,/homeFallbackLeague:feRosterLeague\(g,g\.home\)/);
 assert.match(XI,/qs\.set\("fallbackLeague",fallbackLeague\)/);
 assert.match(XI,/hasConfirmed\|\|hasPortraits\|\|hasPlayerIds/);
});

test("player cards preserve trusted images and distinguish unverified statistics",()=>{
 const sample={athletes:[{items:[{id:"400",displayName:"Mike Maignan",headshot:{href:"https://a.espncdn.com/i/headshots/soccer/players/full/400.png"}}]}]};
 assert.equal(rosterPhotos(sample)[0].photoUrl,"https://a.espncdn.com/i/headshots/soccer/players/full/400.png");
 assert.match(XI,/function feCachedPlayerPhoto/);
 assert.match(XI,/const initials=asked\.match/);
 assert.match(XI,/No verified season statistics are available for this player yet/);
 assert.match(XI,/last\.length\?/);
 assert.match(fs.readFileSync("picks.html","utf8"),/ui\/part2\.html\?v=135/);
});
