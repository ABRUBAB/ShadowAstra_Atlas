"""Step 3 · Earth terrain statistics for every land cell (SRTM-based AWS Terrain Tiles).

For each 0.5 degree land cell: a 50 x 50 km footprint at ~1.2 km spacing, then slope
histogram, mean / 90th-percentile slope, relief (P2–P98), roughness and mean elevation.

    python pipeline/s03_terrain.py        (needs s01 land mask)
"""

from __future__ import annotations

import math
import time

import numpy as np

from common import CACHE, LAT, LON, NCOL, NROW, load
from terrain_lib import EARTH, FOOT_KM, N, local_points, sample, stats


def zoom_for(lat: float) -> int:
    native = 156.543 * max(math.cos(math.radians(lat)), 0.05)
    return int(min(10, max(3, math.ceil(math.log2(native / 1.3)))))


def main() -> None:
    land = load("land")
    out = {k: np.full((NROW, NCOL), np.nan, np.float32) for k in ("mean_slope", "p90_slope", "relief", "rough", "elev", "tmissing")}
    hist = np.full((NROW, NCOL, 8), np.nan, np.float32)
    t0 = time.time()
    rows = [i for i in range(NROW) if abs(LAT[i]) < 84.5 and land[i].max() > 0.02]
    for k, i in enumerate(rows):
        js = np.where(land[i] > 0.02)[0]
        lat0 = np.full(len(js), LAT[i])
        lat, lon = local_points("earth", lat0, LON[js])
        h = sample(EARTH, zoom_for(LAT[i]), lat, lon)
        s = stats(h, FOOT_KM / N, "earth")
        hist[i, js] = s["hist"]
        for key in ("mean_slope", "p90_slope", "relief", "rough", "elev"):
            out[key][i, js] = s[key]
        out["tmissing"][i, js] = s["missing"]
        if k % 20 == 0:
            el = time.time() - t0
            print(f"  row {k + 1}/{len(rows)} lat {LAT[i]:+.2f} cells {len(js)}  {el / 60:.1f} min", flush=True)
    for key, arr in out.items():
        np.save(CACHE / f"terr_{key}.npy", arr)
    np.save(CACHE / "terr_hist.npy", hist)
    print(f"done in {(time.time() - t0) / 60:.1f} min")


if __name__ == "__main__":
    main()
