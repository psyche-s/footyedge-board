import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const css=fs.readFileSync("assets/fixture-art/split-kit-backgrounds-v2.css","utf8");
const part1=fs.readFileSync("ui/part1.html","utf8");
const picks=fs.readFileSync("picks.html","utf8");
test("approved fixture background is applied to both collapsed and expanded heroes",()=>{
  assert.match(css,/:is\(\.fe-matchCard,\.fe-dialogHero\) \.fe-hero\.fe-kitHero/);
  assert.match(css,/\[data-featured-art\]::before/);
  assert.match(css,/\[data-featured-art\]::after/);
  assert.match(css,/premium-knit-home\.svg/);
  assert.match(css,/premium-knit-away\.svg/);
});
test("future fixtures use the same dynamic per-team colours",()=>{
  assert.match(css,/var\(--fe-home,/);
  assert.match(css,/var\(--fe-away,/);
  assert.match(css,/mask-image:linear-gradient/);
  for(const p of ["home","away"]){
    const svg=fs.readFileSync("assets/fixture-art/premium-knit-"+p+".svg","utf8");
    assert.match(svg,/<svg[^>]+viewBox=/);
    assert.doesNotMatch(svg,/Arsenal|Tottenham|Sassuolo|Lazio/);
  }
});
test("art-only update preserves the match layout and cache busting",()=>{
  assert.doesNotMatch(css,/grid-template-columns|padding|font-size|\.fe-heroTeams/);
  assert.match(part1,/split-kit-backgrounds-v2\.css\?v=2/);
  assert.match(picks,/ui\/part1\.html\?v=146/);
});