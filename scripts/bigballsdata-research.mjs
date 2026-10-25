#!/usr/bin/env node
/**
 * Optional EPL corroboration from Big Balls Sports Data.
 *
 * Raw provider responses are runner-private in .cache/footyedge only.
 * The public research file receives ONLY derived fixture-corroboration flags,
 * never the provider's raw fields, match IDs, scores, lineups or feed.
 * This is supplemental evidence, not a pick generator or a live scoreboard.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const getTorontoDate = (now = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
export const canonicalTeam = name => String(name || "")
  .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\b(?:afc|fc)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const isoDate = x => /^\d{4}-\d{2}-\d{2}$/.test(x);
const timestamp = x => { const v = Date.parse(x); return Number.isFinite(v) ? v : null; };
const safeString = x => typeof x === "string" && x.length <= 160;

export async function collectEpl({ client, date, checkedAt = new Date().toISOString() }) {
  if (!isoDate(date)) throw Error("Bad research date");
  // Use the documented official SDK method; 'football', not 'soccer'.
  const response = await client.matches.list({
    sport: "football", league: "epl", date, limit: 100
  });
  if (!Array.isArray(response?.data)) throw Error("Invalid BigBallsData match envelope");
  const fixtures = response.data.flatMap(row => {
    const kick = timestamp(row?.kickoff_utc);
    if (!safeString(row?.home?.name) || !safeString(row?.away?.name) || kick === null)
      return [];
    // No mixing past/future games into another day's research.
    if (new Date(kick).toISOString().slice(0, 10) !== date) return [];
    return [{
      home: row.home.name, away: row.away.name,
      kickoff_utc: row.kickoff_utc,
      // Never interpret missing fields as zero or as official confirmation.
      status: typeof row.status === "string" ? row.status : null
    }];
  });
  return {
    schema: "footyedge-private-bigballsdata-epl-v1", date, checkedAt,
    providerMeta: {
      source: typeof response.meta?.source === "string" ? response.meta.source : null,
      cached: typeof response.meta?.cached === "boolean" ? response.meta.cached : null,
      // API quality confidence is NOT betting-pick confidence.
      qualityConfidence: Number.isFinite(response.meta?.confidence)
        ? response.meta.confidence : null
    },
    fixtures
  };
}

export function corroborateResearch(research, evidence) {
  if (research?.date !== evidence?.date ||
      evidence?.schema !== "footyedge-private-bigballsdata-epl-v1" ||
      !Array.isArray(research?.fixtures) || !Array.isArray(evidence?.fixtures)) {
    throw Error("Date-matched verified research and provider snapshot required");
  }
  let matched = 0, considered = 0;
  const fixtures = research.fixtures.map(f => {
    if (f.league !== "eng.1" || !f.home?.name || !f.away?.name) return f;
    considered++;
    const kick = timestamp(f.date);
    if (kick === null) return f;
    const candidates = evidence.fixtures.filter(v =>
      canonicalTeam(v.home) === canonicalTeam(f.home.name) &&
      canonicalTeam(v.away) === canonicalTeam(f.away.name) &&
      timestamp(v.kickoff_utc) !== null &&
      Math.abs(timestamp(v.kickoff_utc) - kick) <= 60 * 60 * 1000
    );
    // Require exactly one unambiguous matching provider row.
    if (candidates.length !== 1) return f;
    matched++;
    return {
      ...f,
      providerCorroboration: {
        ...(f.providerCorroboration || {}),
        bigballsdata: {
          matched: true, checkedAt: evidence.checkedAt,
          mode: "independent-fixture-identity-only",
          notAStartingXIOrPickProbability: true
        }
      }
    };
  });
  return {
    ...research, fixtures,
    providerCrosschecks: {
      ...(research.providerCrosschecks || {}),
      bigballsdata: {
        checkedAt: evidence.checkedAt, league: "eng.1", considered, matched,
        sourceType: evidence.providerMeta.source,
        cached: evidence.providerMeta.cached,
        rawDataRetainedInPublicBoard: false
      }
    }
  };
}

async function main() {
  const key = process.env.BBS_API_KEY;
  if (!key) { console.log("BigBallsData not configured: unchanged research."); return; }
  const date = process.env.RESEARCH_DATE || getTorontoDate();
  if (!isoDate(date)) throw Error("Invalid research date");
  const researchFile = path.join("data", "research-base-" + date + ".json");
  const research = JSON.parse(await fs.readFile(researchFile, "utf8"));
  if (research.date !== date) throw Error("Research date mismatch");
  // Import SDK only on configured executions, so ordinary local tests need no key.
  const { BigBallSportsClient } = await import("@bigballsdata/sdk");
  const evidence = await collectEpl({client: new BigBallSportsClient(key), date});
  const tempDir = path.join(".cache", "footyedge");
  await fs.mkdir(tempDir, {recursive: true});
  // Ephemeral runner-only evidence; NOT git added and NOT publicly deployed.
  await fs.writeFile(path.join(tempDir, "bigballsdata-epl-" + date + ".json"),
    JSON.stringify(evidence) + "\n", {mode: 0o600});
  const updated = corroborateResearch(research, evidence);
  if (updated.providerCrosschecks.bigballsdata.matched > 0) {
    await fs.writeFile(researchFile, JSON.stringify(updated, null, 2) + "\n");
  }
  console.log(JSON.stringify({
    league: "eng.1", date,
    considered: updated.providerCrosschecks.bigballsdata.considered,
    fixtureIdentitiesMatched: updated.providerCrosschecks.bigballsdata.matched,
    publicRawFeed: false
  }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => { console.error("BigBallsData corroboration unavailable:", error.message); process.exitCode = 1; });
