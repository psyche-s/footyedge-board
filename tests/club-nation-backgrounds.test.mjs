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

test("the player backdrop uses club colours without national flag artwork",()=>{
 const data={status:"verified",player:{name:"Club player",team:"Liverpool",nationality:"Sweden"},
  stats:[{label:"Goals",value:6}],recent:[{date:"2026-10-25",opponent:"Brighton",goals:1,shots:3}]};
 const fallback={name:"Club player",club:{name:"Liverpool"},teamName:"Liverpool"};
 const backdrop=context.fePlayerBackdrop(data.player,fallback);
 assert.match(backdrop.style,/--fe-player-club:#C8102E/);
 assert.doesNotMatch(backdrop.style,/flagcdn|nation-flag/);
 const html=context.fePlayerProfileMarkup(data,fallback);
 assert.doesNotMatch(html,/data-fe-nation|flagcdn/);
 assert.match(html,/Sweden/);
 assert.match(html,/>Goals<\/span><strong>6<\/strong>/);
 assert.match(html,/Brighton/);
 assert.match(html,/<td>3<\/td>/);
 assert.equal(context.fePlayerBackdrop({...data.player,nationality:"France"},fallback).style,backdrop.style);
});
