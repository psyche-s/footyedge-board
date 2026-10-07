import fs from "node:fs/promises";
import path from "node:path";

const cfg=JSON.parse(await fs.readFile("data/logo-sources.json","utf8"));
const ROOT="assets/logos";
const COMP_DIR=path.join(ROOT,"competitions");
const TEAM_DIR=path.join(ROOT,"teams");
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim();
const slug=s=>norm(s).replace(/ /g,"-");
const cleanHtml=s=>String(s||"").replace(/\\u002F/g,"/").replace(/\\\//g,"/").replace(/&amp;/g,"&");
const uniq=a=>[...new Set(a)];
const sourcePages={};
const registry={source:cfg.source,generatedAt:new Date().toISOString(),credit:cfg.credit,competitions:{},teams:{},sources:{}};

async function fetchText(url){
  const r=await fetch(url,{headers:{"user-agent":"FootyEdge logo cache/1.0 (+https://footyedge-board.vercel.app)"}});
  if(!r.ok) throw new Error("HTTP "+r.status+" "+url);
  return await r.text();
}
async function fetchBytes(url){
  const r=await fetch(url,{headers:{"user-agent":"FootyEdge logo cache/1.0 (+https://footyedge-board.vercel.app)"}});
  if(!r.ok) throw new Error("HTTP "+r.status+" "+url);
  return Buffer.from(await r.arrayBuffer());
}
function assetUrls(html){
  const h=cleanHtml(html);
  const rx=/https:\/\/assets\.football-logos\.cc\/logos\/[^"'<>\s]+?\/[0-9]+x[0-9]+\/[^"'<>\s]+?\.png/g;
  return uniq(h.match(rx)||[]);
}
function pageSlug(url){
  return new URL(url).pathname.split("/").filter(Boolean).at(-1)||"logo";
}
function chooseAsset(html,pageUrl){
  const urls=assetUrls(html),ps=pageSlug(pageUrl);
  const matching=urls.filter(u=>decodeURIComponent(u).split("/").at(-1)?.startsWith(ps+"."));
  return matching.find(u=>u.includes("/256x256/"))||matching.find(u=>u.includes("/512x512/"))||matching[0]||urls.find(u=>u.includes("/256x256/"))||urls[0]||null;
}
function titleFromPage(html){
  const h=cleanHtml(html);
  const m=h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if(!m)return null;
  return m[1].replace(/<[^>]+>/g," ").replace(/&[^;]+;/g," ").replace(/\s+/g," ").trim().replace(/\s+Logo\s*\(.*$/i,"").replace(/\s+Logo$/i,"");
}
function teamLinks(html,pageUrl){
  const h=cleanHtml(html);
  const start=h.search(/All [\s\S]{0,120}? Teams/i);
  if(start<0)return[];
  const rest=h.slice(start);
  const endRel=rest.search(/Matches in|Upcoming .* matches|View all logos from|Logos by Country/i);
  const section=endRel>0?rest.slice(0,endRel):rest.slice(0,50000);
  const out=[];
  for(const m of section.matchAll(/href=["'](https:\/\/football-logos\.cc)?(\/[^"'?#]+\/[^"'?#]+\/)["']/gi)){
    const p=m[2];
    if(!p||p===new URL(pageUrl).pathname)continue;
    if(/\/tournaments\//i.test(p))continue;
    out.push(new URL(p,cfg.source).href);
  }
  return uniq(out);
}
async function saveAsset(assetUrl,dest){
  await fs.mkdir(path.dirname(dest),{recursive:true});
  await fs.writeFile(dest,await fetchBytes(assetUrl));
}
async function cachePage(pageUrl,dest,kind,key,assetOverride=null){
  const html=sourcePages[pageUrl]??await fetchText(pageUrl);
  sourcePages[pageUrl]=html;
  const asset=assetOverride||chooseAsset(html,pageUrl);
  if(!asset)throw new Error("No 256x256 football-logos.cc asset found for "+pageUrl);
  await saveAsset(asset,dest);
  const publicPath="/"+dest.replaceAll("\\","/");
  registry[kind][key]=publicPath;
  registry.sources[publicPath]={page:pageUrl,asset};
  return html;
}
await fs.mkdir(COMP_DIR,{recursive:true});
await fs.mkdir(TEAM_DIR,{recursive:true});

for(const comp of cfg.competitions){
  try{
    const dest=path.join(COMP_DIR,comp.id+".png");
    const html=await cachePage(comp.page,dest,"competitions",comp.id,comp.asset||null);
    console.log("competition",comp.id,"->",dest);
    if(!comp.crawlTeams)continue;
    const links=teamLinks(html,comp.page);
    for(const url of links){
      try{
        const teamHtml=sourcePages[url]??await fetchText(url);
        sourcePages[url]=teamHtml;
        const name=titleFromPage(teamHtml)||pageSlug(url).replaceAll("-"," ");
        const asset=chooseAsset(teamHtml,url);
        if(!asset)continue;
        const country=new URL(url).pathname.split("/").filter(Boolean)[0]||"other";
        const file=path.join(TEAM_DIR,country,pageSlug(url)+".png");
        await saveAsset(asset,file);
        const publicPath="/"+file.replaceAll("\\","/");
        for(const key of uniq([norm(name),norm(pageSlug(url).replaceAll("-"," "))]).filter(Boolean)){
          if(!registry.teams[key])registry.teams[key]=publicPath;
        }
        registry.sources[publicPath]={page:url,asset};
        console.log("team",name,"->",file);
        await delay(45);
      }catch(e){console.warn("team skip",url,e.message)}
    }
  }catch(e){console.warn("competition skip",comp.id,e.message)}
  await delay(80);
}

await fs.writeFile(path.join(ROOT,"manifest.json"),JSON.stringify(registry,null,2)+"\n");
await fs.writeFile(path.join(ROOT,"registry.js"),"window.FOOTYEDGE_LOGOS="+JSON.stringify(registry)+";\n");
console.log("cached competitions",Object.keys(registry.competitions).length,"teams",Object.keys(registry.teams).length);
