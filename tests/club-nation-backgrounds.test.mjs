import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const ui=fs.readFileSync("ui/part2.html","utf8");
const context=vm.createContext({esc:x=>String(x).replace(/[&<>"']/g,c=>
 ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))});
vm.runInContext(ui.slice(ui.indexOf("const FE_PALETTES="),ui.indexOf("function feUpcoming(g){")),context);
vm.runInContext(ui.slice(ui.indexOf("function fePlayerImageUrl("),ui.indexOf("\nasync function feOpenPlayerProfile(")),context);

test("reference clubs retain distinct decorative patterns and existing colours",()=>{
 for(const [name,role,pattern] of [["Arsenal","home","mosaic"],["Inter Milan","home","vertical"],
  ["Porto","home","diamonds"],["Tottenham Hotspur","away","angled"],
  ["Roma","away","chevron"],["Benfica","away","angled"]]){
  const actual=context.feKitPalette({name},role);
  assert.equal(actual.pattern,pattern,name);
  assert.match(actual.primary,/^#[0-9a-f]{6}$/i);
 }
});

test("nationality selects current flag codes and handles provider aliases",()=>{
 for(const [nation,code] of [["France","fr"],["Myanmar (Burma)","mm"],["Sweden","se"],
  ["England","gb-eng"],["Côte d'Ivoire","ci"],["Türkiye","tr"],["Congo DR","cd"],
  ["South Korea","kr"],["Cape Verde","cv"]])
  assert.equal(context.fePlayerNationCode(nation),code,nation);
 for(const unknown of ["",null,"Nationality unavailable","https://example.com/player.svg"])
  assert.equal(context.fePlayerNationCode(unknown),"");
});

test("the player backdrop combines the selected club with reported nationality",()=>{
 const data={status:"verified",player:{name:"Club player",team:"Liverpool",nationality:"Sweden"},
  stats:[{label:"Goals",value:6}],recent:[{date:"2026-10-25",opponent:"Brighton",goals:1,shots:3}]};
 const fallback={name:"Club player",club:{name:"Liverpool"},teamName:"Liverpool"};
 const backdrop=context.fePlayerBackdrop(data.player,fallback);
 assert.equal(backdrop.nation,"se");
 assert.match(backdrop.style,/--fe-player-club:#C8102E/);
 assert.match(backdrop.style,/flagcdn\.com\/se\.svg/);
 const html=context.fePlayerProfileMarkup(data,fallback);
 assert.match(html,/data-fe-nation="se"/);
 assert.match(html,/>Goals<\/span><strong>6<\/strong>/);
 assert.match(html,/Brighton/);
 assert.match(html,/<td>3<\/td>/);
 const missing=context.fePlayerBackdrop({team:"Liverpool",birthPlace:{country:"Sweden"}},fallback);
 assert.equal(missing.nation,"");
 assert.match(missing.style,/--fe-player-nation-flag:none$/);
});
