import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import profileHandler from "../api/player-profile.js";
import {matchRosterPlayer} from "../api/player-profile.js";
import lineupHandler from "../api/lineup-headshots.js";
import {rosterPhotos} from "../api/match-updates.js";
import {photoForIdentity,validPlayerImageURL} from "../lib/player-photos.mjs";

const photo="https://media.api-sports.io/football/players/278.png";
const athlete={id:"231388",displayName:"Kylian Mbappé"};
const catalog={"231388":{id:"231388",name:"Kylian Mbappé",url:photo}};

test("a mononym resolves only when unique in the exact club roster",()=>{
 const roster={athletes:[{id:"1",displayName:"Alisson Becker"}]};
 assert.equal(matchRosterPlayer(roster,"Alisson")?.id,"1");
 roster.athletes.push({id:"2",displayName:"Alisson Silva"});
 assert.equal(matchRosterPlayer(roster,"Alisson"),null);
});

test("catalogue requires exact athlete ID and a verified name, and restricts photo origins",()=>{
 assert.equal(photoForIdentity(athlete,catalog),photo);
 assert.equal(photoForIdentity({...athlete,id:"278"},catalog),"");
 assert.equal(photoForIdentity({...athlete,displayName:"A different player"},catalog),"");
 for(const bad of ["https://media.api-sports.io.evil.test/football/players/278.png",
  "https://media.api-sports.io/football/players/../278.png","https://media.api-sports.io/football/players/0.png",
  "data:image/png;base64,aaa","https://unknown.test/player.png"])
  assert.equal(validPlayerImageURL(bad),"");
});

test("browser and API accept the same checked photo hosts",()=>{
 const ui=fs.readFileSync("ui/part2.html","utf8");
 const code=ui.slice(ui.indexOf("function fePlayerImageUrl("),ui.indexOf("function fePlayerSafePhoto("));
 const allowed=vm.runInNewContext(code+";fePlayerImageUrl");
 for(const url of [photo,"https://a.espncdn.com/i/headshots/soccer/players/full/213248.png",
  ...Object.values(JSON.parse(fs.readFileSync("config/official-player-portraits.json","utf8")).players).map(p=>p.url),
  "https://media.api-sports.io.evil.test/football/players/278.png"])
  assert.equal(allowed(url),validPlayerImageURL(url));
});

test("saved portraits all belong to their team roster and have checked identity records",()=>{
 const refs=JSON.parse(fs.readFileSync("data/player-photo-refs.json","utf8"));
 const index=JSON.parse(fs.readFileSync("data/player-photo-index.json","utf8"));
 assert.equal(index.schema,"footyedge-player-photo-index-v1");
 for(const team of Object.values(refs.teams))for(const p of Object.values(team.players||{})){
  assert.ok(team.roster[p.id],"Photo must join the exact club roster");
  assert.ok(validPlayerImageURL(p.url));
  assert.match(p.sha256,/^[a-f0-9]{64}$/);
  assert.ok(index.players[p.id]);
 }
 assert.equal(photoForIdentity(athlete,index.players),index.players[athlete.id].url);
 assert.ok(Object.keys(index.players).length>1000);
});

test("profile and lineup handlers both return the same saved portrait without further image probes",async t=>{
 const expected=JSON.parse(fs.readFileSync("data/player-photo-index.json","utf8")).players[athlete.id].url;
 const previous=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{
  calls.push(String(url));
  const data=String(url).includes("/teams/86/roster")?{team:{id:"86",displayName:"Real Madrid"},athletes:[{...athlete,
   headshot:{href:"https://a.espncdn.com/i/headshots/soccer/players/full/231388.png"}}]}:{};
  return {ok:true,status:200,json:async()=>data};
 };
 t.after(()=>{globalThis.fetch=previous;});
 const response=()=>({code:200,body:null,setHeader(){},status(n){this.code=n;return this;},json(b){this.body=b;return this;}});
 const a=response();
 await profileHandler({method:"GET",query:{league:"esp.1",teamId:"86",name:"Kylian Mbappé",playerId:"231388"}},a);
 assert.equal(a.body.status,"verified");assert.equal(a.body.player.headshot,expected);
 const b=response();
 await lineupHandler({method:"GET",query:{league:"esp.1",teamId:"86",names:JSON.stringify([{name:"Kylian Mbappé",id:"231388"}])}},b);
 assert.equal(b.body.players[0].photoUrl,expected);
 assert.equal(rosterPhotos({athletes:[athlete]})[0].photoUrl,expected);
 assert.ok(!calls.some(url=>url.includes("espncdn.com")||url.includes("media.api-sports.io")));
});
