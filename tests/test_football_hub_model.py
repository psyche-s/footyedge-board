from __future__ import annotations
import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from shadow_dixon_coles import load_hub_league_data

class VerifiedMirrorTests(unittest.TestCase):
    def test_mirror_ignores_future_and_unscored(self):
        with tempfile.TemporaryDirectory() as dirname:
            root=Path(dirname)
            (root/"data"/"football-hub").mkdir(parents=True)
            doc={"schema":"footyedge-history-v1","license":"CC0-1.0","competition":"eng.1","games":[
                {"id":"a","d":"2026-10-05","h":"Arsenal FC","a":"Chelsea FC","hs":2,"as":1},
                {"id":"b","d":"2026-10-14","h":"Chelsea FC","a":"Arsenal FC","hs":5,"as":0},
                {"id":"c","d":"2026-10-10","h":"Liverpool FC","a":"Aston Villa","hs":None,"as":1},
            ]}
            p=root/"data"/"football-hub"/"eng.1.json"
            p.write_text(json.dumps(doc))
            rows,urls=load_hub_league_data(root,"eng.1",date(2026,10,14))
            self.assertEqual(len(rows),1)
            self.assertEqual(rows[0]["hg"],2)
            self.assertEqual(rows[0]["date"].isoformat(),"2026-10-05")
            self.assertEqual(len(urls),1)
    def test_never_accept_unknown_license_or_league(self):
        with tempfile.TemporaryDirectory() as dirname:
            root=Path(dirname)
            (root/"data"/"football-hub").mkdir(parents=True)
            p=root/"data"/"football-hub"/"eng.1.json"
            p.write_text(json.dumps({"schema":"footyedge-history-v1","license":"unknown",
            "competition":"eng.1","games":[{"id":"x","d":"2026-10-01","h":"Arsenal","a":"Chelsea","hs":2,"as":2}]}))
            self.assertEqual(load_hub_league_data(root,"eng.1",date(2026,10,14)),([],[]))
            self.assertEqual(load_hub_league_data(root,"eng.2",date(2026,10,14)),([],[]))
if __name__=="__main__":
    unittest.main()
