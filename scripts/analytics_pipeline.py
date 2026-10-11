#!/usr/bin/env python3
"""FootyEdge multi-source scouting shadow ETL. Never edits frozen picks."""
import argparse,csv,datetime as dt,io,json,re,sqlite3,urllib.request,unicodedata
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/".cache"/"footyedge"
LEAGUES={"eng.1":"E0","eng.2":"E1","esp.1":"SP1","ita.1":"I1","ger.1":"D1","fra.1":"F1","ned.1":"N1","por.1":"P1","tur.1":"T1"}
ALIAS={"fc cologne":"koln","cologne":"koln","borussia monchengladbach":"m gladbach","ac milan":"milan","as roma":"roma","celta vigo":"celta","stade rennais":"rennes","aj auxerre":"auxerre","sc freiburg":"freiburg"}
def normalize(s):
    raw=unicodedata.normalize("NFKD",str(s or "")).encode("ascii","ignore").decode().lower()
    v=" ".join(re.findall(r"[a-z0-9]+",raw))
    return ALIAS.get(v,v)
def n(v):
    try: return float(v) if str(v).strip()!="" else None
    except (TypeError,ValueError):return None
def calendar(s):
    for f in ("%d/%m/%Y","%d/%m/%y","%Y-%m-%d"):
        try:return dt.datetime.strptime(s,f).date()
        except (ValueError,TypeError):pass
    return None
def create(conn):
    conn.executescript("""CREATE TABLE IF NOT EXISTS matches(
      league TEXT,date TEXT,home TEXT,away TEXT,hg INTEGER,ag INTEGER,
      hs REAL,ats REAL,hst REAL,ast REAL,hf REAL,af REAL,hc REAL,ac REAL,
      source TEXT,PRIMARY KEY(league,date,home,away,source));
      CREATE TABLE IF NOT EXISTS shots(
      provider TEXT,match_id TEXT,shot_id TEXT,player TEXT,x REAL,y REAL,xg REAL,
      PRIMARY KEY(provider,match_id,shot_id));
      CREATE TABLE IF NOT EXISTS players(provider TEXT,id TEXT,name TEXT,team TEXT,
      PRIMARY KEY(provider,id));""")
def source_csv(season,div,offline=False):
    CACHE.mkdir(parents=True,exist_ok=True)
    f=CACHE/(season+"-"+div+".csv")
    if not offline and (not f.exists() or dt.datetime.now().timestamp()-f.stat().st_mtime>86400):
        try:
            url="https://www.football-data.co.uk/mmz4281/"+season+"/"+div+".csv"
            req=urllib.request.Request(url,headers={"User-Agent":"FootyEdge research/1.0"})
            with urllib.request.urlopen(req,timeout=12) as resp:data=resp.read(2_000_000)
            if b"HomeTeam" not in data[:1000]:raise ValueError("missing header")
            f.write_bytes(data)
        except (OSError,ValueError) as err:
            print("Source unavailable:",season,div,type(err).__name__)
    if not f.exists():return []
    return list(csv.DictReader(io.StringIO(f.read_text(encoding="utf-8-sig",errors="replace"))))
def ingest(conn,league,rows,before):
    count=0
    for r in rows:
        date=calendar(r.get("Date"));hg=n(r.get("FTHG"));ag=n(r.get("FTAG"))
        if not date or date>=before or hg is None or ag is None or hg<0 or ag<0 or not r.get("HomeTeam") or not r.get("AwayTeam"):continue
        conn.execute("INSERT OR REPLACE INTO matches VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(
          league,date.isoformat(),normalize(r["HomeTeam"]),normalize(r["AwayTeam"]),int(hg),int(ag),
          n(r.get("HS")),n(r.get("AS")),n(r.get("HST")),n(r.get("AST")),
          n(r.get("HF")),n(r.get("AF")),n(r.get("HC")),n(r.get("AC")),"football-data.co.uk"))
        count+=1
    return count
def summary(conn,league,team,before):
    k=normalize(team)
    rs=conn.execute("SELECT * FROM matches WHERE league=? AND date<? AND (home=? OR away=?) ORDER BY date DESC LIMIT 10",(league,before,k,k)).fetchall()
    if len(rs)<3:return None
    games=[]
    for r in rs:
        home=r["home"]==k
        gf,ga=(r["hg"],r["ag"]) if home else (r["ag"],r["hg"])
        games.append({"date":r["date"],"venue":"home" if home else "away","gf":gf,"ga":ga,"result":"W" if gf>ga else "L" if gf<ga else "D",
          "shots":r["hs"] if home else r["ats"],"shotsOnTarget":r["hst"] if home else r["ast"],"fouls":r["hf"] if home else r["af"],"corners":r["hc"] if home else r["ac"]})
    def avg(k):
        vs=[x[k] for x in games if x[k] is not None]
        return round(sum(vs)/len(vs),2) if len(vs)>=3 else None
    def rate(f):return {"hits":sum(bool(f(x)) for x in games),"sample":len(games)}
    return {"source":"football-data.co.uk","sample":len(games),"lastFive":games[:5],
      "form":" ".join(x["result"] for x in games[:5]),
      "goalsForAvg":avg("gf"),"goalsAgainstAvg":avg("ga"),
      "shotsAvg":avg("shots"),"shotsOnTargetAvg":avg("shotsOnTarget"),
      "foulsAvg":avg("fouls"),"cornersAvg":avg("corners"),
      "over15":rate(lambda x:x["gf"]+x["ga"]>=2),
      "over25":rate(lambda x:x["gf"]+x["ga"]>=3),
      "under35":rate(lambda x:x["gf"]+x["ga"]<=3),
      "btts":rate(lambda x:x["gf"]>0 and x["ga"]>0),
      "xgFor":None,"xgAgainst":None,"ppda":None,"fieldTilt":None}
def run(day,offline=False):
    baseline=ROOT/"data"/("research-base-"+day.isoformat()+".json")
    if not baseline.exists():raise RuntimeError("Dated verified research missing; no synthesized fixtures")
    base=json.loads(baseline.read_text())
    CACHE.mkdir(parents=True,exist_ok=True)
    conn=sqlite3.connect(CACHE/"analytics.sqlite");conn.row_factory=sqlite3.Row;create(conn)
    start=day.year if day.month>=7 else day.year-1
    seasons=[f"{y%100:02d}{(y+1)%100:02d}" for y in (start-1,start)]
    health={}
    for league,div in LEAGUES.items():
        total=0
        for season in seasons:total+=ingest(conn,league,source_csv(season,div,offline),day)
        health[league]={"provider":"football-data.co.uk","rows":total,"available":total>0}
    conn.commit()
    fixtures=[]
    for f in base.get("fixtures",[]):
        l=f.get("league")
        if l not in LEAGUES:continue
        home=summary(conn,l,f["home"]["name"],f["date"][:10])
        away=summary(conn,l,f["away"]["name"],f["date"][:10])
        fixtures.append({"fixtureId":str(f["id"]),"league":l,
          "home":f["home"]["name"],"away":f["away"]["name"],
          "homeStats":home,"awayStats":away,"verifiedJoin":bool(home and away),
          "source":"football-data.co.uk"})
    out={"schema":1,"date":day.isoformat(),"generatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
       "mode":"shadow-only","providers":health,"matches":fixtures,
       "notes":"Null for unverified xG, missing shots or unavailable teams; not sportsbook prices or calibrated predictions"}
    target=ROOT/"data"/"analytics"/(day.isoformat()+".json");target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n")
    conn.close()
    print("SCOUTING",len(fixtures),"fixtures",sum(bool(x["verifiedJoin"]) for x in fixtures),"exactly joined")
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--date",required=True);p.add_argument("--offline",action="store_true")
    a=p.parse_args();run(dt.date.fromisoformat(a.date),a.offline)
