/* Licensed OpenFootball history mirrored from private Football Data Hub.
   Never request private data from a visitor browser. */
(function(root,factory){
const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;
if(root)root.FootyEdgeHubHistory=api;
})(typeof window!=="undefined"?window:typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const allowed=new Set(["eng.1","eng.2","ger.1","esp.1","fra.1","ita.1","ned.1","por.1","tur.1"]);
const aliases={"man city":"manchester city","man utd":"manchester united","man united":"manchester united","psg":"paris saint germain","inter milan":"internazionale","bayern munich":"bayern munchen","tottenham":"tottenham hotspur","spurs":"tottenham hotspur","bournemouth":"afc bournemouth","lens":"racing club de lens","lyon":"olympique lyonnais","psv eindhoven":"psv","braga":"sporting clube de braga","sporting cp":"sporting clube de portugal"};
const cached=new Map();
function norm(name){
if(typeof name!=="string")return "";
let s=name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/ß/g,"ss").replace(/ı/g,"i").replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
if(aliases[s])return aliases[s];
s=s.replace(/(?:\s+(?:fc|afc|sc|cf))$/,"").trim();return aliases[s]||s;
}
function sourceLeague(league){return allowed.has(String(league||""))?String(league):null;}
function validGame(m,cutoff){
return !!m&&typeof m.id==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(m.d||"")&&m.d<cutoff&&typeof m.h==="string"&&typeof m.a==="string"&&Number.isInteger(m.hs)&&Number.isInteger(m.as)&&m.hs>=0&&m.as>=0&&m.hs<=20&&m.as<=20;
}
function getH2HFromDocument(doc,g){
if(!doc||doc.schema!=="footyedge-history-v1"||doc.license!=="CC0-1.0"||doc.competition!==sourceLeague(g.league)||!Array.isArray(doc.games))return [];
const home=norm(g.home?.name),away=norm(g.away?.name),cutoff=String(g.date||"").slice(0,10);
if(!home||!away||home===away||!/^\d{4}-\d{2}-\d{2}$/.test(cutoff))return [];
const seen=new Set(),rows=[];
for(const m of doc.games){
if(!validGame(m,cutoff))continue;
const h=norm(m.h),a=norm(m.a);
if(!((h===home&&a===away)||(h===away&&a===home))||seen.has(m.id))continue;
seen.add(m.id);rows.push({id:m.id,date:m.d,home:m.h,away:m.a,homeScore:m.hs,awayScore:m.as,source:"OpenFootball CC0 via Football Data Hub"});
}
return rows.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)).slice(0,5);
}
async function load(league,fetcher){
const code=sourceLeague(league);if(!code)return null;if(cached.has(code))return cached.get(code);
const read=fetcher||((url)=>fetch(url,{cache:"no-store"}));
const promise=(async()=>{const r=await read("/data/football-hub/"+code+".json");if(!r?.ok)throw Error("Historical data HTTP "+r?.status);
const d=await r.json();if(d?.schema!=="footyedge-history-v1"||d?.license!=="CC0-1.0"||d?.competition!==code||!Array.isArray(d.games))throw Error("Invalid CC0 history file");return d})();
cached.set(code,promise);try{return await promise}catch(e){cached.delete(code);throw e}
}
async function findH2H(g,fetcher){if(!sourceLeague(g?.league))return [];return getH2HFromDocument(await load(g.league,fetcher),g);}
return Object.freeze({norm,sourceLeague,validGame,getH2HFromDocument,findH2H,clearCache:()=>cached.clear()});
});
