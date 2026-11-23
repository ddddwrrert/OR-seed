"""Group seeds by input features and one failure. The writing class maximizes total gap.

Claimed seeds (q near 1, or a gap of 0) stay out of every class. They are the guard set.
A class needs at least 3 seeds. Feature subsets that split a class below 3 are not used
when a coarser subset still holds the gap.
"""

from __future__ import annotations

import json
import sys

from scales import GAP_EPS, SIZE_KEYS, cuts_of, level_of

MIN_CLASS = 3


def _size_level(described):
    for feature in described:
        if not feature["size"]:
            continue
        if feature["level"] == "lo":
            return "lo"
        if feature["level"] == "hi":
            return "hi"
        median = feature["median"]
        return "lo" if float(feature["threshold"]) <= float(median) else "hi"
    return None


def choose(rows: list[dict]) -> dict:
    cuts = cuts_of(rows)
    keys = list(cuts)
    writable = [row for row in rows if row.get("failure")]
    guard = [row["seed"] for row in rows if not row.get("failure")]
    found = {}
    for mask in range(1 << len(keys)):
        use = [keys[index] for index in range(len(keys)) if mask & (1 << index)]
        buckets: dict[str, dict] = {}
        for row in writable:
            if any(key not in row.get("features", {}) for key in use):
                continue
            described = []
            parts = [row["failure"]]
            for key in use:
                level, op, threshold = level_of(row["features"][key], cuts[key])
                parts.append(f"{key}{op}{threshold}")
                described.append({
                    "key": key,
                    "token": key,
                    "level": level,
                    "op": op,
                    "threshold": threshold,
                    "size": key in SIZE_KEYS,
                    "median": cuts[key]["median"],
                })
            signature = "|".join(parts)
            bucket = buckets.get(signature)
            if bucket is None:
                buckets[signature] = {
                    "id": signature,
                    "failure": row["failure"],
                    "gap": 0.0,
                    "seeds": [],
                    "features": described,
                }
                bucket = buckets[signature]
            bucket["seeds"].append(row["seed"])
            bucket["gap"] += float(row["gap"])
        for bucket in buckets.values():
            if len(bucket["seeds"]) < MIN_CLASS or bucket["gap"] <= GAP_EPS:
                continue
            bucket["seeds"].sort()
            bucket["size_level"] = _size_level(bucket["features"])
            found[bucket["id"]] = bucket
    by_failure = {}
    for bucket in found.values():
        by_failure.setdefault(bucket["failure"], []).append(bucket)
    pool = []
    for buckets in by_failure.values():
        featured = [bucket for bucket in buckets if bucket["features"]]
        pool.extend(featured or buckets)
    bins = sorted(pool, key=lambda item: (-item["gap"], -len(item["seeds"]), -len(item["features"]), item["id"]))
    return {"bins": bins, "guard": guard}


def main() -> None:
    sys.stdin.reconfigure(encoding="utf-8")
    payload = json.load(sys.stdin)
    json.dump(choose(payload["rows"]), sys.stdout)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
