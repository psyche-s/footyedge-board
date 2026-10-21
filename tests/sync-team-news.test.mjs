import test from "node:test";
import assert from "node:assert/strict";
import {verifyNews} from "../scripts/sync-team-news.mjs";
test("only permitted, same-date verified predicted lineups are accepted",()=>{
 const day="2026-10-22",time=Date.parse(day+"T03:00:00Z");
 const fixture={id:"41",home:{name:"Sporting CP"},away:{name:"LASK Linz"}};
 const xi=Array.from({length:11},(_,i)=>"Player "+(i+1));
 const row={fixtureId:"41",home:{name:"Sporting CP",predictedXI:xi,out:[]},
  away:{name:"LASK Linz",predictedXI:xi,doubtful:[]},
  source:{url:"https://example.org/source",checkedAt:"2026-10-21T22:00:00Z"}};
 const doc={schema:"footyedge-sourced-team-intelligence-v1",date:day,fixtures:[row]};
 const result=verifyNews(doc,day,[fixture],time);
 assert.equal(result.length,1);
 assert.equal(result[0].home.lineupStatus,"predicted-not-confirmed");
 assert.equal(verifyNews({...doc,date:"2026-10-21"},day,[fixture],time).length,0);
 assert.equal(verifyNews({...doc,fixtures:[{...row,home:{...row.home,predictedXI:[]}}]},day,[fixture],time).length,0);
 assert.equal(verifyNews({...doc,fixtures:[{...row,source:{...row.source,checkedAt:"2026-10-01T22:00:00Z"}}]},day,[fixture],time).length,0);
});
