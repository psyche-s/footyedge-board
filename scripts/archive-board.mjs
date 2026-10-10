import fs from 'node:fs/promises';
import path from 'node:path';
import {validateBoard,validateIntegrity} from './validate-published-boards.mjs';
const TZ='America/Toronto',LOCK_HOUR=0,LOCK_MINUTE=30;
const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const TODAY=`${p.year}-${p.month}-${p.day}`,DATE=process.env.ARCHIVE_DATE||TODAY;
async function main(){
  const file=path.join('data','boards',DATE+'.json'),draftFile=path.join('data','board-drafts',DATE+'.json');
  try{const existing=JSON.parse(await fs.readFile(file,'utf8'));validateBoard(existing);console.log('Official board already locked; unchanged:',file);return}catch(e){if(e.code!=='ENOENT')throw e}
  if(DATE<TODAY)throw new Error('Cannot generate historical published selections. Restore verified originals only with an audited owner instruction.');
  if(DATE>TODAY)throw new Error('Future dates stay unpublished until their own 00:30 Toronto lock.');
  if(Number(p.hour)<LOCK_HOUR||(Number(p.hour)===LOCK_HOUR&&Number(p.minute)<LOCK_MINUTE)){console.log('Before 00:30 Toronto lock; leaving rolling preview mutable');return}
  let draft;try{draft=JSON.parse(await fs.readFile(draftFile,'utf8'))}catch(e){if(e.code==='ENOENT')throw new Error('Cannot lock '+DATE+': rolling preview is missing');throw e}
  if(draft.date!==DATE||draft.immutable!==false||draft.state!=='preview'||draft.coverage!=='full-board'||!Array.isArray(draft.games)||!draft.games.length)throw new Error('Cannot lock invalid rolling preview '+DATE);
  const payload=JSON.parse(JSON.stringify(draft));
  payload.immutable=true;payload.state='locked';payload.frozenAt=new Date().toISOString();payload.lockedAtToronto=DATE+' 00:30 America/Toronto';payload.source='FootyEdge official 00:30 Toronto locked board';
  validateBoard(payload,{requireFull:true});
  await fs.mkdir(path.dirname(file),{recursive:true});
  try{await fs.writeFile(file,JSON.stringify(payload,null,2)+'\n',{flag:'wx'})}catch(e){if(e.code!=='EEXIST')throw e;console.log('Another publisher locked the board first; unchanged');return}
  validateIntegrity('HEAD');
  console.log('Locked official board at 00:30 policy boundary:',DATE,payload.games.length,'games')
}
main().catch(e=>{console.error(e);process.exitCode=1});
