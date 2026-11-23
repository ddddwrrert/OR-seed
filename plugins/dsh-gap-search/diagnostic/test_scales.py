import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import scales


class Case:
    def __init__(self, raw, judge, elapsed, text):
        self.absolute_score = raw
        self.judge_result = type("Judge", (), {"value": judge})()
        self.execution_time = elapsed
        self.input_str = text


class Result:
    def __init__(self, cases):
        self.case_results = cases


class ScalesTest(unittest.TestCase):
    def test_maximize_separates_a_small_ruler_from_a_miss(self):
        ruler, quote, gap, scale = scales.measure("maximize", 1e8, True, 1e8, 0)
        self.assertEqual(quote, 1)
        self.assertEqual(gap, 0)
        ruler, quote, gap, scale = scales.measure("maximize", 0, True, 1e8, 0)
        self.assertEqual(quote, 0)
        self.assertEqual(gap, 1e8)
        self.assertEqual(scale, 1e8)

    def test_a_failed_seed_keeps_q_at_zero_and_the_whole_gap(self):
        ruler, quote, gap, scale = scales.measure("maximize", 0, False, 1e6, 0)
        self.assertEqual((ruler, quote, gap), (1e6, 0.0, 1e6))

    def test_minimize_gap_is_raw_minus_lower_bound(self):
        ruler, quote, gap, scale = scales.measure("minimize", 101, True, 1, 1)
        self.assertEqual(gap, 100)
        self.assertAlmostEqual(quote, 1 / 101)
        self.assertEqual(scale, 101)
        ruler, quote, gap, scale = scales.measure("minimize", 1, True, 1, 1)
        self.assertEqual((quote, gap), (1.0, 0.0))

    def test_statement_rulers(self):
        self.assertEqual(scales.ruler_of("ahc008", {}, None, 0)[1], 1e8)
        self.assertEqual(scales.ruler_of("ahc011", {}, None, 0)[1], 1e6)
        self.assertEqual(scales.ruler_of("ahc015", {}, None, 0)[1], 1e6)
        self.assertEqual(scales.ruler_of("ahc016", {}, None, 0)[1], round(1e9 / 4))
        self.assertEqual(scales.ruler_of("ahc024", {"board": 50}, None, 0)[1], 50 * 50 + 1)
        self.assertEqual(scales.ruler_of("ahc026", {}, None, 0)[1], 10000)
        self.assertEqual(scales.ruler_of("ahc039", {"board": 5000}, None, 0)[1], 5001)
        self.assertEqual(scales.ruler_of("ahc046", {"board": 20, "points": 40}, None, 0)[1], 40 + 2 * 20 * 40)
        mode, ruler, lower, loose = scales.ruler_of("ahc025", {}, None, 0)
        self.assertEqual((mode, lower, loose), ("minimize", 1.0, False))

    def test_ahc027_uses_a_frozen_file_and_otherwise_stays_loose(self):
        mode, ruler, lower, loose = scales.ruler_of("ahc027", {}, None, 0)
        self.assertTrue(loose)
        self.assertEqual(lower, 0)
        mode, ruler, lower, loose = scales.ruler_of("ahc027", {}, [5] * 50, 3)
        self.assertFalse(loose)
        self.assertEqual(lower, 5)

    def test_features_come_from_the_input_and_skip_a_determined_quantity(self):
        pets = scales.features_of("ahc008", "2\n1 1 1\n2 2 2\n3\n4 4\n5 5\n6 6\n")
        self.assertEqual(pets, {"pets": 2, "humans": 3})
        tiles = scales.features_of("ahc011", "2 16\n1f\n00\n")
        self.assertEqual(tiles["board"], 2)
        self.assertNotIn("T", tiles)
        self.assertGreater(tiles["tile_density"], 0)
        flavors = scales.features_of("ahc015", "1 1 1 2 3 3\n")
        self.assertIn("flavor_skew", flavors)
        graphs = scales.features_of("ahc016", "40 0.12\n")
        self.assertEqual(graphs, {"graphs": 40.0, "noise": 0.12})
        blocked = scales.features_of("ahc026", "4 2\n1 2\n4 3\n")
        self.assertEqual(blocked["blocked"], 1)
        balance = scales.features_of("ahc025", "40 4 200\n9 9 9\n")
        self.assertEqual(balance, {"items": 40, "divisions": 4, "queries": 200})

    def test_profile_keeps_all_fifty_rows(self):
        text = "10\n" + "\n".join("1 1 1" for _ in range(10)) + "\n5\n" + "\n".join("2 2" for _ in range(5)) + "\n"
        cases = [Case(100, "ACCEPTED", 0.1, text) for _ in range(50)]
        profile = scales.build_seed_profile("ahc008", Result(cases), None)
        self.assertEqual(len(profile["rows"]), 50)
        self.assertEqual(profile["rows"][0]["M"], 1e8)
        self.assertFalse(profile["loose_ruler"])
        self.assertFalse(profile["reference_used"])

    def test_official_score_still_prefers_combined_score(self):
        path = Path(__file__).resolve().parents[2] / "dsh-evolve-loop" / "src" / "providers" / "run_evaluator.py"
        import importlib.util
        spec = importlib.util.spec_from_file_location("run_evaluator", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        metrics = {
            "combined_score": 3.5,
            "overall_score": 100,
            "seed_time_limit": 2,
            "seed_profile": {"rows": [{"raw": 1}]},
        }
        self.assertEqual(module.get_score(metrics), 3.5)


if __name__ == "__main__":
    unittest.main()
