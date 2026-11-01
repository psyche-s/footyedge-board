import fs from 'node:fs';import vm from 'node:vm';
const base=process.cwd()+'/';
const date=process.argv[2]||new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const refs=JSON.parse(fs.readFileSync(base+'data/player-photo-refs.json'));
const registry={};for(const [k,t] of Object.entries(refs.teams))registry[k]=Object.values(t.players||{}).map(p=>[p.id,p.name,p.url]);
const ui=fs.readFileSync(base+'ui/part2.html','utf8');
const context=vm.createContext({window:{FE_PLAYER_PHOTOS:registry},feLiveRosterPhotos:new Map(),fePhotoNameKey:s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()});
vm.runInContext(ui.slice(ui.indexOf('function feCachedPlayerPhoto('),ui.indexOf('function fePlayerSafePhoto(')),context);
const games=JSON.parse(fs.readFileSync(base+'data/boards/'+date+'.json')).games;
const intel=JSON.parse(fs.readFileSync(base+'data/team-intelligence/'+date+'.json')).fixtures;
let all=0,withPhotos=0;const byLeague={},missing=[];
for(const g of games){const x=intel.find(x=>String(x.fixtureId)===String(g.id));if(!x)continue;
 for(const side of ['home','away']){const t=g.teams[side],roster=x[side].confirmedXI||x[side].predictedXI||[];
 for(const p of roster){all++;const name=typeof p==='string'?p:p.name;const photo=context.feCachedPlayerPhoto(g,t,p);byLeague[g.league]??={total:0,photos:0};byLeague[g.league].total++;
 if(photo){withPhotos++;byLeague[g.league].photos++;}else missing.push({league:g.league,team:t.name,teamId:t.id,name});
 }}
}
const report={schema:'footyedge-lineup-photo-coverage-v1',date,checkedAt:new Date().toISOString(),lineupEntries:all,withVerifiedPhoto:withPhotos,missingCount:missing.length,byLeague,missing};
fs.mkdirSync(base+'data/player-photo-coverage',{recursive:true});
fs.writeFileSync(base+'data/player-photo-coverage/'+date+'.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,missing:undefined}));
