import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import quality from "../lib/portrait-quality.cjs";
import {writePlayerPhotoCatalog} from "../scripts/build-player-photo-catalog.mjs";
import {verifyImage} from "../scripts/sync-player-photo-refs.mjs";
const {imageDimensions,betterPortrait}=quality;
const png=(width,height)=>{
 const b=Buffer.alloc(4000);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);
 b.writeUInt32BE(width,16);b.writeUInt32BE(height,20);return b;
};
test("portrait dimensions come from PNG, JPEG and WebP bytes, not advertised URL sizes",()=>{
 assert.deepEqual(imageDimensions(png(500,700)),{width:500,height:700});
 const jpeg=Buffer.from([255,216,255,224,0,4,0,0,255,194,0,8,8,2,188,1,244,0,255,217]);
 assert.deepEqual(imageDimensions(jpeg),{width:500,height:700});
 const webp=Buffer.alloc(30);webp.write("RIFF",0);webp.write("WEBP",8);webp.write("VP8X",12);
 webp.writeUIntLE(1999,24,3);webp.writeUIntLE(1015,27,3);
 assert.deepEqual(imageDimensions(webp),{width:2000,height:1016});
 assert.equal(imageDimensions(Buffer.from("<html>not a photo</html>")),null);
 assert.equal(imageDimensions(jpeg.subarray(0,14)),null);
});
test("a small successful response never downgrades a larger verified portrait",()=>{
 const large={url:"https://a.espncdn.com/i/headshots/soccer/players/full/1.png",width:600,height:436};
 const small={url:"https://media.api-sports.io/football/players/1.png",width:150,height:150};
 assert.equal(betterPortrait(small,large),large);
 assert.equal(betterPortrait(large,small),large);
 assert.equal(betterPortrait(null,large),large);
 const measuredSmall={...small,url:"https://resources.premierleague.com/premierleague/photos/players/250x250/p1.png"};
 assert.equal(betterPortrait(measuredSmall,large),large);
});
test("duplicate competition rosters publish the largest portrait in either input order",t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"footyedge-photo-test-"));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,"assets"));fs.mkdirSync(path.join(root,"data"));
 const small={id:"123",name:"Test Player",url:"https://media.api-sports.io/football/players/1.png",width:150,height:150};
 const large={...small,url:"https://a.espncdn.com/i/headshots/soccer/players/full/123.png",width:600,height:436};
 const team=p=>({roster:{123:{name:p.name}},players:{123:p}});
 for(const entries of [[small,large],[large,small]]){
  const {registry,index}=writePlayerPhotoCatalog({teams:{a:team(entries[0]),b:team(entries[1])}},root);
  assert.equal(index[123].url,large.url);assert.equal(index[123].width,600);
  assert.equal(registry.a[0][2],large.url);assert.equal(registry.b[0][2],large.url);
 }
});
test("collector measures a new image and retains the previous photo if candidates are worse",async t=>{
 const original=globalThis.fetch;
 t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async()=>({ok:true,headers:{get:()=>"image/png"},arrayBuffer:async()=>png(150,150)});
 const previous={id:"999999999",name:"Unique Test Player",url:"https://images.fotmob.com/image_resources/playerimages/9.png",width:300,height:300};
 assert.equal(await verifyImage({id:previous.id,name:previous.name,previous}),previous);
 globalThis.fetch=async()=>({ok:true,headers:{get:()=>"image/png"},arrayBuffer:async()=>png(600,436)});
 const result=await verifyImage({id:previous.id,name:previous.name,previous});
 assert.equal(result.width,600);assert.equal(result.height,436);assert.match(result.sha256,/^[a-f0-9]{64}$/);
});
test("an older unmeasured reference is preserved when its dimensions cannot be checked",async t=>{
 const original=globalThis.fetch,calls=[];
 t.after(()=>{globalThis.fetch=original;});
 const previous={id:"231388",name:"Kylian Mbappé",url:"https://a.espncdn.com/i/headshots/soccer/players/full/231388.png"};
 globalThis.fetch=async url=>{calls.push(url);return {ok:false};};
 assert.equal(await verifyImage({id:previous.id,name:previous.name,teamId:"86",previous}),previous);
 assert.deepEqual(calls,[previous.url]);
});
test("official club references require the exact player and matching club",async t=>{
 const original=globalThis.fetch,urls=[];
 t.after(()=>{globalThis.fetch=original;});
 globalThis.fetch=async url=>{urls.push(url);return {ok:false};};
 await verifyImage({id:"235662",name:"Alexander Isak",teamId:"361"});
 assert.ok(!urls.some(url=>url.includes("stadion.io")));
 urls.length=0;
 await verifyImage({id:"235662",name:"Alexander Isak",teamId:"364"});
 assert.ok(urls[0].includes("stadion.io"));
 urls.length=0;
 await verifyImage({id:"235662",name:"Different Player",teamId:"364"});
 assert.ok(!urls.some(url=>url.includes("stadion.io")));
});
