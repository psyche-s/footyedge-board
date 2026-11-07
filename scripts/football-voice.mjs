/** Short, grounded match reasoning for research display only.
 * No unverified tactical claims, publisher votes, odds or model probabilities.
 * Never changes picks, markets, rankings, confidence or frozen archives.
 */
export function naturalFootballReason({label,home,away,homeHits,homeSample,awayHits,awaySample,raw="",variationKey=""}={}){
  const text=x=>String(x??"").trim();
  const name=text(label),h=text(home),a=text(away);
  const hh=Number(homeHits),hn=Number(homeSample),ah=Number(awayHits),an=Number(awaySample);
  const supported=[hh,hn,ah,an].every(Number.isInteger)&&hn>=5&&an>=5&&hh>=0&&ah>=0&&hh<=hn&&ah<=an;
  if(!supported||!h||!a||!name)return text(raw);
  const possess=x=>/s$/i.test(x)?x+"'":x+"'s";
  let hash=0;for(const ch of String(variationKey||h+"|"+a)+"|"+name)hash=(hash*31+ch.charCodeAt(0))>>>0;
  const variant=hash%3, r=(x,n)=>x+" of "+n;
  const signal=(x,n)=>x/n>=.6, bothStrong=signal(hh,hn)&&signal(ah,an);
  if(name===h+" or Draw"||name===a+" or Draw"){
    const isHome=name===h+" or Draw",team=isHome?h:a,opp=isHome?a:h;
    const unbeaten=hh,played=hn,opponentNoWins=ah,oppPlayed=an,opponentWins=an-ah;
    const oppForm=opponentWins<=oppPlayed*.4?"won just "+opponentWins:"won "+opponentWins;
    if(variant===0)return team+" have avoided defeat in "+r(unbeaten,played)+", while "+opp+" have "+oppForm+" of their last "+oppPlayed+". I'd rather have the draw covered than need an outright win.";
    if(variant===1)return opp+" have "+oppForm+" of their last "+oppPlayed+"; "+team+" have lost "+(played-unbeaten)+" of "+played+". The double chance fits that form better than an outright call.";
    return team+" have "+((played-unbeaten)<=played*.4?"lost only ":"lost ")+(played-unbeaten)+" of "+played+" recently, and "+opp+" have "+oppForm+" of "+oppPlayed+". Covering the draw makes sense here.";
  }
  if(name===h+" ML"||name===a+" ML"){
    const isHome=name===h+" ML",team=isHome?h:a,opp=isHome?a:h;
    const ownWins=hh,ownN=hn,oppLosses=ah,oppN=an; // ML review counts are selection-side wins, then opponent losses for both home and away.
    if(variant===0)return team+" have won "+r(ownWins,ownN)+"; "+opp+" have lost "+r(oppLosses,oppN)+". That points towards "+team+", with the draw still the main risk.";
    if(variant===1)return "The recent results lean "+team+"'s way: "+ownWins+" wins in "+ownN+", compared with "+oppLosses+" defeats in "+opp+"'s last "+oppN+". A win is the call, not a guarantee.";
    return team+" come in with "+ownWins+" wins from "+ownN+", while "+opp+" have been beaten "+oppLosses+" times in "+oppN+". There's a case for the straight win, though the draw can spoil it.";
  }
  const total=name.match(/^(Over|Under) (\d+(?:\.\d+)?) Goals$/i);
  if(total){
    const side=total[1].toLowerCase(),line=Number(total[2]),threshold=Math.floor(line)+1,under=side==="under";
    const result=r(hh,hn)+" for "+h+" and "+r(ah,an)+" for "+a;
    if(under){
      if(!bothStrong)return h+" have stayed under "+line+" goals in "+r(hh,hn)+", compared with "+r(ah,an)+" for "+a+". One side's results make this less comfortable than the line suggests.";
      if(variant===0)return h+" have stayed below "+threshold+" total goals in "+r(hh,hn)+" matches, and "+a+" in "+r(ah,an)+". Recent results back the under.";
      if(variant===1)return "Games involving "+h+" and "+a+" have stayed under "+line+" goals "+hh+"/"+hn+" and "+ah+"/"+an+" times. Neither has been reaching that higher total often.";
      return "The under "+line+" has landed "+result+". It's a cautious totals pick, and the recent scores give it a fair basis.";
    }
    if(!bothStrong)return h+" have cleared "+line+" goals in "+r(hh,hn)+" matches; "+a+" have done so in "+r(ah,an)+". The scoring trend is stronger on one side, so this isn't a free hit.";
    if(variant===0)return "At least "+threshold+" goals landed in "+r(hh,hn)+" "+h+" games and "+r(ah,an)+" "+a+" games. Both teams' recent results give the over a case.";
    if(variant===1)return h+" have gone over "+line+" in "+r(hh,hn)+", while "+a+" have done it in "+r(ah,an)+". The match doesn't need a particular winner, just goals.";
    return "The over "+line+" has hit "+hh+"/"+hn+" for "+h+" and "+ah+"/"+an+" for "+a+". There's scoring form behind the line, without needing to pick the winner.";
  }
  if(/^BTTS (Yes|No)$/i.test(name)){
    const yes=/Yes$/i.test(name);
    if(yes){
      if(variant===0)return "Both teams scored in "+hh+" of "+possess(h)+" last "+hn+" games and "+ah+" of "+possess(a)+" last "+an+". Both sides have been involved in games with goals at each end.";
      if(variant===1)return h+" have seen both sides score "+hh+" times in "+hn+"; "+a+" have seen it "+ah+" times in "+an+". The BTTS angle comes from both teams' match trends.";
      return "BTTS has landed "+hh+"/"+hn+" for "+h+" and "+ah+"/"+an+" for "+a+". Either attack drawing a blank is the obvious risk.";
    }
    if(variant===0)return "At least one side failed to score in "+hh+" of "+possess(h)+" last "+hn+" games and "+ah+" of "+possess(a)+" last "+an+". That's the case against BTTS.";
    if(variant===1)return "At least one team drew a blank in "+hh+"/"+hn+" "+h+" matches and "+ah+"/"+an+" "+a+" matches. One blank is enough for this pick.";
    return "A goal at both ends hasn't been the norm: no BTTS in "+hh+"/"+hn+" "+h+" matches and "+ah+"/"+an+" "+a+" matches.";
  }
  const teamGoal=name.match(/^(.*?) (1\+ Goal|2\+ Goals|Under 1\.5 Goals)$/i);
  if(teamGoal){
    const team=teamGoal[1],kind=teamGoal[2],isHome=team===h;
    if(!isHome&&team!==a)return text(raw);
    const own=isHome?hh:ah,ownN=isHome?hn:an,oppAllow=isHome?ah:hh,oppN=isHome?an:hn,opp=isHome?a:h;
    const first=kind.startsWith("1+"),two=kind.startsWith("2+");
    if(first){
      if(own/ownN<.5&&oppAllow/oppN>=.6)return team+" have scored in only "+r(own,ownN)+", so their own form is patchy. But "+opp+" have conceded in "+r(oppAllow,oppN)+", which gives the one-goal pick a case.";
      if(variant===0)return team+" have scored in "+r(own,ownN)+", and "+opp+" have conceded in "+r(oppAllow,oppN)+". One goal is the ask; they don't have to win.";
      if(variant===1)return opp+" have conceded in "+r(oppAllow,oppN)+" recently. With "+team+" scoring in "+r(own,ownN)+", backing them for one looks more sensible than needing the result.";
      return team+" have found the net "+own+" times in their last "+ownN+", while "+opp+" have let one in "+oppAllow+" times in "+oppN+". The one-goal line keeps the ask modest.";
    }
    if(two){
      if(variant===0)return team+" have scored twice or more in "+r(own,ownN)+"; "+opp+" have conceded two or more in "+r(oppAllow,oppN)+". This needs more than a narrow 1-0.";
      if(variant===1)return "The two-goal case rests on "+own+" recent multi-goal games for "+team+" and "+oppAllow+" where "+opp+" conceded at least twice. It's the riskier scoring line.";
      return team+" have reached two goals "+own+" times in "+ownN+" games, and "+opp+" have allowed two "+oppAllow+" times in "+oppN+". That's the matchup case for 2+.";
    }
    if(variant===0)return team+" have scored no more than once in "+r(own,ownN)+"; "+opp+" have allowed at most one in "+r(oppAllow,oppN)+". This is a bet against a big scoring night.";
    if(variant===1)return team+" have scored one or fewer in "+own+"/"+ownN+" recent matches. "+opp+" have kept opponents to one or fewer in "+oppAllow+"/"+oppN+".";
    return team+" have stayed below two goals in "+r(own,ownN)+", and "+opp+" have kept opponents there in "+r(oppAllow,oppN)+". That supports the team under.";
  }
  return text(raw);
}
