import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/the-odds.js";

const torontoToday=()=>{
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return parts.year+"-"+parts.month+"-"+parts.day;
};
const date=torontoToday();
const event=(bookmakers=[])=>({
  id:"test-match-1",sport_key:"soccer_epl",sport_title:"EPL",home_team:"Arsenal",away_team:"Bournemouth",
  commence_time:date+"T15:00:00Z",bookmakers
});
const book=(key,draw=true)=>({key,title:key,last_update:"2026-10-15T03:50:00Z",markets:[
  {key:"h2h",last_update:"2026-10-15T03:51:00Z",outcomes:[
    {name:"Arsenal",price:-180},...(draw?[{name:"Draw",price:280}]:[]),{name:"Bournemouth",price:450}]},
  {key:"totals",last_update:"2026-10-15T03:53:00Z",outcomes:[
    {name:"Over",point:2.5,price:-120},{name:"Under",point:2.5,price:100}]}
]});
const jsonResponse=(data,status=200,remaining="50")=>({ok:status>=200&&status<300,status,
  headers:{get:(key)=>key==="x-requests-remaining"?remaining:null},text:async()=>JSON.stringify(data)});
const request=()=>({query:{date,leagues:"eng.1,esp.1",live:"1",publish:"1"}});
const response=()=>({statusCode:null,body:null,headers:{},status(v){this.statusCode=v;return this},
  json(v){this.body=v;return this},setHeader(k,v){this.headers[k]=v}});
async function scenario(fetcher,check){
  const oldFetch=globalThis.fetch,oldKey=process.env.THEODDSAPI,oldEnv=process.env.VERCEL_ENV;
  globalThis.fetch=fetcher;process.env.THEODDSAPI="test-only-key";process.env.VERCEL_ENV="production";
  try{const res=response();await handler(request(),res);assert.equal(res.statusCode,200);check(res.body);}
  finally{
    globalThis.fetch=oldFetch;
    if(oldKey===undefined)delete process.env.THEODDSAPI;else process.env.THEODDSAPI=oldKey;
    if(oldEnv===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=oldEnv;
  }
}
const sports=[{key:"soccer_epl",group:"Soccer",title:"EPL"},{key:"soccer_spain_la_liga",group:"Soccer",title:"La Liga"}];

test("scheduled capture skips empty leagues and retains exact DK market references",async()=>{
  let paidCalls=0,eventsCalls=0;
  await scenario(async url=>{
    if(url.includes("/sports/?"))return jsonResponse(sports);
    if(url.includes("/events?")){eventsCalls++;return jsonResponse(url.includes("soccer_epl")?[{id:"test-match-1"}]:[]);}
    if(url.includes("/odds?")){paidCalls++;return jsonResponse([event([book("fanduel"),book("draftkings")])]);}
    throw Error("Unexpected URL "+url);
  },result=>{
    assert.equal(eventsCalls,2);assert.equal(paidCalls,1);assert.equal(result.events.length,1);
    assert.equal(result.events[0].mlBook.key,"draftkings");
    assert.equal(result.events[0].mlBook.marketUpdatedAt,"2026-10-15T03:51:00Z");
    assert.match(result.events[0].mlBook.quoteRef,/test-match-1:draftkings:h2h$/);
    assert.match(result.events[0].totals["2.5"].book.quoteRef,/draftkings:totals:2.5$/);
    assert.ok(result.events[0].quoteSource.capturedAt);
    assert.equal(result.quotaExhausted,false);
  });
});

test("quota exhaustion stops additional paid requests",async()=>{
  let paidCalls=0;
  await scenario(async url=>{
    if(url.includes("/sports/?"))return jsonResponse(sports);
    if(url.includes("/events?"))return jsonResponse([{id:"test-match-1"}]);
    if(url.includes("/odds?")){paidCalls++;return jsonResponse({message:"Usage quota has been reached."},429);}
    throw Error("Unexpected URL "+url);
  },result=>{
    assert.equal(paidCalls,1);
    assert.equal(result.quotaExhausted,true);
    assert.equal(result.reason,"quota_exhausted");
    assert.equal(result.events.length,0);
  });
});

test("soccer ML declines incomplete DraftKings 2-way instead of deriving a draw",async()=>{
  await scenario(async url=>{
    if(url.includes("/sports/?"))return jsonResponse(sports);
    if(url.includes("/events?"))return jsonResponse(url.includes("soccer_epl")?[{id:"test-match-1"}]:[]);
    if(url.includes("/odds?"))return jsonResponse([event([book("draftkings",false),book("fanduel")])]);
    throw Error("Unexpected URL "+url);
  },result=>{
    assert.equal(result.events[0].mlBook.key,"fanduel");
    assert.equal(result.events[0].drawML,280);
    assert.equal(result.events[0].totals["2.5"].book.key,"draftkings");
  });
});
