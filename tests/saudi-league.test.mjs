import test from "node:test";
import assert from "node:assert/strict";
import "../assets/board-availability.js";
const leaguer=globalThis.FootyEdgeAvailability;
const make=(id,home="Al Nassr",away="Al Diriyah")=>({
  id:"401900907",uid:"s:600~l:"+id+"~e:401900907",
  name:away+" at "+home,
  date:"2026-10-09T18:00Z",
  competitions:[{competitors:[
    {homeAway:"home",team:{displayName:home,id:"100"}},
    {homeAway:"away",team:{displayName:away,id:"200"}},
  ]}],
  status:{type:{completed:false}},
});
test("Saudi Pro League gets the ESPN tracked men's competition identity",()=>{
 assert.equal(leaguer.leagueOf(make(21231)),"ksa.1");
});
test("Saudi international women's friendly is NOT mistaken for the Saudi men's league",()=>{
 const x=make(3923,"Saudi Arabia (W)","Malaysia (W)");
 x.season={slug:"2026-womens-international-friendly"};
 assert.notEqual(leaguer.leagueOf(x),"ksa.1");
});
