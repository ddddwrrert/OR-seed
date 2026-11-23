"""Rulers and input quantities for the ALE-Bench problems outside the original ten.

A key that starts with ``_`` is only there so the ruler can be computed. It is not a bin.
``loose`` means the statement bound does not separate a small ruler from a real miss.
"""

from __future__ import annotations


def _lines(text: str) -> list[str]:
    return [line.strip() for line in str(text).splitlines() if line.strip() != ""]


def _nums(line: str) -> list[float]:
    return [float(piece) for piece in line.split()]


def _skew(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    if mean == 0:
        return 0.0
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return variance ** 0.5 / mean


def _ahc001(text: str) -> dict:
    rows = _lines(text)
    count = int(rows[0])
    areas = [float(rows[index].split()[2]) for index in range(1, 1 + count)]
    return {"companies": count, "area_skew": _skew(areas)}


def _ahc002(text: str) -> dict:
    rows = _lines(text)
    tiles = [int(piece) for row in rows[1:51] for piece in row.split()]
    values = [float(piece) for row in rows[51:101] for piece in row.split()]
    return {"tiles": len(set(tiles)), "value_skew": _skew(values), "_ceiling": sum(values)}


def _ahc003(text: str) -> dict:
    spans = []
    for row in _lines(text):
        parts = row.split()
        if len(parts) in (4, 6) and all(_is_int(part) for part in parts[:4]):
            si, sj, ti, tj = (int(part) for part in parts[:4])
            spans.append(abs(ti - si) + abs(tj - sj))
    if not spans:
        return {}
    return {"span": sum(spans) / len(spans)}


def _is_int(part: str) -> bool:
    return part.lstrip("-").isdigit()


def _ahc004(text: str) -> dict:
    rows = _lines(text)
    board, count = (int(piece) for piece in rows[0].split()[:2])
    lengths = [len(rows[index]) for index in range(1, 1 + count)]
    return {"board": board, "strings": count, "length_mean": (sum(lengths) / len(lengths)) if lengths else 0.0}


def _ahc005(text: str) -> dict:
    rows = _lines(text)
    board = int(rows[0].split()[0])
    body = "".join(rows[1:1 + board])
    obstacles = body.count("#") / len(body) if body else 0.0
    return {"board": board, "obstacles": obstacles, "_ceiling": 10000 + 10000000 * board}


def _ahc006(text: str) -> dict:
    trips = []
    for row in _lines(text):
        a, b, c, d = (float(piece) for piece in row.split()[:4])
        trips.append(abs(c - a) + abs(d - b))
    return {"trip_mean": (sum(trips) / len(trips)) if trips else 0.0}


def _ahc007(text: str) -> dict:
    points = []
    for row in _lines(text)[:400]:
        parts = row.split()
        if len(parts) < 2:
            break
        points.append((float(parts[0]), float(parts[1])))
    if not points:
        return {}
    cx = sum(point[0] for point in points) / len(points)
    cy = sum(point[1] for point in points) / len(points)
    spread = sum(((point[0] - cx) ** 2 + (point[1] - cy) ** 2) ** 0.5 for point in points) / len(points)
    return {"spread": spread}


def _ahc009(text: str) -> dict:
    rows = _lines(text)
    noise = float(rows[0].split()[4])
    walls = "".join(rows[1:])
    return {"noise": noise, "walls": walls.count("1") / len(walls) if walls else 0.0}


def _ahc010(text: str) -> dict:
    body = "".join(_lines(text))
    return {"kinds": len(set(body))}


def _ahc012(text: str) -> dict:
    rows = _lines(text)
    berries, cuts = (int(piece) for piece in rows[0].split()[:2])
    targets = [float(piece) for piece in rows[1].split()]
    return {"berries": berries, "cuts": cuts, "target_skew": _skew(targets)}


def _ahc014(text: str) -> dict:
    board, dots = (int(piece) for piece in _lines(text)[0].split()[:2])
    ceiling = round(1e6 * board * board / dots) if dots else 1e6
    return {"board": board, "dots": dots, "_ceiling": ceiling}


def _ahc017(text: str) -> dict:
    vertices, edges, days, per_day = (int(piece) for piece in _lines(text)[0].split()[:4])
    return {"vertices": vertices, "edges": edges, "days": days, "per_day": per_day}


def _ahc019(text: str) -> dict:
    return {"depth": int(_lines(text)[0])}


def _ahc020(text: str) -> dict:
    residents, links, required = (int(piece) for piece in _lines(text)[0].replace("\\", " ").split()[:3])
    return {"residents": residents, "links": links, "required": required}


def _ahc021(text: str) -> dict:
    rows = []
    for line in _lines(text):
        rows.append([int(piece) for piece in line.split()])
    inversions = 0
    flat = [value for row in rows for value in row]
    for left in range(len(flat)):
        for right in range(left + 1, len(flat)):
            if flat[left] > flat[right]:
                inversions += 1
    return {"disorder": inversions}


def _ahc028(text: str) -> dict:
    board, words = (int(piece) for piece in _lines(text)[0].split()[:2])
    return {"board": board, "words": words}


def _ahc030(text: str) -> dict:
    board, probes, noise = _lines(text)[0].split()[:3]
    board_n = int(board)
    return {
        "board": board_n,
        "probes": int(probes),
        "noise": float(noise),
        "_lower": float(round(1e6 / board_n)) if board_n else 1.0,
    }


def _ahc031(text: str) -> dict:
    width, days, rooms = (int(piece) for piece in _lines(text)[0].split()[:3])
    return {"width": width, "days": days, "rooms": rooms}


def _ahc032(text: str) -> dict:
    board, stamps, budget = (int(piece) for piece in _lines(text)[0].split()[:3])
    return {"board": board, "stamps": stamps, "budget": budget, "_ceiling": board * board * (998244353 - 1)}


def _ahc033(text: str) -> dict:
    return {"board": int(_lines(text)[0])}


def _ahc034(text: str) -> dict:
    rows = _lines(text)
    board = int(rows[0])
    relief = 0.0
    for row in rows[1:1 + board]:
        relief += sum(abs(float(piece)) for piece in row.split())
    return {"board": board, "relief": relief}


def _ahc035(text: str) -> dict:
    board, traits, rounds = (int(piece) for piece in _lines(text)[0].split()[:3])
    return {"board": board, "traits": traits, "rounds": rounds}


def _ahc038(text: str) -> dict:
    board, pieces, arms = (int(piece) for piece in _lines(text)[0].split()[:3])
    return {"board": board, "pieces": pieces, "arms": arms}


def _ahc040(text: str) -> dict:
    rows = _lines(text)
    items, turns, sigma = rows[0].split()[:3]
    sides = []
    for row in rows[1:1 + int(items)]:
        width, height = (float(piece) for piece in row.split()[:2])
        sides.append(width + height)
    return {"items": int(items), "turns": int(turns), "sigma": float(sigma), "_lower": max(sides) if sides else 1.0}


def _ahc041(text: str) -> dict:
    rows = _lines(text)
    vertices, edges, depth = (int(piece) for piece in rows[0].split()[:3])
    weights = [float(piece) for piece in rows[1].split()]
    return {
        "vertices": vertices,
        "edges": edges,
        "depth": depth,
        "_ceiling": 1 + (depth + 1) * sum(weights),
    }


def _ahc042(text: str) -> dict:
    rows = _lines(text)
    board = int(rows[0])
    depths = []
    for row_index, row in enumerate(rows[1:1 + board]):
        for column, cell in enumerate(row):
            if cell == "x":
                depths.append(min(row_index, column, board - 1 - row_index, board - 1 - column))
    return {"board": board, "oni_depth": (sum(depths) / len(depths)) if depths else 0.0, "_ceiling": 8 * board * board}


def _ahc044(text: str) -> dict:
    rows = _lines(text)
    people, limit = (int(piece) for piece in rows[0].split()[:2])
    targets = [float(piece) for piece in rows[1].split()]
    return {"people": people, "limit": limit, "target_skew": _skew(targets)}


def _ahc045(text: str) -> dict:
    cities, groups, queries = (int(piece) for piece in _lines(text)[0].split()[:3])
    return {"cities": cities, "groups": groups, "queries": queries}


def _future(text: str) -> dict:
    tasks, _members, skills, deps = (int(piece) for piece in _lines(text)[0].split()[:4])
    return {"tasks": tasks, "skills": skills, "deps": deps, "_ceiling": tasks + 1999}


def _toyota(text: str) -> dict:
    side, holes = (int(piece) for piece in _lines(text)[0].split()[:2])
    return {"side": side, "holes": holes}


# mode, time, loose, default ceiling or lower, parser
REST = {
    "ahc001": ("maximize", 5.0, False, 1e9, _ahc001),
    "ahc002": ("maximize", 2.0, False, 0.0, _ahc002),
    "ahc003": ("maximize", 2.0, False, 999999910.0, _ahc003),
    "ahc004": ("maximize", 3.0, False, 2e8, _ahc004),
    "ahc005": ("maximize", 3.0, False, 0.0, _ahc005),
    "ahc006": ("maximize", 2.0, False, 100000.0, _ahc006),
    "ahc007": ("maximize", 2.0, False, 1e8, _ahc007),
    "ahc009": ("maximize", 2.0, False, 1e8, _ahc009),
    "ahc010": ("maximize", 2.0, False, 202500.0, _ahc010),
    "ahc012": ("maximize", 3.0, False, 1e6, _ahc012),
    "ahc014": ("maximize", 5.0, False, 1e6, _ahc014),
    "ahc017": ("minimize", 6.0, True, 0.0, _ahc017),
    "ahc019": ("minimize", 6.0, True, 0.0, _ahc019),
    "ahc020": ("maximize", 2.0, False, 11000000.0, _ahc020),
    "ahc021": ("maximize", 2.0, False, 100000.0, _ahc021),
    "ahc028": ("maximize", 2.0, False, 10000.0, _ahc028),
    "ahc030": ("minimize", 3.0, False, 1.0, _ahc030),
    "ahc031": ("minimize", 3.0, False, 1.0, _ahc031),
    "ahc032": ("maximize", 2.0, True, 1.0, _ahc032),
    "ahc033": ("minimize", 3.0, True, 0.0, _ahc033),
    "ahc034": ("maximize", 2.0, False, 1e9, _ahc034),
    "ahc035": ("maximize", 2.0, True, 1e6, _ahc035),
    "ahc038": ("minimize", 3.0, True, 0.0, _ahc038),
    "ahc040": ("minimize", 3.0, False, 1.0, _ahc040),
    "ahc041": ("maximize", 2.0, False, 1.0, _ahc041),
    "ahc042": ("maximize", 2.0, False, 8 * 20 * 20, _ahc042),
    "ahc044": ("maximize", 2.0, False, 1e6, _ahc044),
    "ahc045": ("minimize", 2.0, True, 0.0, _ahc045),
    "future-contest-2022-qual": ("maximize", 3.0, False, 1999.0, _future),
    "toyota2023summer-final": ("maximize", 2.0, False, 1e9, _toyota),
}


def rest_features(problem_id: str, text: str) -> dict:
    return REST[problem_id][4](text)


def rest_ruler(problem_id: str, features: dict):
    mode, _time, loose, default, _parse = REST[problem_id]
    if mode == "maximize":
        ceiling = float(features.get("_ceiling", default))
        if ceiling <= 0:
            ceiling = float(default) if default else 1.0
        return mode, ceiling, 0.0, loose
    lower = float(features.get("_lower", default))
    return mode, lower, lower, loose


def public_features(features: dict) -> dict:
    return {key: value for key, value in features.items() if not str(key).startswith("_")}
