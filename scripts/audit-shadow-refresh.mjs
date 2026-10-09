/**
 * Advisory 06:00 publication-readiness audit for the independent Dixon-Coles
 * shadow file. Never blocks publication or alters a pick or model forecast.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function torontoDate(value = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto",
      year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(value).map(x => [x.type, x.value])
  );
  return parts.year + "-" + parts.month + "-" + parts.day;
}

export function auditShadow(payload, targetDate) {
  const base = { date: targetDate, useForPublishedPicks: false, informationalOnly: true };
  if (!payload) return { ...base, status: "missing", note: "No archived shadow forecast yet" };
  if (typeof payload !== "object" || Array.isArray(payload))
    return { ...base, status: "invalid", note: "Shadow payload is not an object" };
  const c = payload.coverage;
  const invalid = note => ({ ...base, status: "invalid", note });
  if (payload.date !== targetDate || payload.mode !== "shadow_only" ||
      payload.promotedToPicks !== false)
    return invalid("Incorrect date or shadow-only publication boundary");
  const asOf = new Date(payload.asOf);
  if (!Number.isFinite(asOf.getTime()) || torontoDate(asOf) !== targetDate)
    return invalid("Forecast as-of date is missing or outside Toronto fixture day");
  if (!Array.isArray(payload.fixtures) || !c ||
      !Number.isInteger(c.inputFixtures) || !Number.isInteger(c.eligibleLeagueFixtures) ||
      !Number.isInteger(c.predicted) || c.inputFixtures < 0 ||
      c.eligibleLeagueFixtures < 0 || c.predicted < 0 ||
      c.eligibleLeagueFixtures > c.inputFixtures || c.predicted > c.eligibleLeagueFixtures)
    return invalid("Invalid fixture or numeric coverage fields");
  const ids = new Set();
  let counted = 0;
  for (const fixture of payload.fixtures) {
    const id = String(fixture?.fixtureId ?? "");
    if (!id || ids.has(id)) return invalid("Missing/duplicate fixture ID");
    ids.add(id);
    if (fixture.status === "shadow_prediction") {
      counted++;
      const kickoff = new Date(fixture.kickoff);
      if (!Number.isFinite(kickoff.getTime()) || kickoff <= asOf)
        return invalid("In-play or invalid pre-match forecast timestamp");
      if (!fixture.probabilities || typeof fixture.probabilities !== "object" ||
          Object.values(fixture.probabilities).some(v => !Number.isFinite(v) || v < 0 || v > 1))
        return invalid("Missing/invalid forecast probability");
    }
  }
  if (counted !== c.predicted || payload.fixtures.length !== c.eligibleLeagueFixtures)
    return invalid("Declared forecast coverage differs from fixture records");
  const status = c.eligibleLeagueFixtures === 0 ? "no_supported_fixtures"
    : c.predicted === c.eligibleLeagueFixtures ? "ready"
    : c.predicted ? "partial" : "no_forecasts";
  return {
    ...base, status, modelVersion: String(payload.modelVersion || "unknown"),
    asOf: payload.asOf, inputFixtures: c.inputFixtures,
    eligibleLeagueFixtures: c.eligibleLeagueFixtures, predicted: c.predicted,
    skipped: c.eligibleLeagueFixtures - c.predicted,
    note: "Experimental forecasts are not calibrated and do not affect official picks",
  };
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    if (["--date", "--ref", "--file"].includes(argv[i])) {
      if (!argv[i + 1]) throw new Error("Missing argument for " + argv[i]);
      options[argv[i].slice(2)] = argv[++i];
    } else throw new Error("Unknown argument: " + argv[i]);
  }
  if (options.ref && options.file) throw new Error("Choose --ref OR --file");
  return options;
}

function readPayload(options, date) {
  const location = "data/model-shadow/" + date + ".json";
  try {
    const raw = options.ref
      ? execFileSync("git", ["show", options.ref + ":" + location], {
          encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10000 })
      : fs.readFileSync(options.file || location, "utf8");
    return { payload: JSON.parse(raw), source: options.ref || options.file || "checkout" };
  } catch (error) {
    const message = String(error?.message || error).slice(0, 180);
    return { payload: null, source: options.ref || options.file || "checkout", error: message };
  }
}

function writeSummary(report) {
  const count = report.predicted === undefined ? "n/a" :
    report.predicted + "/" + report.eligibleLeagueFixtures;
  console.log("[FootyEdge model readiness] date=" + report.date +
    " status=" + report.status + " forecast_coverage=" + count +
    " model=" + (report.modelVersion || "unavailable"));
  if (report.note) console.log("Model note: " + report.note);
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const lines = [
    "### Dixon-Coles shadow data — morning readiness",
    "",
    "| Attribute | Status |", "|---|---|",
    "| Toronto date | " + report.date + " |",
    "| Data availability | " + report.status + " |",
    "| Model version | " + (report.modelVersion || "Unavailable") + " |",
    "| Eligible league forecasts | " + count + " |",
    "| Forecast as-of | " + (report.asOf || "Unavailable") + " |",
    "| Official Top 3 / Top 5 impact | **None — shadow only** |",
    "",
    "A missing or partial experimental model never blocks today's official board.",
    "",
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n"), "utf8");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const day = options.date || torontoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid date");
  const data = readPayload(options, day);
  const report = auditShadow(data.payload, day);
  report.source = data.source;
  if (data.error) report.note += "; read: " + data.error;
  writeSummary(report);
  // This is an advisory: never fail the official board because of an
  // experimental model, missing sources, or GitHub schedule delays.
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) {
    console.error("[FootyEdge model readiness] non-blocking audit warning:", String(error));
    process.exitCode = 0;
  }
}
