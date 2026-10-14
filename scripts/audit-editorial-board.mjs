#!/usr/bin/env node
// FootyEdge immutable-board editorial audit: public copy and priced evidence only.
import fs from "node:fs";
const date=process.env.BOARD_DATE||new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).reduce((x,p)=>{if(p.type==="year")x.y=p.value;if(p.type==="month")x.m=p.value;if(p.type==="day")x.d=p.value;return x},{});
const boardDate=typeof date==="string"?date:date.y+"-"+date.m+"-"+date.d;
const file="data/boards/"+boardDate+".json";
const warn=x=>console.log("::warning::FootyEdge editorial audit: "+x);
if(!fs.existsSync(file)){warn("No board yet for "+boardDate);process.exit(0);}
const b=JSON.parse(fs.readFileSync(file,"utf8"));let errors=[],warnings=[],quoted=0,withNews=0;
const badWords=/\\b(?:according to|football whispers|sports mole|sportskeeda|statz(?:\\.ai)?|espn)\\b|https?:\\/\\//i;
for(const g of b.games||[]){
 const t=g.top3||[];
 if(t.length!==3)errors.push(g.id+": expected Top 3");
 if(t.some(p=>badWords.test(p.reason||"")))errors.push(g.id+": attribution in visible pick copy");
 if(t.some(p=>(p.reason||"").trim().length<65))warnings.push(g.id+": short reasoning");
 const names=t.map(x=>String(x.label||"").toLowerCase());
 if(names.some(x=>x.includes("over 1.5 goals"))&&names.some(x=>x.includes("under 3.5 goals")))errors.push(g.id+": redundant total markets");
 for(const p of t){
  if(p.score!=null&&(typeof p.score!=="number"||p.score<0||p.score>100))errors.push(g.id+": invalid conviction index");
  if(p.verifiedPrice){
   quoted++;
   if(!Number.isFinite(Number(p.priceDecimal))||Number(p.priceDecimal)<1.2)errors.push(g.id+": missing or below -500 verified quote");
   if(!Number.isFinite(Number(p.ev))||!Number.isFinite(Number(p.modelProb)))errors.push(g.id+": invalid EV/probability");
   else if(Math.abs((p.modelProb*Number(p.priceDecimal)-1)-p.ev)>.003)errors.push(g.id+": EV arithmetic mismatch");
  }else if(p.ev!=null)errors.push(g.id+": EV without sportsbook price");
 }
 if(Array.isArray(g.teamNews)&&g.teamNews.length>=2)withNews++;
 if(g.league==="uefa.champions"&&!(g.teamNews||[]).length)warnings.push(g.id+": Champions League team news absent");
}
for(const t of b.top5||[]){
 if(!t.pick||!t.pick.reason)errors.push("Featured selection has no explanation");
 if(t.pick?.verifiedPrice&&!Number.isFinite(Number(t.pick.ev)))errors.push("Featured selection has missing EV");
}
if((b.games||[]).length&&!(b.top5||[]).length)warnings.push("No featured priced picks; check provider coverage");
for(const w of warnings)warn(w);
console.log(JSON.stringify({date:boardDate,matches:b.games?.length||0,withNews,quotedPicks:quoted,warnings:warnings.length,errors},null,2));
if(errors.length)process.exit(1);
