import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const css=fs.readFileSync("assets/fixture-art/club-nation-backgrounds-v3.css","utf8");
const part1=fs.readFileSync("ui/part1.html","utf8");
const picks=fs.readFileSync("picks.html","utf8");
test("approved fixture background is applied to both collapsed and expanded heroes",()=>{
  assert.match(css,/:is\(\.fe-matchCard,\.fe-dialogHero\) \.fe-hero\.fe-kitHero/);
  assert.match(css,/fe-kitHero\[data-home-kit\]::before/);
  assert.match(css,/fe-kitHero\[data-home-kit\]::after/);
  assert.match(css,/fe-kitHero\[data-home-kit\]\[data-featured-art\]/);
  assert.match(css,/premium-knit-home\.svg/);
  assert.match(css,/premium-knit-away\.svg/);
});
test("future fixtures use the same dynamic per-team colours",()=>{
  assert.match(css,/var\(--fe-home\)/);
  assert.match(css,/var\(--fe-away\)/);
  assert.match(css,/mask-image:linear-gradient/);
  for(const p of ["home","away"]){
    const svg=fs.readFileSync("assets/fixture-art/premium-knit-"+p+".svg","utf8");
    assert.match(svg,/<svg[^>]+viewBox=/);
    assert.doesNotMatch(svg,/Arsenal|Tottenham|Sassuolo|Lazio/);
  }
});
test("art-only update preserves the match layout and cache busting",()=>{
  assert.doesNotMatch(css,/grid-template-columns|padding|font-size/);
  assert.match(part1,/club-nation-backgrounds-v3\.css\?v=\d+/);
  assert.ok(part1.indexOf("club-nation-backgrounds-v3.css")>part1.lastIndexOf("</style>"),"background treatment loads after the existing profile styles");
  assert.match(picks,/ui\/part1\.html\?v=\d+/);
});
