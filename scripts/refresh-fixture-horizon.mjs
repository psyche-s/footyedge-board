#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
const BASE=process.env.FOOTYEDGE_URL||'https://footyedge-board.vercel.app';
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const today=process.env.FIXTURE_START_DATE||parts.year+'-'+parts.month+'-'+parts.day;
const add=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
async function fetchJson(url){
  const response=await fetch(url,{headers:{accept:'application/json'},signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  return response.json()
}
let refreshed=0,retained=0;
for(let offset=0;offset<=4;offset++){
  const date=add(today,offset),file=path.join('data',date,'fixtures.json');
  try{
    const payload=await fetchJson(BASE+'/api/football?endpoint=fixtures&date='+date);
    if(!Array.isArray(payload?.response))throw Error('invalid fixture response');
    await fs.mkdir(path.dirname(file),{recursive:true});
    const temp=file+'.tmp';await fs.writeFile(temp,JSON.stringify(payload)+'\n');await fs.rename(temp,file);
    refreshed++;console.log('Fixture schedule refreshed',date,payload.response.length);
  }catch(error){
    try{const previous=JSON.parse(await fs.readFile(file,'utf8'));if(Array.isArray(previous?.response)){retained++;console.warn('Provider unavailable; retained dated fixture schedule',date,String(error));continue}}catch{}
    console.warn('Fixture schedule unavailable; state remains unconfirmed',date,String(error));
  }
}
console.log(JSON.stringify({startDate:today,horizonDays:5,refreshed,retained}));
