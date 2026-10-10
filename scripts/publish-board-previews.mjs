import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const SITE=(process.env.FOOTYEDGE_URL||'https://footyedge-board.vercel.app').replace(/\/$/,'');
const TZ='America/Toronto',LOCK_HOUR=0,LOCK_MINUTE=30,PREVIEW_DAYS=Math.max(0,Math.min(4,Number(process.env.PREVIEW_DAYS??4))),FORCE_TODAY_CAPTURE=process.env.FORCE_TODAY_CAPTURE==='1';
const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const TODAY=`${parts.year}-${parts.month}-${parts.day}`,HOUR=Number(parts.hour),MINUTE=Number(parts.minute);
const addDate=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
async function exists(f){try{await fs.access(f);return true}catch{return false}}
function validateDraft(board,date){
  if(board?.date!==date||board?.immutable!==false||board?.state!=='preview'||board?.coverage!=='full-board'||!Array.isArray(board.games)||!Array.isArray(board.top5)||board.top5.length>5)throw new Error('Invalid preview board '+date);
  const byId=new Map(board.games.map(g=>[String(g.id),g]));
  for(const g of board.games)if(!g.id||!g.home||!g.away||!Array.isArray(g.top3))throw new Error('Incomplete preview fixture '+date);
  for(const [i,p] of board.top5.entries()){const g=byId.get(String(p.gameId));if(p.rank!==i+1||!g||JSON.stringify(p.pick)!==JSON.stringify(g.top))throw new Error('Preview Top 5 mismatch '+date)}
}
async function main(){
  await fs.mkdir(path.join('data','board-drafts'),{recursive:true});
  const server=createServer(async(req,res)=>{
    try{
      const u=new URL(req.url,'http://localhost');
      if(u.pathname.startsWith('/api/')){const r=await fetch(SITE+req.url,{signal:AbortSignal.timeout(90000)});res.writeHead(r.status,{'content-type':'application/json'});res.end(await r.text());return}
      if(!/^\/(picks\.html|assets\/board-availability\.js|ui\/[a-z0-9-]+\.html|data\/[a-zA-Z0-9_./-]+\.json)$/.test(u.pathname)||u.pathname.includes('..')){res.writeHead(404);res.end();return}
      const body=await fs.readFile(path.join(process.cwd(),u.pathname.slice(1)));res.writeHead(200,{'content-type':u.pathname.endsWith('.json')?'application/json':u.pathname.endsWith('.js')?'text/javascript':'text/html'});res.end(body)
    }catch{res.writeHead(503);res.end('{}')}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1'));
  const browser=await require('playwright').chromium.launch({headless:true});
  try{
    for(let offset=0;offset<=PREVIEW_DAYS;offset++){
      const date=addDate(TODAY,offset),locked=path.join('data','boards',date+'.json'),draftFile=path.join('data','board-drafts',date+'.json');
      if(await exists(locked)){console.log('Official board locked; preview unchanged:',date);continue}
      if(date===TODAY&&(HOUR>LOCK_HOUR||(HOUR===LOCK_HOUR&&MINUTE>=LOCK_MINUTE))&&!FORCE_TODAY_CAPTURE){console.log('Past 00:30 Toronto lock; refusing mutable refresh:',date);continue}
      const page=await browser.newPage({viewport:{width:1440,height:1200}});
      try{
        await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}/picks.html?draftCapture=1&boardDate=${date}`,{waitUntil:'domcontentloaded',timeout:120000});
        await page.waitForFunction(()=>typeof window.FootyEdgeDraft==='function'&&window.FootyEdgeDraft(),{timeout:150000});
        const payload=await page.evaluate(()=>window.FootyEdgeDraft());
        if(!payload?.games?.length){await fs.rm(draftFile,{force:true});console.log('No tracked fixtures; removed stale preview:',date);continue}
        validateDraft(payload,date);
        payload.capturedBy='GitHub Actions';payload.captureUrl=SITE;payload.sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
        payload.generatedAt=new Date().toISOString();payload.mutableUntil=date+' 00:30 America/Toronto';
        await fs.writeFile(draftFile,JSON.stringify(payload,null,2)+'\n');
        console.log('Updated rolling preview:',date,payload.games.length,'games',payload.top5.length,'Top 5')
      }catch(error){console.error('Preview refresh failed for',date,error instanceof Error?error.message:error)}
      finally{await page.close()}
    }
  }finally{await browser.close();await new Promise(r=>server.close(r))}
}
main().catch(e=>{console.error(e);process.exitCode=1});
