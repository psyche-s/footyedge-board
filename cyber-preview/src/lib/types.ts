export type LeagueId =
  | "EPL" | "LaLiga" | "SerieA" | "Bundesliga" | "Ligue1"
  | "SuperLig" | "Eredivisie" | "PrimeiraLiga" | "Championship"
  | "Saudi" | "J1" | "K1" | "Other";

export interface TeamInfo {
  name: string;
  color: string;
  form: string[];
  goalsFor?: number | null;
  goalsAgainst?: number | null;
  shotsFor?: number | null;
  shotsAgainst?: number | null;
}

export interface ValueProjection {
  metric: string;
  line: number;
  projected: number;
  edge: number | null;
  asOf?: string;
  provider?: string;
}

export interface SGPResult {
  legs: {label: string; confidence?: number | null; reason?: string}[];
  totalOdds?: string | null;
  confidence?: number | null;
  verified?: boolean;
}

export interface PlayerVector {
  id: string;
  name: string;
  number: number;
  role: string;
  xT: number | null;
  recoveries: number | null;
  foulsCommitted: number | null;
  shotsOnTarget: number | null;
  positionGrid: {top: string; left: string};
}
export interface LineupData {
  teamName: string;
  accentColor: string;
  formation: string;
  confirmed: boolean;
  sourceLabel?: string;
  players: PlayerVector[];
}

export interface MatchData {
  id: string;
  league: LeagueId;
  leagueName: string;
  kickoff: string;
  status: "scheduled" | "live" | "final";
  minute?: number | null;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  score?: {home: number | null; away: number | null};
  rating?: number | null; // Research strength, NOT probability
  homeXG?: number | null;
  awayXG?: number | null;
  projectedShots?: ValueProjection | null;
  sgp?: SGPResult | null;
  h2h?: {date: string; home: string; away: string; score: string}[];
  analysis?: {label: string; reason?: string; confidence?: number | null}[];
  lineup?: LineupData | null;
  source?: string;
}

export interface DashboardData {
  generatedAt: string;
  date: string;
  source: string;
  matches: MatchData[];
}
