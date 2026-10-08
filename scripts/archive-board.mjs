import fs from 'node:fs/promises';
import path from 'node:path';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {validateBoard,validateIntegrity} from './validate-published-boards.mjs';
const require=createRequire(import.meta.url);
const SITE=(process.env.FOOTYEDGE_URL||'https://footyedge-board.vercel.app').replace(/\/$/,'');
const TZ='America/Toronto';
const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const DATE=process.env.ARCHIVE_DATE||`${p.year}-${p.month}-${p.day}`;
async function main(){
  const file=path.join('data','boards',DATE+'.json');
  try{const existing=JSON.parse(await fs.readFile(file,'utf8'));validateBoard(existing);console.log('Published board already exists; unchanged:',file);return}catch(e){if(e.code!=='ENOENT')throw e}
  if(DATE<`${p.year}-${p.month}-${p.day}`)throw new Error('Cannot generate historical published selections. Restore verified originals only with an audited owner instruction.');
  if(DATE>`${p.year}-${p.month}-${p.day}`)throw new Error('Future boards are schedule-only and cannot be published before their Toronto calendar date.');
  if(process.env.FORCE_ARCHIVE!=='1'&&![6,7,23].includes(Number(p.hour))){console.log('Outside publication window');return}
  execFileSync(process.execPath,['scripts/validate-daily-board.mjs'],{env:{...process.env,BOARD_DATE:DATE},stdio:'inherit'});
  const {chromium}=require('playwright');
  // Capture reviewed checkout code and local dated inputs, never an older deployment.
  const server=createServer(async(req,res)=>{
    try{
      const u=new URL(req.url,'http://localhost');
      if(u.pathname.startsWith('/api/')){
        const r=await fetch(SITE+req.url,{signal:AbortSignal.timeout(90000)});res.writeHead(r.status,{'content-type':'application/json'});res.end(await r.text());return;
      }
      if(!/^\/(picks\.html|assets\/board-availability\.js|ui\/[a-z0-9-]+\.html|data\/[a-zA-Z0-9_./-]+\.json)$/.test(u.pathname)||u.pathname.includes('..')){res.writeHead(404);res.end();return}
      const body=await fs.readFile(path.join(process.cwd(),u.pathname.slice(1)));res.writeHead(200,{'content-type':u.pathname.endsWith('.json')?'application/json':u.pathname.endsWith('.js')?'text/javascript':'text/html'});res.end(body);
    }catch{res.writeHead(503);res.end('{}')}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1200}});
    // Dated inputs must come from this checkout, not mutable GitHub raw responses.
    await page.route('https://raw.githubusercontent.com/**',route=>route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/picks.html?archiveCapture=1&boardDate=${DATE}`,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>typeof window.FootyEdgeArchive==='function'&&window.FootyEdgeArchive()?.games?.length>0,{timeout:120000});
    const payload=await page.evaluate(()=>window.FootyEdgeArchive());
    if(payload.date!==DATE)throw new Error('Archive date mismatch');
    validateBoard(payload,{requireFull:true});
    payload.capturedBy='GitHub Actions';payload.captureUrl=SITE;payload.sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    await fs.mkdir(path.dirname(file),{recursive:true});
    // Exclusive creation also protects against simultaneous publication attempts.
    try{await fs.writeFile(file,JSON.stringify(payload,null,2)+'\n',{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e;console.log('Another publisher created the board; left unchanged');return}
    validateIntegrity('HEAD');
    console.log('Published complete frozen board:',DATE,payload.games.length,'games');
  }finally{await browser.close();await new Promise(r=>server.close(r))}
}
main().catch(e=>{console.error(e);process.exitCode=1});
