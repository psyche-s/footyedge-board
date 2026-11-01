import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {validPlayerImageURL} from "../lib/player-photos.mjs";

function writePlayerPhotoCatalog(refs,root=process.cwd()){
 const registry={},index={};
 for(const [key,team] of Object.entries(refs.teams||{})){
  const photos=Object.values(team.players||{}).filter(p=>
   (/^\d{1,12}$/.test(String(p.id))||/^club:[a-z0-9-]+:\d+$/.test(String(p.id)))&&
   team.roster?.[p.id]&&validPlayerImageURL(p.url));
  if(photos.length)registry[key]=photos.map(p=>[String(p.id),p.name,p.url]);
  for(const p of photos){
   const names=[...new Set([...(index[p.id]?.names||[]),p.name])];
   index[p.id]={id:String(p.id),name:p.name,names,url:p.url,kind:p.kind||"cutout",
    provider:p.provider||"ESPN",verifiedAt:p.verifiedAt};
  }
 }
 fs.writeFileSync(path.join(root,"assets/player-photo-registry.js"),
  "/* Verified club roster and checked provider portrait references; image bytes remain upstream. */\n"+
  "window.FE_PLAYER_PHOTOS="+JSON.stringify(registry)+";\n");
 fs.writeFileSync(path.join(root,"data/player-photo-index.json"),JSON.stringify({
  schema:"footyedge-player-photo-index-v1",checkedAt:new Date().toISOString(),players:index})+"\n");
 return {registry,index};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const refs=JSON.parse(fs.readFileSync("data/player-photo-refs.json","utf8"));
 const {registry,index}=writePlayerPhotoCatalog(refs);
 console.log(JSON.stringify({teams:Object.keys(registry).length,uniquePlayers:Object.keys(index).length,
  portraitEntries:Object.values(registry).reduce((n,p)=>n+p.length,0)}));
}
export {writePlayerPhotoCatalog};
