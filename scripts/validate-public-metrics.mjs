#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
export function validatePublicMetrics(board){
  const errors=[];
  for(const game of board?.games||[])for(const pick of game.top3||[]){
    const id=String(game.id||game.home+' vs '+game.away),probability=Number(pick.calibratedProbability??pick.modelProb),decimal=Number(pick.priceDecimal);
    const calibrated=pick.probabilityCalibrated===true&&Number.isFinite(probability)&&probability>=0&&probability<=1;
    if(!calibrated){
      if(pick.ev!=null)errors.push(id+': EV exists without calibrated exact-market probability');
      if(pick.score!=null)errors.push(id+': confidence exists without calibrated exact-market probability');
      continue;
    }
    if(!Number.isFinite(pick.score)||Math.abs(pick.score-probability*100)>.11)errors.push(id+': confidence does not match calibrated probability');
    if(pick.ev!=null){
      if(pick.verifiedPrice!==true||pick.bookExact!==true||!Number.isFinite(decimal)||decimal<=1)errors.push(id+': EV lacks exact verified decimal price');
      else if(Math.abs(pick.ev-(probability*decimal-1))>1e-5)errors.push(id+': EV arithmetic mismatch');
    }
  }
  if(errors.length)throw Error(errors.join('\n'));
  return true
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  const date=process.env.BOARD_DATE||parts.year+'-'+parts.month+'-'+parts.day,file='data/boards/'+date+'.json';
  if(!fs.existsSync(file)){console.log('No same-day board metrics to validate');process.exit(0)}
  try{validatePublicMetrics(JSON.parse(fs.readFileSync(file,'utf8')));console.log('Public metric safety verified:',file)}catch(error){console.error(error.message);process.exitCode=1}
}
