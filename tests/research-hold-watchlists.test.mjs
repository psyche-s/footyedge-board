import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {buildHolds} from "../scripts/build-research-hold-watchlists.mjs";
import {ownerPickCompatible} from "../scripts/owner-top3-ranking.mjs";
test("ten unpriced eligible major-league SGP research watchlists and distinct-game cross-ticket",()=>{
 const day="2026-11-07";
 const src=JSON.parse(fs.readFileSync("data/source-led/"+day+".json","utf8"));
 const research=JSON.parse(fs.readFileSync("data/research-base-"+day+".json","utf8"));
 const doc=buildHolds({day,source:src,research,existing:{},asof:"2026-11-07T04:25:00.000Z"});
 assert.equal(doc.sgpsByLeague.length,10);
 assert.equal(new Set(doc.sgpsByLeague.map(x=>x.league)).size,10);
 assert.ok(doc.acca.legs.length>=4);
 assert.equal(new Set(doc.acca.legs.map(x=>x.gameId)).size,doc.acca.legs.length);
 for(const ticket of [...doc.sgpsByLeague,doc.acca]){
  assert.equal(ticket.status,"hold");
  assert.equal(ticket.trackable,false);
  assert.equal(ticket.verifiedCombinedPrice,false);
  assert.equal(ticket.combinedOntarioOdds,null);
  assert.ok(ticket.legs.every(l=>l.verifiedPrice===false&&l.odds===null));
  assert.ok(ticket.legs.every(l=>l.priceStatus==="ontario_joint_price_pending"));
  if(ticket!==doc.acca)assert.ok(ownerPickCompatible(ticket.legs[0],ticket.legs[1]));
 }
 assert.ok(doc.sgpsByLeague.every(x=>!["eng.2","jpn.1","kor.1","ksa.1"].includes(x.league)));
});
