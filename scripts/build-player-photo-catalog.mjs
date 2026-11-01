import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {validPlayerImageURL} from "../lib/player-photos.mjs";
import quality from "../lib/portrait-quality.cjs";
const {betterPortrait}=quality;

function writePlayerPhotoCatalog(refs,root=process.cwd()){
 const registry={},index={};
 for(const [key,team] of Object.entries(refs.teams||{})){
  const photos=Object.values(team.players||{}).filter(p=>
   (/^\d{1,12}$/.test(String(p.id))||/^club:[a-z0-9-]+:\d+$/.test(String(p.id)))&&
   team.roster?.[p.id]&&validPlayerImageURL(p.url));
  for(const p of photos){
   const names=[...new Set([...(index[p.id]?.names||[]),p.name])];
   const best=betterPortrait(p,index[p.id]);
   index[p.id]={id:String(p.id),name:best.name,names,url:best.url,kind:best.kind||"cutout",
    provider:best.provider||"ESPN",verifiedAt:best.verifiedAt,
    ...(best.width&&best.height?{width:best.width,height:best.height}:{})};
  }
 }
 // Reuse the best checked resolution across competitions for the same exact
 // athlete. Team membership and display names still come from that team's roster.
 for(const [key,team] of Object.entries(refs.teams||{})){
  const rows=Object.values(team.players||{}).filter(p=>team.roster?.[p.id]&&index[p.id]&&validPlayerImageURL(p.url));
  if(rows.length)registry[key]=rows.map(p=>[String(p.id),p.name,index[p.id].url]);
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
