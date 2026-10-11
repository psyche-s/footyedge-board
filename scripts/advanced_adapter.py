#!/usr/bin/env python3
"""Optional, source-limited event research. Not a live betting feed.

Only explicitly requested open-data match IDs are ingested. Never infer an
upcoming fixture's identity from a team name or use unrestricted scraping.
Install via requirements-advanced.txt before manual use.
"""
from __future__ import annotations
import argparse,datetime as dt,importlib,json,math,pathlib,sqlite3,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from analytics_pipeline import create

def real(value):
    try:
        n=float(value)
        return n if math.isfinite(n) else None
    except (ValueError,TypeError):return None

def normalize_shots(rows,provider,match_id):
    results=[]
    for i,r in enumerate(rows):
        if provider=="statsbomb":
            if str(r.get("type","")).lower()!="shot":continue
            xy=r.get("location")
            if not isinstance(xy,(list,tuple)) or len(xy)<2:continue
            x,y=real(xy[0]),real(xy[1])
            xg=real(r.get("shot_statsbomb_xg"))
            player=r.get("player")
            ident=r.get("id")
        else:
            x,y=real(r.get("location_x",r.get("x"))),real(r.get("location_y",r.get("y")))
            xg=real(r.get("xg",r.get("xG")))
            player=r.get("player")
            ident=r.get("shot_id",r.get("id"))
        if xg is None or xg<0 or xg>1 or x is None or y is None:continue
        if not ident:ident=str(i)
        results.append((provider,str(match_id),str(ident),str(player or ""),x,y,xg))
    return results

def read(provider,match_id,league=None,season=None,competition_id=None,season_id=None):
    if provider=="statsbomb":
        if competition_id is None or season_id is None:
            raise ValueError("Open competition and season IDs required to verify StatsBomb coverage")
        from statsbombpy import sb
        available=sb.matches(competition_id=int(competition_id),season_id=int(season_id))
        if int(match_id) not in set(int(x) for x in available["match_id"].tolist()):
            raise ValueError("Selected match is not verified in this open competition and season")
        return sb.events(match_id=int(match_id)).to_dict("records")
    if provider=="understat":
        if not league or not season:raise ValueError("Understat league and season are required")
        from soccerdata import Understat
        client=Understat(leagues=league,seasons=season)
        data=client.read_shot_events(match_id=int(match_id))
        return data.reset_index().to_dict("records")
    raise ValueError("Only an audited provider is permitted")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--provider",choices=["statsbomb","understat"],required=True)
    p.add_argument("--match-id",required=True)
    p.add_argument("--league");p.add_argument("--season")
    p.add_argument("--competition-id",type=int);p.add_argument("--season-id",type=int)
    args=p.parse_args()
    source=read(args.provider,args.match_id,args.league,args.season,args.competition_id,args.season_id)
    shots=normalize_shots(source,args.provider,args.match_id)
    if not shots:raise SystemExit("No verified shot events; refuse to write empty xG as zero")
    db=ROOT/".cache"/"footyedge"/"analytics.sqlite";db.parent.mkdir(parents=True,exist_ok=True)
    conn=sqlite3.connect(db);create(conn)
    conn.executemany("INSERT OR REPLACE INTO shots VALUES (?,?,?,?,?,?,?)",shots)
    conn.commit();conn.close()
    print(json.dumps({"provider":args.provider,"matchId":str(args.match_id),
      "verifiedShots":len(shots),"cachedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
      "destination":"local SQLite research cache only","promotedToCurrentMatchPredictions":False}))
if __name__=="__main__":main()
