import espnScoreboard from "./api/espn-scoreboard.js";
import espnSchedule from "./api/espn-schedule.js";
import espnStandings from "./api/espn-standings.js";
import football from "./api/football.js";
import theOdds from "./api/the-odds.js";
import whispers from "./api/whispers.js";

if(!globalThis.process)globalThis.process={env:{}};
if(!globalThis.process.env)globalThis.process.env={};
globalThis.process.env.VERCEL_ENV="production";

const API_HANDLERS=new Map([
  ["/api/espn-scoreboard",espnScoreboard],
  ["/api/espn-schedule",espnSchedule],
  ["/api/espn-standings",espnStandings],
  ["/api/football",football],
  ["/api/the-odds",theOdds],
  ["/api/whispers",whispers]
]);

function queryFrom(url){
  const query={};
  for(const [key,value] of url.searchParams){
    if(Object.prototype.hasOwnProperty.call(query,key)){
      query[key]=Array.isArray(query[key])?[...query[key],value]:[query[key],value];
    }else query[key]=value;
  }
  return query;
}

async function invokeVercelStyle(handler,request){
  const url=new URL(request.url);
  const req={method:request.method,query:queryFrom(url)};
  let statusCode=200;
  let body="";
  const headers=new Headers();
  const res={
    status(code){statusCode=Number(code)||200;return res},
    setHeader(name,value){
      if(Array.isArray(value))headers.set(name,value.join(", "));
      else if(value!==undefined&&value!==null)headers.set(name,String(value));
      return res
    },
    json(value){
      headers.set("Content-Type","application/json; charset=utf-8");
      body=JSON.stringify(value);
      return res
    },
    send(value){
      if(value===undefined||value===null)body="";
      else if(typeof value==="string"||value instanceof ArrayBuffer||ArrayBuffer.isView(value))body=value;
      else{
        headers.set("Content-Type","application/json; charset=utf-8");
        body=JSON.stringify(value);
      }
      return res
    }
  };
  try{
    await handler(req,res);
    return new Response(body,{status:statusCode,headers});
  }catch(error){
    return Response.json({error:"FootyEdge API temporarily unavailable",detail:String(error?.message||error)},{status:502});
  }
}

export default{
  async fetch(request,env){
    const url=new URL(request.url);
    const handler=API_HANDLERS.get(url.pathname);
    if(handler)return invokeVercelStyle(handler,request);
    return env.ASSETS.fetch(request);
  }
};
