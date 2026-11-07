#!/usr/bin/env node
/**
 * Dated multi-site Top 3 display overlay (not historical settlement).
 * Inputs: fixture-matched explicitly recommended markets + independent winner
 * opinions + already verified recent match history. Never invent an editorial
 * opinion or reinterpret a preview statistic as a published tip.
 * Safe even after the original daily archive has frozen.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
const allowed={
 football_whispers:"footballwhispers.com",
 forebet:"forebet.com",
 statz:"statz.ai",
 eagleeyeodds:"eagleeyeodds.com",
 the_analyst:"theanalyst.com",
 windrawwin:"windrawwin.com",
 sports_mole:"sportsmole.co.uk"
};
const norm=x=>String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const read=async f=>fs.readFile(f,"utf8").then(JSON.parse).catch(e=>{if(e.code==="ENOENT")return null;throw e;});
const hostOk=(url,source)=>{try{const u=new URL(url),host=u.hostname.toLowerCase(),domain=allowed[source];return u.protocol==="https:"&&!!domain&&(host===domain||host.endsWith("."+domain))}catch{return false}};
const definitions={
 home_win:["result","Match Result"],away_win:["result","Match Result"],draw:["result","Match Result"],
 home_or_draw:["result","Double Chance"],away_or_draw:["result","Double Chance"],
 over_1_5:["total","Goals"],over_2_5:["total","Goals"],over_3_5:["total","Goals"],over_4_5:["total","Goals"],
 under_2_5:["to¶»§q«^