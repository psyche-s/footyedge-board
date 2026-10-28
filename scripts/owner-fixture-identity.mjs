/**
 * Stable match identity across ESPN, official cup schedules and editorial names.
 * Same competition + same Toronto-local match day + both normalized club names.
 * Explicit aliases avoid deduping unrelated clubs by aggressive prefix stripping.
 */
const normalize=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const aliases={
 "afc bournemouth":"bournemouth","bournemouth":"bournemouth",
 "d c united":"dc united","dc united":"dc united",
 "atlanta united fc":"atlanta united","atlanta united":"atlanta united",
 "inter miami cf":"inter miami","inter miami":"inter miami",
 "new york red bulls":"ny red bulls","red bull new york":"ny red bulls",
 "internazionale":"inter milan","inter milan":"inter milan",
 "sc paderborn":"paderborn","sc paderborn 07":"paderborn",
 "schalke 04":"schalke","fc schalke 04":"schalke",
 "hertha berlin":"hertha","hertha bsc":"hertha",
 "kaiserslautern":"kaiserslautern","1 fc kaiserslautern":"kaiserslautern",
 "hearts":"heart of midlothian","heart of midlothian":"heart of midlothian",
 "bayer 04 leverkusen":"bayer leverkusen","bayer leverkusen":"bayer leverkusen",
 "man city":"manchester city","manchester city":"manchester city",
 "brighton":"brighton hove albion","brighton hove albion":"brighton hove albion"
};
export function canonicalTeamName(name){
 const cleaned=normalize(name);
 return aliases[cleaned]||cleaned;
}
export function canonicalFixtureKey({league,home,away,date}){
 const h=canonicalTeamName(typeof home==="string"?home:home?.name);
 const a=canonicalTeamName(typeof away==="string"?away:away?.name);
 const day=String(date||"").slice(0,10);
 return String(league||"")+"|"+day+"|"+h+"|"+a;
}
