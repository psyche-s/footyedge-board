import type { LeagueId } from "./types";
export const theme = {
  name: "Foot Edge Cyber Minimal",
  background: "#09090b",
  surface: "rgba(24,24,27,0.4)",
  border: "#27272a",
  accent: "#34d399",
  text: "#fafafa",
  muted: "#a1a1aa"
};
export const leagueStyles: Record<LeagueId, {name: string; primary: string; accent: string}> = {
  EPL: {name: "English Premier League", primary: "#3d195b", accent: "#00ff87"},
  LaLiga: {name: "La Liga", primary: "#000000", accent: "#ef4444"},
  SerieA: {name: "Serie A", primary: "#002f6c", accent: "#0093cc"},
  Bundesliga: {name: "Bundesliga", primary: "#d3010c", accent: "#ffffff"},
  Ligue1: {name: "French Ligue 1", primary: "#dae025", accent: "#111827"},
  SuperLig: {name: "Turkish Süper Lig", primary: "#ff3b00", accent: "#002a54"},
  Eredivisie: {name: "Dutch Eredivisie", primary: "#1a365d", accent: "#f6ad55"},
  PrimeiraLiga: {name: "Portuguese Primeira Liga", primary: "#004b23", accent: "#fbc02d"},
  Championship: {name: "EFL Championship", primary: "#211854", accent: "#93c5fd"},
  Saudi: {name: "Saudi Pro League", primary: "#17462e", accent: "#86efac"},
  J1: {name: "J1 League", primary: "#b91c1c", accent: "#fca5a5"},
  K1: {name: "K League 1", primary: "#1e40af", accent: "#60a5fa"},
  Other: {name: "Other competitions", primary: "#27272a", accent: "#a1a1aa"}
};
