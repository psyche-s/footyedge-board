import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const ui=fs.readFileSync('ui/part2.html','utf8');
const code=ui.slice(ui.indexOf('function fePlayerSafePhoto('),ui.indexOf('\nasync function feOpenPlayerProfile('));
const context=vm.createContext({esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))});
vm.runInContext(code,context);
const render=(result,fallback={name:'Club player',teamName:'Club'})=>context.fePlayerProfileMarkup(result,fallback);

test('profile keeps identity, ten appearances and season totals separate without inventing missing values',()=>{
 const html=render({status:'verified',player:{name:'Kylian Mbappé',team:'Real Madrid',jerseyNumber:'10'},competition:'LALIGA',
  stats:[{label:'Appearances',value:10},{label:'Goals',value:11},{label:'Assists',value:0},{label:'Minutes played',value:null}],
  recent:Array.from({length:12},(_,i)=>({date:'2026-10-25',opponent:'Opponent '+i,competition:'LALIGA',goals:0,minutes:null}))});
 assert.match(html,/aria-label="Kylian Mbappé"/);
 assert.equal((html.match(/id="fe-playerTitle"/g)||[]).length,1);
 assert.equal((html.match(/data-fe-recent-comp=/g)||[]).length,10);
 assert.equal((html.match(/>Goals<\/span>/g)||[]).length,1);
 assert.match(html,/>Assists<\/span><strong>0<\/strong>/);
 assert.doesNotMatch(html,/>Minutes played<\/span>/);
 assert.match(html,/<td>—<\/td>/);
 assert.match(html,/aria-hidden="true">10<\/span>/);
});

test('unverified payloads and unsafe portraits cannot leak into a rendered profile',()=>{
 const html=render({status:'unavailable',player:{name:'Wrong person',headshot:'https://unknown.example/player.png'},
  stats:[{label:'Goals',value:99}],recent:[{opponent:'Unverified opponent'}]}, {name:'Itsuki Someno',teamName:'Tokyo Verdy 1969'});
 assert.match(html,/Itsuki Someno/);
 assert.doesNotMatch(html,/Wrong person|unknown.example|Unverified opponent|>99</);
 assert.match(html,/No verified recent match-by-match player data/);
 assert.match(html,/fe-playerPortraitPlaceholder/);
});

test('trusted portraits retain their fallback and profile controls expose their selected state',()=>{
 const html=render({status:'verified',player:{name:'Denzel Dumfries',headshot:'https://a.espncdn.com/i/headshots/soccer/players/full/213248.png'},
  recent:[{date:'2026-10-25',opponent:'Barcelona',competition:'LALIGA',shots:0}]});
 assert.match(html,/class="fe-playerPortrait"/);
 assert.match(html,/this.nextElementSibling.hidden=false/);
 assert.match(html,/data-fe-player-view="appearances" aria-pressed="true"/);
 assert.match(html,/data-fe-player-view="season" aria-pressed="false"/);
 assert.match(html,/aria-pressed="true" data-fe-recent-filter="all"/);
 assert.match(html,/<details class="fe-playerStatLegend">/);
 for(const metric of ['G','A','SH','SOT','MIN','FC','FW','YC','RC'])assert.ok(html.includes('>'+metric+'</th>'));
});
