// Original FootyEdge: manual roster-photo reference sync (no image binaries).
import fs from "node:fs";
const P="assets/player-photo-registry.js",MAGIC="window.FOOTYEDGE_PLAYER_PHOTOS=";
const day=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Toronto",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const add=(s,n)=>{const d=new Date(s+"T12:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const parse=()=>{const s=fs.readFileSync(P,"utf8"),i=s.indexOf(MAGIC);if(i<0)throw Error("Missing registry");
 return JSON.parse(s.slice(i+MAGIC.length).trim().replace(/;\s*$/,""))};
const registry=parse(),teams=new Map(),base=day();
for(const n of [0,1,2])for(const folder of ["data/boards","data/board-drafts"]){
 const file=folder+"/"+add(base,n)+".json";if(!fs.existsSync(file))continue;
 const b=JSON.parse(fs.readFileSync(file,"utf8"));
 for(const g of b.games||[])for(const side of ["home","away"]){
  const t=g.teams?.[side],id=String(t?.id||"");
  if(!/^\d{1,10}$/.test(id)||!/^[a-z.0-9]+$/.test(String(g.league||"")))continue;
  teams.set(g.league+":"+id,{league:g.league,id,name:String(t.name||"")});
 }
}
const getPlayers=r=>(r.athletes||[]).flatMap(g=>g.items||g.athletes||[g]).map(g=>g.athlete||g)
 .filter(x=>/^\d{1,12}$/.test(String(x.id||""))&&x.displayName)
 .map(x=>({id:String(x.id),name:String(x.displayName).slice(0,120),
  jersey:String(x.jersey||"")||null,
  photoUrl:/^https:\/\/a\.espncdn\.com\//i.test(String(x.headshot?.href||""))?x.headshot.href:null}));
let changed=0,errors=0;
const entries=[...teams.values()];
async function retrieve(t){
 const url="https://site.api.espn.com/apis/site/v2/sports/soccer/"+t.league+"/teams/"+t.id+"/roster";
 try{
  const r=await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(6500)});
  if(!r.ok)throw Error("HTTP "+r.status);
  const players=getPlayers(await r.json());
  if(!players.length)throw Error("No roster");
  const key=t.league+":"+t.id,obj={league:t.league,teamId:t.id,name:t.name,source:url,players};
  if(JSON.stringify(registry.teams[key])!==JSON.stringify(obj)){registry.teams[key]=obj;changed++}
 }catch(e){errors++;console.warn("Roster unavailable:",t.name,e.message)}
}
for(let i=0;i<entries.length;i+=4)await Promise.all(entries.slice(i,i+4).map(retrieve));
if(changed){
 registry.collectedOn=day();
 fs.writeFileSync(P,"/* ESPN roster identity references. Image URLs remain with the provider. */\n"+
  MAGIC+JSON.stringify(registry)+";\n");
}
console.log(JSON.stringify({requested:entries.length,indexed:Object.keys(registry.teams).length,
 players:Object.values(registry.teams).reduce((n,x)=>n+x.players.length,0),changed,errors}));
