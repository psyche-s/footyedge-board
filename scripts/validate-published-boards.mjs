import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
export function validateBoard(board,{requireFull=false}={}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(board?.date||'')||board.immutable!==true)throw new Error('Published board requires date and immutable:true');
  const explicitlyCleared=board.state==='locked'&&board.coverage==='full-board'&&board.scope==='owner-selected-competitions'&&Array.isArray(board.games)&&board.games.length===0&&Array.isArray(board.top5)&&board.top5.length===0&&Object.values(board.leagueTop5||{}).every(x=>Array.isArray(x)&&x.length===0);
  if(!Array.isArray(board.games)||(!board.games.length&&!explicitlyCleared)||!Array.isArray(board.top5)||board.top5.length>5)throw new Error('Invalid board games/Top 5');
  if(requireFull&&(board.schema<2||board.coverage!=='full-board'))throw new Error('First publication must capture the complete board');
  const ids=new Set();
  for(const g of board.games){
    const key=String(g.id||g.home+'|'+g.away);
    if((requireFull&&!g.id)||ids.has(key)||!g.home||!g.away||!Array.isArray(g.top3))throw new Error('Missing/duplicate game or Top 3');
    ids.add(key);
    if(g.top&&JSON.stringify(g.top)!==JSON.stringify(g.top3[0]))throw new Error('Game pick and Top 3 disagree: '+g.id);
    if(requireFull&&(!g.date||!g.teams))throw new Error('Full archive is missing fixture metadata');
  }
  for(const refs of [board.top5,...Object.values(board.leagueTop5||{})]){
    const seen=new Set();
    refs.forEach((p,i)=>{
      const g=board.games.find(g=>p.gameId?String(g.id)===String(p.gameId):g.home===p.home&&g.away===p.away);
      if(p.rank!==i+1||!g||seen.has(g.home+'|'+g.away)||JSON.stringify(p.pick)!==JSON.stringify(g.top))throw new Error('Ranked board disagrees with saved game picks');
      seen.add(g.home+'|'+g.away);
    });
  }
}
export function validateIntegrity(base){
  const files=fs.readdirSync('data/boards').filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  for(const f of files)validateBoard(JSON.parse(fs.readFileSync('data/boards/'+f,'utf8')));
  for(const f of fs.readdirSync('data/performance').filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f))){
    const file='data/performance/'+f,boardFile='data/boards/'+f;
    if(!fs.existsSync(boardFile))throw new Error('Performance record has no published board: '+file);
    const board=JSON.parse(fs.readFileSync(boardFile,'utf8')),performance=JSON.parse(fs.readFileSync(file,'utf8'));
    const expected=board.top5.map(x=>({rank:x.rank,home:x.home,away:x.away,selection:x.pick.label,confidence:x.pick.score,odds:x.pick.odds==null?null:String(x.pick.odds)}));
    const actual=(performance.top5||[]).map(x=>({rank:x.rank,home:x.home,away:x.away,selection:x.selection,confidence:x.confidence,odds:x.odds==null?null:String(x.odds)}));
    if(JSON.stringify(expected)!==JSON.stringify(actual))throw new Error('Tracking selections differ from published board: '+file);
  }
  if(!base)return;
  for(const f of files){
    let existed=true;try{execFileSync('git',['cat-file','-e',base+':data/boards/'+f],{stdio:'ignore'})}catch{existed=false}
    if(!existed)validateBoard(JSON.parse(fs.readFileSync('data/boards/'+f,'utf8')),{requireFull:true});
  }
  const previous=execFileSync('git',['ls-tree','-r','--name-only',base,'data/boards','data/daily-odds-*','data/daily-insights-*','data/research-base-*'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  for(const file of previous){
    const date=file.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    let oldBoard;try{oldBoard=execFileSync('git',['show',base+':data/boards/'+date+'.json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']})}catch{continue}
    const before=execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
    if(!fs.existsSync(file))throw new Error('Cannot delete published data: '+file);
    const after=fs.readFileSync(file,'utf8');if(before===after)continue;
    const auditFile='data/board-revisions/'+date+'/audit.json';
    const audits=fs.existsSync(auditFile)?JSON.parse(fs.readFileSync(auditFile,'utf8')):[];
    const audit=audits.find(a=>a.file===file&&a.beforeSha256===sha256(before)&&a.afterSha256===sha256(after)&&a.owner==='Shaif'&&a.instruction&&a.correctedAt&&a.backupPath);
    if(!audit||!fs.existsSync(audit.backupPath)||sha256(fs.readFileSync(audit.backupPath,'utf8'))!==sha256(before))throw new Error('Published data changed without preserved explicit owner correction: '+file);
    console.log('Audited owner correction:',file);
  }
  // Correction history itself is append-only and backups cannot change or disappear.
  const revisions=execFileSync('git',['ls-tree','-r','--name-only',base,'data/board-revisions'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  for(const file of revisions){
    const before=execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
    if(!fs.existsSync(file))throw new Error('Correction history deleted: '+file);
    const after=fs.readFileSync(file,'utf8');
    if(file.endsWith('/audit.json')){
      const a=JSON.parse(before),b=JSON.parse(after);if(JSON.stringify(a)!==JSON.stringify(b.slice(0,a.length)))throw new Error('Correction audit rewritten: '+file);
    }else if(before!==after)throw new Error('Correction backup rewritten: '+file);
  }
  console.log('Published board integrity verified against',base);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const i=process.argv.indexOf('--base');validateIntegrity(i>=0?process.argv[i+1]:process.env.PUBLISHED_BASE_REF||'HEAD')}catch(e){console.error(e.message);process.exitCode=1}
}
