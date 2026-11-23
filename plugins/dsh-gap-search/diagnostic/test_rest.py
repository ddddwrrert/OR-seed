import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rest
import scales


def grid(kind: str) -> str:
    if kind == "ahc002":
        rows = ["0 0"]
        rows += [" ".join(["0"] * 50) for _ in range(50)]
        rows += [" ".join(["1"] * 50) for _ in range(50)]
        return "\n".join(rows)
    if kind == "ahc007":
        return "\n".join(f"{index} {index}" for index in range(4))
    if kind == "ahc010":
        return "012\n210"
    if kind == "ahc021":
        return "2\n0 1"
    raise KeyError(kind)


SAMPLES = {
    "ahc001": "2\n0 0 10\n1 1 30\n",
    "ahc002": grid("ahc002"),
    "ahc003": "1 2 4 6\n",
    "ahc004": "20 2\nAB\nCDEF\n",
    "ahc005": "3 0 0\n..#\n#..\n...\n",
    "ahc006": "0 0 3 4\n",
    "ahc007": grid("ahc007"),
    "ahc009": "0 0 1 1 0.2\n010\n",
    "ahc010": grid("ahc010"),
    "ahc012": "4 2\n1 1 1 1 1 1 1 1 1 1\n0 0\n",
    "ahc014": "10 4\n0 0\n",
    "ahc017": "8 10 3 2\n1 2 5\n",
    "ahc019": "5\n10001\n",
    "ahc020": "20 30 5\n0 0\n",
    "ahc021": grid("ahc021"),
    "ahc028": "6 3\n0 1\nABCDEF\n",
    "ahc030": "10 2 0.01\n1 0 0\n",
    "ahc031": "100 4 3\n1 2 3\n",
    "ahc032": "4 2 3\n1 2 3 4\n",
    "ahc033": "4\n1 2 3 4\n",
    "ahc034": "2\n1 -2\n3 0\n",
    "ahc035": "3 2 4\n1 2\n",
    "ahc038": "4 3 2\n0000\n",
    "ahc040": "2 3 10\n5 7\n2 9\n",
    "ahc041": "3 2 4\n1 2 3\n0 1\n",
    "ahc042": "3\nxo.\n.x.\no.x\n",
    "ahc044": "4 10\n1 2 3 8\n",
    "ahc045": "5 2 3 3 10\n3 2\n",
    "future-contest-2022-qual": "6 2 3 4\n1 1 1\n",
    "toyota2023summer-final": "8 2\n1 1\n",
}


class RestTest(unittest.TestCase):
    def test_every_other_problem_has_a_ruler_and_input_quantities(self):
        self.assertEqual(len(rest.REST), len(SAMPLES))
        for problem_id, sample in SAMPLES.items():
            features = scales.features_of(problem_id, sample)
            public = {key: value for key, value in features.items() if not str(key).startswith("_")}
            self.assertTrue(public, problem_id)
            mode, ceiling, lower, loose = scales.ruler_of(problem_id, rest.rest_features(problem_id, sample), None, 0)
            self.assertIn(mode, ("maximize", "minimize"), problem_id)
            self.assertGreater(ceiling if mode == "maximize" else 1, 0, problem_id)
            self.assertGreaterEqual(lower, 0, problem_id)
            self.assertIn(problem_id, scales.TIME_LIMITS)
            self.assertIsInstance(loose, bool)

    def test_known_ceilings(self):
        self.assertEqual(scales.ruler_of("ahc001", {}, None, 0)[1], 1e9)
        self.assertEqual(scales.ruler_of("ahc003", {}, None, 0)[1], 999999910.0)
        self.assertEqual(scales.ruler_of("ahc012", {}, None, 0)[1], 1e6)
        self.assertEqual(scales.ruler_of("ahc031", {}, None, 0)[1], 1.0)
        features = rest.rest_features("ahc002", SAMPLES["ahc002"])
        self.assertEqual(scales.ruler_of("ahc002", features, None, 0)[1], 2500.0)
        features = rest.rest_features("ahc041", SAMPLES["ahc041"])
        self.assertEqual(scales.ruler_of("ahc041", features, None, 0)[1], 1 + 5 * 6)
        self.assertTrue(scales.ruler_of("ahc017", {}, None, 0)[3])
        self.assertTrue(scales.ruler_of("ahc032", rest.rest_features("ahc032", SAMPLES["ahc032"]), None, 0)[3])

    def test_profile_hides_the_ruler_scratch_and_keeps_the_raw_score(self):
        class Case:
            absolute_score = 10
            judge_result = type("Judge", (), {"value": "ACCEPTED"})()
            execution_time = 0.2
            input_str = SAMPLES["ahc001"]

        class Result:
            case_results = [Case()]

        profile = scales.build_seed_profile("ahc001", Result(), None)
        self.assertEqual(profile["rows"][0]["M"], 1e9)
        self.assertNotIn("_ceiling", profile["rows"][0]["features"])
        self.assertEqual(profile["time_limit"], 5.0)
        self.assertFalse(profile["loose_ruler"])


if __name__ == "__main__":
    unittest.main()
