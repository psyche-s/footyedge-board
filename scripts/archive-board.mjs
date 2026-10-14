import fs from 'node:fs/promises';
import path from 'node:path';
import {validateBoard,validateIntegrity} from './validate-published-boards.mjs';
const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const TODAY=p.year+'-'+p.month+'-'+p.day,DATE=process.env.ARCHIVE_DATE||TODAY;
const target=path.join('data','boards',DATE+'.json'),draftPath=path.join('data','board-drafts',DATE+'.json');
const read=async f=>{try{return JSON.parse(await fs.readFile(f,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}};
async function main(){
 if(DATE!==TODAY)throw Error('Cannot publish to previous or future dates');
 const existing=await read(target),draft=await read(draftPath);
 if(existing){console.log('Existing official board is immutable; skip duplicate publication for '+DATE);return}\n if(!draft){console.log('No candidate draft; preserve current Top 5');return}
 if(draft.date!==DATE||draft.coverage!=='full-board'||!Array.isArray(draft.games)||!draft.games.length)throw Error('Incomplete current-day draft');
 if(!(draft.top5||[]).length){console.log('No new qualified picks. Preserve existing board.');return}
 if(existing?.top5?.length>draft.top5.length){console.log('Do not replace populated Top 5 with partial refresh.');return}
 const board=JSON.parse(JSON.stringify(draft));board.immutable=true;board.state='locked';board.frozenAt=new Date().toISOString();
 delete board.mutableUntil;board.lastPublishedAt=board.frozenAt;
 board.source='FootyEdge rolling same-day published board';
 board.lockedAtToronto=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',dateStyle:'short',timeStyle:'medium'}).format(new Date());
 validateBoard(board,{requireFull:true});
 if(existing&&JSON.stringify(existing.top5)===JSON.stringify(board.top5)){console.log('Picks unchanged');return}
 validateIntegrity('HEAD');
 await fs.mkdir(path.dirname(target),{recursive:true});
 const tmp=target+'.tmp';await fs.writeFile(tmp,JSON.stringify(board,null,2)+'\n');await fs.rename(tmp,target);
 console.log('Updated current-day Top 5',DATE,board.top5.length);
}
main().catch(e=>{console.error(e);process.exitCode=1});
