// FootyEdge Original: one-ledger simulation aggregation. No inferred telemetry.
// Every derivative is counted from the same event ledger; no independent market model.
export function summarizeEventLedger(matches, {seed=null,coverage={}}={}) {
 if (!Array.isArray(matches)||matches.length!==10000) throw Error("Exactly 10000 simulated matches required");
 const counts=new Map(), matrix=Array.from({length:11},()=>Array(11).fill(0));
 let hsum=0,asum=0,home=0,draw=0,away=0,btts=0,o15=0,o25=0,o35=0;
 for(const m of matches){
  const h=m.homeGoals,a=m.awayGoals;
  if(!Number.isSafeInteger(h)||!Number.isSafeInteger(a)||h<0||a<0)throw Error("Invalid simulated goals");
  hsum+=h;asum+=a;home+=+(h>a);draw+=+(h===a);away+=+(h<a);
  btts+=+(h>0&&a>0);o15+=+(h+a>=2);o25+=+(h+a>=3);o35+=+(h+a>=4);
  matrix[Math.min(h,10)][Math.min(a,10)]++;
  const key=`${h}-${a}`;counts.set(key,(counts.get(key)||0)+1);
 }
 const pct=n=>n/100; // 10000 trials => exact hundredths of a percent
 const mode=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
 const hg=hsum/10000,ag=asum/10000;
 if(home+draw+away!==10000||o35+(10000-o35)!==10000)throw Error("Ledger incoherent");
 return {
  meta:{simulation_count:10000,model_status:"uncalibrated experimental research blend",seed,evidence_coverage:coverage,score_matrix_overflow:"index 10 means 10+ goals"},
  score_projection:{most_likely_score:mode[0],mode_probability_percentage:pct(mode[1]),projected_goals:{home_team:hg,away_team:ag}},
  match_outcome_probabilities:{home_win:pct(home),draw:pct(draw),away_win:pct(away)},
  double_chance:{home_or_draw:pct(home+draw),away_or_draw:pct(away+draw)},
  market_derivatives:{both_teams_to_score:pct(btts),over_1_5:pct(o15),over_2_5:pct(o25),over_3_5:pct(o35),under_3_5:pct(10000-o35)},
  match_totals:{combined_projected_goals:(hsum+asum)/10000},
  score_matrix_10x10_plus_overflow:matrix
 };
}
