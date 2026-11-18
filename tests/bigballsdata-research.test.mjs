import test from "node:test";
import assert from "node:assert/strict";
import { collectEpl, corroborateResearch, canonicalTeam } from "../scripts/bigballsdata-research.mjs";

const date = "2026-10-25";
const home = "Liverpool FC", away = "Brighton & Hove Albion";
const kick = "2026-10-25T14:00:00.000Z";
const research = {
  date, fixtures: [
    { id: "old-espn-1", league: "eng.1", date: kick,
      home: {name: "Liverpool"}, away: {name: away}, facts: ["prior research"] },
    { id: "another-league", league: "eng.2", date: kick,
      home: {name: "Liverpool"}, away: {name: away} }
  ]
};
test("collects EPL fixture data using documented SDK parameters without claiming picks", async () => {
  let query;
  const client = {matches: {list: async args => {
    query = args;
    return {
      data: [
        {home: {name: home}, away: {name: away}, kickoff_utc: kick, status:"finished"},
        {home: {name: "Arsenal"}, away: {name: "Chelsea"}, kickoff_utc: "2026-10-24T15:00:00Z"}
      ],
      meta: {source: "stored", cached: true}
    };
  }}};
  const result = await collectEpl({client, date, checkedAt:"2026-10-25T20:00:00Z"});
  assert.deepEqual(query, {sport:"football", league:"epl", date, limit:100});
  assert.equal(result.fixtures.length, 1);
  assert.equal(result.providerMeta.qualityConfidence, null);
  assert.equal(result.fixtures[0].status, "finished");
  assert.equal(canonicalTeam(home), canonicalTeam("Liverpool"));
});
test("adds only derived corroboration to same-day, identity-matched EPL research", async () => {
  const client = {matches: {list: async () => ({data: [
    {home:{name:home},away:{name:away},kickoff_utc:kick}
  ],meta:{source:"stored",cached:true}})}};
  const evidence = await collectEpl({client,date});
  const result = corroborateResearch(research,evidence);
  assert.equal(result.providerCrosschecks.bigballsdata.matched, 1);
  assert.equal(result.fixtures[0].providerCorroboration.bigballsdata.matched,true);
  assert.equal(result.fixtures[0].facts[0], "prior research");
  assert.equal(result.fixtures[1].providerCorroboration, undefined);
  assert.ok(!JSON.stringify(result).includes("bigballsdata-epl-")); // no raw dump
});
test("rejects loose or ambiguous fixture joins and wrong dates", () => {
  const evidence = {schema:"footyedge-private-bigballsdata-epl-v1",date,
    checkedAt: "2026-10-25T20:00:00Z",providerMeta:{source:"stored",cached:true},
    fixtures:[
      {home,away,kickoff_utc:kick},
      {home,away,kickoff_utc:kick}
    ]};
  assert.equal(corroborateResearch(research,evidence).providerCrosschecks.bigballsdata.matched,0);
  assert.throws(() => corroborateResearch({...research,date:"2026-10-26"}, evidence),/Date-matched/);
});
test("missing provider fixtures cannot erase or invent a prior pick", () => {
  const evidence = {schema:"footyedge-private-bigballsdata-epl-v1",date,
    checkedAt:"2026-10-25T20:00:00Z", providerMeta:{source:"stored",cached:false},fixtures:[]};
  const before = {...research, fixtures:research.fixtures.map(f=>({...f, top3:[{label:"existing"}]}))};
  const after = corroborateResearch(before,evidence);
  assert.deepEqual(after.fixtures[0].top3,[{label:"existing"}]);
  assert.equal(after.providerCrosschecks.bigballsdata.matched,0);
  assert.equal(after.fixtures[0].providerCorroboration,undefined);
});
