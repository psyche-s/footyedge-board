#!/usr/bin/env node
// Create date-gated RESEARCH ONLY SGP and cross-game watchlists.
// Never infer bet365 Ontario odds, price, or hit probabilities from component markets.
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {ownerPickCompatible} from "./owner-top3-ranking.mjs";
const excluded=new Set(["eng.2","jpn.1","kor.1","ksa.1"]);
const unique=(a)=>[...new Set(a)];
export function buildHolds({day,source,research,existing,asof}){
  if(!source||!research||source.date!==day||research.date!==day||!Array.isArray(source.matches))throw Error("Date-matched research mandatory");
  const input=new Map(research.fixtures.map(f=>[String(f.id),f]));
  const qualified=[];
  for(const row of source.matches){
    if(excluded.has(row.league)||!Array.isArray(row.picks))continue;
    const f=input.get(String(row.gameId));
    if(!f||f.league!==row.league||f.home.name!==row.home||f.away.name!==row.away||!f.date||Date.parse(f.date)<=Date.parse(asof))continue;
    if((f.last10?.home||[]).length<8||(f.last10?.away||[]).length<8)continue;
    const scored=row.picks.filter(x=>x.sourceBackedReason===true&&x.probabilityCalibrated===false&&x.verifiedPrice===false&&
      Number.isFinite(x.confidenceRating)&&x.confidenceRating>=60&&Number(x.homeSample)>=8&&Number(x.awaySample)>=8);
    const groups=[];
    for(let i=0;i<scored.length;i++)for(let j=i+1;j<scored.length;j++){
      const a=scored[i],b=scored[j];
      if(!ownerPickCompatible(¶»§q«^