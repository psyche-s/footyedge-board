#!/usr/bin/env node
// Source-matched evidence-first Top-3; date-scoped overlay, never mutates frozen archives.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {distinctPickSet} from "./independent-picks.mjs";
import {takeOwnerTop3,ownerPickCompatible} from "./owner-top3-ranking.mjs";
export function buildReviewedPicks({research,simulation,news,standings,editorialCrosschecks}){
 const day=research?.date;
 if(!day||!Array.isArray(research.fixtures)||simulation?.date!==day)return {error:"Date-matched research and simulation required"};
 const simById=new Map(simulation.fixtures.map(x=>[String(x.fixtureId),x]));
 const newsById=new Map((news?.fixtures||[]).map(x=>[String(x.fixtureId),x]));
 const trim=(x,min,max)=>Math.min(max,Math.max(min,x));
 const title=t=>String(t||"");
 const data=[];
 for(const f of research.fixtures){
   const sim=simById.get(String(f.id)),H=(f.last10?.home||[]).filter(x=>Number.isInteger(x.gf)&&Number.isInteger(x.ga)&&x.gf>=0&&x.ga>=0).slice(0,10),A=(f.last10?.away||[]).filter(x=>Number.isInteger(x.gf)&&Number.isInteger(x.ga)&&x.gf>=0&&x.ga>=0).slice(0,10);
   const nh=H.length,na=A.length;
   const out={gameId:String(f.id),league:f.league,home:f.home.name,away:f.away.name,kickoff:f.date,reviewed:true,picks:[],qualifyingInputs:{homeLast10:nh,awayLast10:na,simulation:!!sim,sourceReviewed:false,news:newsById.has(String(f.id))}};
   const minHistory=process.env.OWNER_OVERRIDE_DATE===day?5:8;
 ¶»§q«^