// Vercel compiles the .js API entry points to CommonJS. Keep their shared
// photo helper loadable with require(), including on runtimes that forbid require(ESM).
const {readFileSync}=require("node:fs");
const {join}=require("node:path");

const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
let saved;
function catalog(){
 if(saved)return saved;
 try{
  const data=JSON.parse(readFileSync(join(__dirname,"../data/player-photo-index.json"),"utf8"));
  saved=data.schema==="footyedge-player-photo-index-v1"?data.players:{};
 }catch{saved={};}
 return saved;
}
function validPlayerImageURL(value){
 const url=String(value||"");
 if(/default_player|placeholder|silhouette|no-image/i.test(url))return "";
 if(/^https:\/\/(?:a\.espncdn\.com|a\.espn\.com)\/[a-z0-9._~!$&'()*+,;=:@/%?-]+$/i.test(url))return url;
 if(/^https:\/\/media\.api-sports\.io\/football\/players\/[1-9]\d{0,11}\.png$/.test(url))return url;
 if(/^https:\/\/images\.fotmob\.com\/image_resources\/playerimages\/[1-9]\d{0,11}\.png$/.test(url))return url;
 if(/^https:\/\/resources\.premierleague\.com\/premierleague\/photos\/players\/(?:110x140|250x250)\/p[1-9]\d{0,11}\.png$/.test(url))return url;
 if(/^https:\/\/contentfulproxy\.stadion\.io\/rm6ms1yxue4m\/[a-z0-9]+\/[a-f0-9]{32}\/[a-z-]+-hero-image\.jpg\?f=face&fit=fill&fm=webp&h=\d{3,4}&w=2000$/i.test(url))return url;
 if(/^https:\/\/publish\.realmadrid\.com\/content\/dam\/portals\/realmadrid-com\/es-es\/sports\/football\/[a-z0-9]+\/players\/[a-z0-9-]+\/assets\/[A-Z0-9_]+\.png$/.test(url))return url;
 if(/^https:\/\/www\.chanceliga\.cz\/min\.php\?exact&topcut&w=\d{1,4}&h=\d{1,4}&file=photo\/player\/player_\d+\.jpg$/.test(url))return url;
 if(/^https:\/\/php\.esports\.cz\/images\/min\.php\?exact&topcut&w=\d{1,4}&h=\d{1,4}&compresss=&mtime=\d+&file=https:\/\/fcb\.cz\/+foto\/[a-z0-9._~/%-]+\.png$/i.test(url))return url;
 if(/^https:\/\/fchk\.cz\/image\?file=https:\/\/fchk\.esports\.cz\/foto\/[a-z0-9._~/%-]+\.png(?:\?\d+)?&w=\d{1,4}&h=\d{1,4}$/i.test(url))return url;
 if(/^https:\/\/(?:fcb\.cz|fkmb\.esports\.cz|fchk\.esports\.cz)\/+foto\/[a-z0-9._~/%-]+\.(?:png|jpe?g|webp)(?:\?[a-z0-9._~=&%-]*)?$/i.test(url))return url;
 return /^https:\/\/www\.chanceliga\.cz\/photo\/player\/player_\d+\.(?:png|jpe?g)$/.test(url)?url:"";
}
function photoForIdentity(player,index=catalog()){
 const id=String(player?.id||""),asked=norm(player?.displayName||player?.fullName||player?.name);
 if(!/^\d{1,12}$/.test(id)||!asked)return "";
 const photo=index[id];
 if(!photo||String(photo.id)!==id)return "";
 const names=[photo.name,...(Array.isArray(photo.names)?photo.names:[])].map(norm);
 return names.includes(asked)?validPlayerImageURL(photo.url):"";
}
module.exports={validPlayerImageURL,photoForIdentity};
