"""Step 5 · Moon and Mars targets: terrain statistics and the sunlight-match table.

Terrain: the same 50 km footprint at ~1.2 km spacing as every Earth cell, sampled
from full-precision 16-bit LRO LOLA (118 m) and MGS MOLA (463 m) global DEMs
(USGS Astrogeology mirrors), read with HTTP range requests and smoothed to the
shared ~1.2 km scale.

Sunlight: a NumPy port of src/lib/sun.ts. For every Earth latitude row and month we
compare the distribution of daylight Sun elevations with the target's, using
1 − W1/25° (earth-mover distance). We keep the best month and its score.

    python pipeline/s05_targets.py
"""

from __future__ import annotations

import json
import re

import numpy as np

from common import CACHE, LAT, ROOT
from terrain_lib import FOOT_KM, LOLA_FULL, MOLA_FULL, N, local_points, stats

OBLIQUITY = {"earth": 23.44, "moon": 1.54, "mars": 25.19}


def read_targets():
    src = (ROOT / "src" / "data" / "sites.ts").read_text(encoding="utf-8")
    block = src[src.index("export const TARGETS") : src.index("export interface EarthSite")]
    pat = re.compile(r'id: "([^"]+)",\s*body: "(moon|mars)",\s*name: "([^"]+)",.*?lat: (-?[\d.]+),\s*lon: (-?[\d.]+)', re.S)
    return [dict(id=m[0], body=m[1], name=m[2], lat=float(m[3]), lon=float(m[4])) for m in pat.findall(block)]


def fine_hist(body: str, lat: float, f0: float = 0.0, f1: float = 1.0, seasons: int = 72, steps: int = 96) -> np.ndarray:
    """Normalised 1-degree histogram (90 bins) of daylight Sun elevation."""
    f = f0 + (f1 - f0) * (np.arange(seasons) + 0.5) / seasons
    decl = np.radians(OBLIQUITY[body] * np.sin(2 * np.pi * f))[:, None]
    h = 2 * np.pi * np.arange(steps) / steps
    p = np.radians(lat)
    s = np.sin(p) * np.sin(decl) + np.cos(p) * np.cos(decl) * np.cos(h)[None]
    e = np.degrees(np.arcsin(np.clip(s, -1, 1))).ravel()
    e = e[e > 0]
    if e.size == 0:
        return np.zeros(90, np.float32)
    hist = np.bincount(np.minimum(e.astype(int), 89), minlength=90).astype(np.float32)
    return hist / hist.sum()


def similarity(a: np.ndarray, b: np.ndarray) -> float:
    if a.sum() == 0 or b.sum() == 0:
        return 0.0
    w1 = np.abs(np.cumsum(a) - np.cumsum(b)).sum()
    return float(max(0.0, 1 - w1 / 25))


def month_window(m: int):
    start = (m * 30.44 - 80 + 365) / 365
    return start, start + 30.44 / 365


def main() -> None:
    targets = read_targets()
    print(f"{len(targets)} targets")

    # terrain
    for t in targets:
        src = LOLA_FULL if t["body"] == "moon" else MOLA_FULL
        lat, lon = local_points(t["body"], np.array([t["lat"]]), np.array([t["lon"]]), FOOT_KM, N)
        h = src.sample(lat, lon, FOOT_KM / N)
        s = stats(h, FOOT_KM / N, t["body"])
        t["terrain"] = {
            "hist": [round(float(v), 4) for v in s["hist"][0]],
            "mean_slope": round(float(s["mean_slope"][0]), 2),
            "p90_slope": round(float(s["p90_slope"][0]), 2),
            "relief": round(float(s["relief"][0]), 1),
            "rough": round(float(s["rough"][0]), 1),
        }
        print(f"  {t['id']:22s} slope {t['terrain']['mean_slope']:5.1f}°  relief {t['terrain']['relief'] / 1000:5.2f} km")

    # sunlight-match table: rows = Earth latitude rows, per target best month score
    months_hist = np.stack([[fine_hist("earth", la, *month_window(m), seasons=24, steps=48) for m in range(12)] for la in LAT])
    light = np.zeros((len(targets), len(LAT)), np.float32)
    best = np.zeros((len(targets), len(LAT)), np.int8)
    for k, t in enumerate(targets):
        th = fine_hist(t["body"], t["lat"])
        for i in range(len(LAT)):
            sc = [similarity(months_hist[i, m], th) for m in range(12)]
            best[k, i] = int(np.argmax(sc))
            light[k, i] = max(sc)
    np.savez(CACHE / "targets.npz", light=light, best=best)
    (CACHE / "targets.json").write_text(json.dumps(targets, ensure_ascii=False, indent=1), encoding="utf-8")
    print("done.")


if __name__ == "__main__":
    main()
