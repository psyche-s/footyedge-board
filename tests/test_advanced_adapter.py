import pathlib,unittest,importlib.util
file=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"advanced_adapter.py"
spec=importlib.util.spec_from_file_location("adv",file)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Advanced(unittest.TestCase):
 def test_statsbomb_shot_filtering(self):
  rows=[{"id":"s1","type":"Shot","location":[105,40],"shot_statsbomb_xg":0.22,"player":"X"},
        {"id":"p2","type":"Pass","location":[15,10],"shot_statsbomb_xg":None},
        {"id":"s3","type":"Shot","location":[105,40],"shot_statsbomb_xg":None}]
  shots=m.normalize_shots(rows,"statsbomb","123")
  self.assertEqual(len(shots),1)
  self.assertEqual(shots[0][6],0.22)
 def test_understat_verified_xg_only(self):
  rows=[{"id":"1","location_x":0.4,"location_y":0.2,"xg":0.15},
        {"id":"2","location_x":0.3,"location_y":0.1,"xg":None}]
  self.assertEqual(len(m.normalize_shots(rows,"understat","abc")),1)
 def test_no_fabricated_xg(self):
  self.assertIsNone(m.real(float("nan")))
  self.assertEqual(m.normalize_shots([{"type":"Shot","location":[1,2],"shot_statsbomb_xg":5}],"statsbomb","1"),[])
