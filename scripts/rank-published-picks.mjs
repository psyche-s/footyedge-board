// Keep FootyEdge's published Top 3, card #1, and Top 5 in agreement.
// Mutates only the supplied unpublished/current owner-authorized board object.
// Odds, reasons, EV and probabilities stay attached to their exact selections.
export function rankPublishedBoard(board, { minimumTop5Confidence = 85 } = {}) {
  const valid = p => p && typeof p.score === "number" &&
    Number.isFinite(p.score) && p.score >= 0 && p.score <= 100;
  const ordered = picks => picks.map((pick, originalIndex) => ({pick, originalIndex}))
    .sort((a, b) => {
      const score = b.pick.score - a.pick.score;
      if (score !== 0) return score;
      // Tie breaks only: a real line is preferable, then larger EV.
      const book = Number(Boolean(b.pick.verifiedPrice)) - Number(Boolean(a.pick.verifiedPrice));
      if (book !== 0) return book;
      if (a.pick.verifiedPrice && b.pick.verifiedPrice) {
        const aEv = typeof a.pick.ev === "number" ? a.pick.ev : -Infinity;
        const bEv = typeof b.pick.ev === "number" ? b.pick.ev : -Infinity;
        if (aEv !== bEv) return bEv - aEv;
      }
      return a.originalIndex - b.originalIndex;
    }).map(x => x.pick);
  let correctedMatches = 0;
  for (const game of board.games || []) {
    if (!Array.isArray(game.top3) || game.top3.length !== 3 || !game.top3.every(valid)) {
      throw Error("Cannot rank picks without three valid confidence ratings for "+game.id);
    }
    const sorted = ordered(game.top3);
    if (sorted.some((p,i) => p.label !== game.top3[i].label)) correctedMatches++;
    game.top3 = sorted;
    game.top = sorted[0];
    game.model = {...game.model, top:sorted[0], top3:sorted,
      candidates:sorted, rankedCandidates:sorted, researchCandidates:sorted};
  }
  const ranked = [...(board.games || [])].sort((a,b) =>
    b.top3[0].score-a.top3[0].score ||
    Number(Boolean(b.top3[0].verifiedPrice))-Number(Boolean(a.top3[0].verifiedPrice)) ||
    (b.top3[0].ev ?? -Infinity)-(a.top3[0].ev ?? -Infinity) ||
    String(a.id).localeCompare(String(b.id)));
  const qualified=ranked.filter(g=>g.top3[0].score>=minimumTop5Confidence);
  const refs = games => games.slice(0,5).map((g,i)=>({
    rank:i+1,gameId:String(g.id),home:g.home,away:g.away,
    pick:JSON.parse(JSON.stringify(g.top3[0]))
  }));
  board.top5=refs(qualified);
  board.leagueTop5=Object.fromEntries([...new Set((board.games||[]).map(g=>g.league))]
    .map(l=>[l,refs(qualified.filter(g=>g.league===l))]));
  board.editorialTop5Order=board.top5.map(x=>x.gameId);
  board.sourceQuality={...board.sourceQuality,rankedTop3Descending:true,
    rankingRule:"descending confidence; verified odds and EV only break ties",
    globalTop5Rule:"highest-ranked selection per match, minimum 85%; no fabricated odds",
    rankingCorrectionMatches:Math.max(Number(board.sourceQuality?.rankingCorrectionMatches)||0,correctedMatches)};
  return {correctedMatches, globalTop5:board.top5.length};
}
