// Manual quality pass over already verified roster identities. The existing
// nightly collector applies the same resolution comparison during refreshes.
import fs from "node:fs";
import {verifyImage} from "./sync-player-photo-refs.mjs";
import {writePlayerPhotoCatalog} from "./build-player-photo-catalog.mjs";
import quality from "../lib/portrait-quality.cjs";
const {betterPortrait,portraitScore}=quality;
const refs=JSON.parse(fs.readFileSync("data/player-photo-refs.json","utf8"));
const bridges=JSON.parse(fs.readFileSync("data/player-image-identities.json","utf8")).players;
const official=JSON.parse(fs.readFileSync("config/official-player-portraits.json","utf8")).players;
const candidates=new Map();
for(const team of Object.values(refs.teams))for(const p of Object.values(team.players||{})){
 if(!team.roster?.[p.id]||!/^\d+$/.test(p.id))continue;
 const old=candidates.get(p.id);
 const previous=betterPortrait(p,old?.previous);
 const teamId=old&&official[p.id]&&String(official[p.id].teamId)===String(old.teamId)?old.teamId:team.teamId;
 candidates.set(p.id,{id:p.id,name:p.name,teamId,previous});
}
const requested=new Set(String(process.env.PHOTO_UPGRADE_IDS||"").split(",").filter(Boolean));
const items=[...candidates.values()].filter(p=>
 requested.size?requested.has(p.id):official[p.id]||portraitScore(p.previous)<500&&bridges[p.id]);
let next=0,checked=0,upgraded=0;
const approved=new Map(),bad=new Set(refs.rejectedImageDigests||[]);
await Promise.all(Array.from({length:8},async()=>{
 while(next<items.length){
  const item=items[next++],photo=await verifyImage(item);
  if(photo&&!bad.has(photo.sha256)&&(photo.url!==item.previous.url||photo.width!==item.previous.width)){
   approved.set(item.id,photo);if(photo.url!==item.previous.url)upgraded++;
  }
  checked++;
  if(checked%100===0)console.log(JSON.stringify({checked,total:items.length,upgraded}));
 }
}));
// Exclude a newly returned shared silhouette before publishing any references.
const digests=new Map();
for(const [id,item] of candidates){
 const hash=item.previous.sha256;
 if(!hash)continue;
 if(!digests.has(hash))digests.set(hash,new Set());
 digests.get(hash).add(id);
}
for(const [id,p] of approved){
 if(!digests.has(p.sha256))digests.set(p.sha256,new Set());
 digests.get(p.sha256).add(id);
}
for(const [hash,ids] of digests)if(ids.size>1){bad.add(hash);for(const id of ids)approved.delete(id);}
for(const team of Object.values(refs.teams))for(const [id,p] of approved){
 if(team.roster?.[id]&&team.players?.[id])team.players[id]={...p,name:team.players[id].name};
}
refs.rejectedImageDigests=[...bad];
refs.qualityUpgrade={checkedAt:new Date().toISOString(),playersChecked:checked,
 upgradedPlayers:[...approved].filter(([id,p])=>p.url!==candidates.get(id).previous.url).length,
 policy:"Measured source dimensions; preserve larger verified portraits."};
fs.writeFileSync("data/player-photo-refs.json",JSON.stringify(refs)+"\n");
writePlayerPhotoCatalog(refs);
console.log(JSON.stringify(refs.qualityUpgrade));
