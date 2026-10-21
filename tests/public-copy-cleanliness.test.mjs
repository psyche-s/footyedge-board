import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const fixture=fs.readFileSync("ui/part2.html","utf8");
const picks=fs.readFileSync("top-picks.html","utf8");
const slip=fs.readFileSync("assets/sgp-bet365-2026-10-21.js","utf8");
const body=src=>src.match(/function (?:feCleanPublicCopy|cleanReason)\(value\)\{[\s\S]*?\n\}/)?.[0];

test("sources and links are removed from every visible pick-reason renderer, not its metadata",()=>{
 const a=body(fixture),b=body(picks);
 assert.ok(a&&b,"Both public pages must retain a sanitizer");
 const exposed=[new Function(a+";return feCleanPublicCopy;")(),new Function(b+";return cleanReason;")()];
 const samples=[
  "According to Sports Mole, Sporting have 8 wins in 10. Read more: https://example.org/article",
  "Football Whispers and Sportskeeda like this matchup; see [Preview](https://example.org/preview).",
  "Espanyol have won four of their last five games."
 ];
 for(const clean of exposed){
   assert.equal(clean(samples[0]),"Sporting have 8 wins in 10.");
   assert.doesNotMatch(clean(samples[1]),/Sports Mole|Football Whispers|Sportskeeda|https?:|Preview/i);
   assert.equal(clean(samples[2]),samples[2]);
 }
 assert.match(fixture,/return feCleanPublicCopy\(feRawReviewedReason\(g,p\)\)/);
 assert.match(picks,/esc\(cleanReason\(p\.reason/);
 assert.match(slip,/cleanReason\(leg\.why\)/);
 assert.match(fixture,/function fePreviewLinks\(g,p\)\{return "";\}/);
});
test("footyedge keeps functional navigation and its requested bet-slip action, without source footers",()=>{
 assert.match(picks,/href="picks\.html"/);
 assert.match(slip,/Add to Your Bet Slip/);
 assert.doesNotMatch(picks,/<p class="notice">[^<]*<a\b/i);
 assert.doesNotMatch(picks,/\(x\.evidence\?'<span class="legEvidence">/);
 assert.doesNotMatch(fixture,/\+marketReviewHtml\+oddsExtra/);
});
