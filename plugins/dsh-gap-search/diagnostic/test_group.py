import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import group


def row(seed, failure, features, gap=10, quote=0.2):
    return {
        "seed": seed,
        "failure": failure,
        "features": features,
        "gap": gap,
        "q": quote,
    }


class GroupTest(unittest.TestCase):
    def test_picks_the_largest_total_gap_with_one_failure(self):
        rows = [row(i, "search_stuck", {"pets": 20}, gap=9) for i in range(6)]
        rows += [row(i, "unused_time", {"pets": 10}, gap=1) for i in range(6, 12)]
        rows += [row(i, None, {"pets": 10}, gap=0, quote=1) for i in range(12, 20)]
        chosen = group.choose(rows)["bins"][0]
        self.assertEqual(chosen["failure"], "search_stuck")
        self.assertEqual(chosen["seeds"], [0, 1, 2, 3, 4, 5])
        self.assertEqual(chosen["gap"], 54)
        self.assertNotEqual(chosen["features"], [])
        self.assertIn(12, group.choose(rows)["guard"])

    def test_a_split_below_three_keeps_the_coarser_class(self):
        rows = []
        for seed in range(4):
            rows.append(row(seed, "search_stuck", {"pets": seed % 2, "humans": seed // 2}, gap=10))
        bins = group.choose(rows)["bins"]
        self.assertEqual(len(bins), 1)
        self.assertEqual(bins[0]["features"], [])
        self.assertEqual(bins[0]["seeds"], [0, 1, 2, 3])

    def test_two_seeds_are_not_a_class(self):
        rows = [row(i, "invalid", {"blocked": 1}, gap=50) for i in range(2)]
        rows += [row(i, None, {"blocked": 0}, gap=0, quote=1) for i in range(2, 8)]
        self.assertEqual(group.choose(rows)["bins"], [])

    def test_a_constant_quantity_does_not_open_a_bin(self):
        rows = [row(i, "unused_time", {"board": 8, "pets": 10 + (i % 2)}, gap=4) for i in range(6)]
        chosen = group.choose(rows)["bins"][0]
        self.assertTrue(all(feature["key"] != "board" for feature in chosen["features"]))


if __name__ == "__main__":
    unittest.main()
