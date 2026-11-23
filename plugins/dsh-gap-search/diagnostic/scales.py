"""Per-seed ruler. M comes from the statement, or from a frozen reference file.

The program being edited does not supply M. q and gap are stored beside the raw
score. The official mean still sums the raw scores.
"""

from __future__ import annotations

import json
from pathlib import Path
from statistics import median

from rest import REST, public_features, rest_features, rest_ruler

Q_CLAIMED = 0.95
GAP_EPS = 1e-6
UNUSED_FRACTION = 0.30
EXHAUSTED_FRACTION = 0.85

TIME_LIMITS = {
    "ahc008": 3.0,
    "ahc011": 3.0,
    "ahc015": 2.0,
    "ahc016": 5.0,
    "ahc024": 2.0,
    "ahc025": 2.0,
    "ahc026": 2.0,
    "ahc027": 2.0,
    "ahc039": 2.0,
    "ahc046": 2.0,
    **{problem_id: spec[1] for problem_id, spec in REST.items()},
}

# Quantities the program can read. A quantity fixed by another one is absent:
# ahc011's T is 2 N^3, so only board is kept from that pair.
SIZE_KEYS = {
    "pets", "board", "items", "companies", "tiles", "strings", "berries",
    "vertices", "residents", "days", "pieces", "people", "cities", "tasks", "side",
}


def judge_name(case) -> str:
    judge = getattr(case, "judge_result", "")
    return str(getattr(judge, "value", judge))


def load_reference(task_dir):
    if task_dir is None:
        return None
    path = Path(task_dir) / "reference_scores.json"
    if not path.is_file():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    scores = data["scores"] if isinstance(data, dict) else data
    if len(scores) != 50:
        raise ValueError("reference_scores.json needs 50 frozen scores")
    return [float(score) for score in scores]


def _lines(text: str) -> list[str]:
    return [line.strip() for line in str(text).splitlines() if line.strip() != ""]


def _bits(value: int) -> int:
    return bin(value).count("1")


def features_of(problem_id: str, text: str) -> dict:
    if problem_id in REST:
        return rest_features(problem_id, text)
    lines = _lines(text)
    if not lines:
        return {}
    if problem_id == "ahc008":
        pets = int(lines[0])
        humans = int(lines[1 + pets])
        return {"pets": pets, "humans": humans}
    if problem_id == "ahc011":
        board = int(lines[0].split()[0])
        cells = 0
        bits = 0
        for row in lines[1:1 + board]:
            for char in row.split()[0] if " " in row else row:
                cells += 1
                bits += _bits(int(char, 16))
        return {"board": board, "tile_density": (bits / cells) if cells else 0.0}
    if problem_id == "ahc015":
        values = [int(piece) for piece in lines[0].split()]
        counts = [values.count(flavor) for flavor in (1, 2, 3)]
        skew = (max(counts) - min(counts)) / len(values) if values else 0.0
        return {"flavor_skew": skew}
    if problem_id == "ahc016":
        graphs, noise = lines[0].split()[:2]
        return {"graphs": float(graphs), "noise": float(noise)}
    if problem_id == "ahc024":
        board = int(lines[0].split()[0])
        colors = []
        for row in lines[1:1 + board]:
            colors.extend(int(piece) for piece in row.split())
        largest = max((colors.count(color) for color in set(colors)), default=0)
        return {"board": board, "max_color": largest}
    if problem_id == "ahc025":
        items, divisions, queries = (int(piece) for piece in lines[0].split()[:3])
        return {"items": items, "divisions": divisions, "queries": queries}
    if problem_id == "ahc026":
        stacks = int(lines[0].split()[1])
        blocked = 0
        for row in lines[1:1 + stacks]:
            boxes = [int(piece) for piece in row.split()]
            if boxes and min(boxes) != boxes[-1]:
                blocked += 1
        return {"blocked": blocked}
    if problem_id == "ahc027":
        board = int(lines[0])
        walls = lines[1:board] + lines[board:board + board]
        dirt_rows = lines[board + board:board + board + board]
        wall_hits = sum(row.count("1") for row in walls)
        wall_len = sum(len(row) for row in walls)
        dirt = [int(piece) for row in dirt_rows for piece in row.split()]
        mean = sum(dirt) / len(dirt) if dirt else 0.0
        variance = sum((piece - mean) ** 2 for piece in dirt) / len(dirt) if dirt else 0.0
        return {
            "board": board,
            "walls": (wall_hits / wall_len) if wall_len else 0.0,
            "dirt_skew": (variance ** 0.5 / mean) if mean else 0.0,
        }
    if problem_id == "ahc039":
        board = int(lines[0])
        points = [tuple(float(piece) for piece in row.split()[:2]) for row in lines[1:1 + 2 * board]]
        left, right = points[:board], points[board:2 * board]

        def center(group):
            return (
                sum(point[0] for point in group) / len(group),
                sum(point[1] for point in group) / len(group),
            )

        a, b = center(left), center(right)
        separation = ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
        return {"board": board, "separation": separation}
    if problem_id == "ahc046":
        board, points_n = (int(piece) for piece in lines[0].split()[:2])
        points = [tuple(int(piece) for piece in row.split()[:2]) for row in lines[1:1 + points_n]]
        if not points:
            span = 0.0
        else:
            origin = points[0]
            span = sum(max(abs(point[0] - origin[0]), abs(point[1] - origin[1])) for point in points) / len(points)
        return {"board": board, "points": points_n, "span": span}
    return {}


def ruler_of(problem_id: str, features: dict, reference, seed: int):
    """Return mode, lower-or-ceiling used as the stored M, lower, loose."""
    if problem_id in REST:
        return rest_ruler(problem_id, features)
    if problem_id == "ahc027":
        if reference is not None:
            frozen = float(reference[seed])
            return "minimize", frozen, frozen, False
        return "minimize", 0.0, 0.0, True
    if problem_id == "ahc025":
        return "minimize", 1.0, 1.0, False
    if problem_id == "ahc008":
        return "maximize", 1e8, 0.0, False
    if problem_id in ("ahc011", "ahc015"):
        return "maximize", 1e6, 0.0, False
    if problem_id == "ahc016":
        return "maximize", float(round(1e9 / 4)), 0.0, False
    if problem_id == "ahc024":
        board = float(features.get("board", 50))
        return "maximize", board * board + 1.0, 0.0, False
    if problem_id == "ahc026":
        return "maximize", 10000.0, 0.0, False
    if problem_id == "ahc039":
        board = float(features.get("board", 5000))
        return "maximize", board + 1.0, 0.0, False
    if problem_id == "ahc046":
        board = float(features.get("board", 20))
        points_n = float(features.get("points", 40))
        return "maximize", points_n + 2.0 * board * points_n, 0.0, False
    raise ValueError(f"no ruler for {problem_id}")


def measure(mode: str, raw: float, accepted: bool, ceiling: float, lower: float):
    """Return M, q, gap, scale. A failed seed keeps q at 0 and keeps its gap."""
    raw = float(raw)
    if mode == "maximize":
        ruler = float(ceiling)
        scale = ruler if ruler > 0 else 1.0
        if not accepted:
            return ruler, 0.0, ruler if ruler > 0 else 1.0, scale
        gap = max(0.0, ruler - raw)
        quote = (raw / ruler) if ruler > 0 else 0.0
        return ruler, quote, gap, scale
    bound = float(lower)
    scale = max(raw, bound, 1.0)
    if not accepted:
        return bound, 0.0, max(raw - bound, 1.0), scale
    gap = max(0.0, raw - bound)
    if raw <= bound or raw <= 0:
        quote = 1.0
    elif bound > 0:
        quote = bound / raw
    else:
        quote = 0.0
    return bound, quote, gap, scale


def failure_of(accepted: bool, judge: str, quote: float, gap: float, time_fraction: float):
    if not accepted:
        if judge == "TIME_LIMIT_EXCEEDED":
            return "time_exhausted"
        return "invalid"
    if quote >= Q_CLAIMED or gap <= GAP_EPS:
        return None
    if judge == "TIME_LIMIT_EXCEEDED" or time_fraction > EXHAUSTED_FRACTION:
        return "time_exhausted"
    if time_fraction < UNUSED_FRACTION:
        return "unused_time"
    return "search_stuck"


def build_seed_profile(problem_id: str, public_result, task_dir=None) -> dict:
    reference = load_reference(task_dir) if problem_id == "ahc027" else None
    loose = False
    rows = []
    for seed, case in enumerate(public_result.case_results):
        text = case.input_str
        if isinstance(text, bytes):
            text = text.decode("utf-8", "replace")
        try:
            features = features_of(problem_id, text or "")
        except (ValueError, IndexError, TypeError):
            features = {}
        mode, ceiling, lower, row_loose = ruler_of(problem_id, features, reference, seed)
        loose = loose or row_loose
        features = public_features(features)
        judge = judge_name(case)
        accepted = judge == "ACCEPTED"
        raw = float(case.absolute_score)
        ruler, quote, gap, scale = measure(mode, raw, accepted, ceiling, lower)
        limit = TIME_LIMITS[problem_id]
        elapsed = float(case.execution_time)
        rows.append({
            "seed": seed,
            "raw": raw,
            "judge": judge,
            "execution_time": elapsed,
            "features": features,
            "M": ruler,
            "q": quote,
            "gap": gap,
            "scale": scale,
            "failure": failure_of(accepted, judge, quote, gap, elapsed / limit if limit else 0.0),
            "accepted": accepted,
        })
    return {
        "problem_id": problem_id,
        "time_limit": TIME_LIMITS[problem_id],
        "loose_ruler": loose,
        "reference_used": reference is not None,
        "rows": rows,
    }


def show_number(value):
    number = float(value)
    if number.is_integer():
        return int(number)
    return round(number, 6)


def cuts_of(rows: list[dict]) -> dict:
    """Discretize each input quantity that actually varies. Constants are dropped."""
    keys = sorted(key for row in rows for key in row.get("features", {}) if not str(key).startswith("_"))
    cuts = {}
    for key in keys:
        values = [row["features"][key] for row in rows if key in row.get("features", {})]
        distinct = sorted(set(values))
        if len(distinct) < 2:
            continue
        center = show_number(median(values))
        if len(distinct) <= 4:
            cuts[key] = {"kind": "raw", "median": center}
        else:
            cuts[key] = {"kind": "median", "threshold": center, "median": center}
    return cuts


def level_of(value, cut):
    if cut["kind"] == "raw":
        shown = show_number(value)
        return "eq", "==", shown
    threshold = cut["threshold"]
    if float(value) <= float(threshold):
        return "lo", "<=", threshold
    return "hi", ">", threshold
