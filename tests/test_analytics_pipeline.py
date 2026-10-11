import unittest,sqlite3,datetime as dt,importlib.util,pathlib
spec=importlib.util.spec_from_file_location("scout",pathlib.Path(__file__).resolve().parents[1]/"scripts"/"analytics_pipeline.py")
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
class Scouting(unittest.TestCase):
 def setUp(self):self.c=sqlite3.connect(":memory:");self.c.row_factory=sqlite3.Row;p.create(self.c)
 def tearDown(self):self.c.close()
 def test_complete_and_prior_only(self):
  rows=[{"Date":"10/10/2026","HomeTeam":"AC Milan","AwayTeam":"Roma","FTHG":"2","FTAG":"1","HST":"7"},
        {"Date":"11/10/2026","HomeTeam":"AC Milan","AwayTeam":"Roma","FTHG":"3","FTAG":"0"},
        {"Date":"09/10/2026","HomeTeam":"AC Milan","AwayTeam":"Roma","FTHG":"","FTAG":""}]
  self.assertEqual(p.ingest(self.c,"ita.1",rows,dt.date(2026,10,11)),1)
  self.assertEqual(self.c.execute("SELECT count(*) FROM matches").fetchone()[0],1)
 def test_cannot_invent_xg_or_shots(self):
  for i in range(3):
   day=f"{i+1:02d}/10/2026"
   p.ingest(self.c,"eng.1",[{"Date":day,"HomeTeam":"Arsenal","AwayTeam":"Chelsea","FTHG":"1","FTAG":"0"}],dt.date(2026,10,11))
  x=p.summary(self.c,"eng.1","Arsenal","2026-10-11")
  self.assertIsNone(x["xgFor"]);self.assertIsNone(x["shotsAvg"])
  self.assertEqual(x["over25"],{"hits":0,"sample":3})
 def test_curated_club_alias(self):self.assertEqual(p.normalize("FC Cologne"),"koln")
