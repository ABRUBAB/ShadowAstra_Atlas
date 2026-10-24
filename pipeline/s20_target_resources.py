"""Step 20 · Measured cold, ice and water on the Moon and Mars side of every comparison.

Earth places are measured everywhere (steps 1 to 6). This adds the same kind of facts for the
targets, from NASA orbiters, so a report can put real numbers on both sides:

  Moon, south pole (7 targets)   LRO Diviner polar resource product (Paige et al., PDS
                                 LRO-L-DLRE-5-PRP v2): yearly average and maximum surface
                                 temperature, and depth to stable water ice, on 0.5 km triangles.
                                 The 605 MB table is sorted on a regular grid of Moon-centred
                                 x, y, so we binary-search it with HTTP range requests and read
                                 only the triangles within RADIUS_KM of each target.
  Mars (8 targets)               Mars Odyssey GRS water-equivalent hydrogen (H2O weight %, upper
                                 tens of cm), 5° smoothed map (Boynton et al. 2007, PDS
                                 ODY-M-GRS-5-ELEMENTS v1). Defined between about 60°S and 60°N.

These are shown as facts ("Earth can't copy" where Earth has no equivalent), never scored.

    python pipeline/s20_target_resources.py      → pipeline/.cache/target_resources.json
"""

from __future__ import annotations

import json
import math
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from common import CACHE, OUT, UA

RADIUS_KM = 10.0
R_MOON = 1737.4
PRP = "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab"
REC = 210
NGRID = 1200
GRS = "https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/smoothed/h2o_sr_5x5.tab"


def get_range(url: str, a: int, b: int, tries: int = 5) -> bytes:
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={**UA, "Range": f"bytes={a}-{b}"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception:  # noqa: BLE001 - network hiccups are retried
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"range {a}-{b} failed: {url}")


def rows(i0: int, i1: int) -> np.ndarray:
    """Data rows i0..i1 inclusive (row 0 is the first data row; record 0 is the header)."""
    raw = get_range(PRP, REC * (i0 + 1), REC * (i1 + 2) - 1).decode("ascii")
    return np.array([[float(x) for x in line.split(",")] for line in raw.splitlines() if line.strip()])


def row(i: int) -> np.ndarray:
    return rows(i, i)[0]


def locate(x: float, y: float) -> tuple[int, int]:
    """Grid indices whose first triangle vertex is nearest to (x, y): x falls with ix, y rises with iy."""
    lo, hi = 0, NGRID - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if row(mid * NGRID * 2)[0] > x:
            lo = mid
        else:
            hi = mid
    ix = lo
    lo, hi = 0, NGRID - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if row((ix * NGRID + mid) * 2)[1] < y:
            lo = mid
        else:
            hi = mid
    return ix, lo


def diviner(lat: float, lon: float) -> dict:
    """Stats of every Diviner triangle within RADIUS_KM of the point (cached in pipeline/.cache)."""
    x = R_MOON * math.cos(math.radians(lat)) * math.cos(math.radians(lon))
    y = R_MOON * math.cos(math.radians(lat)) * math.sin(math.radians(lon))
    cache = CACHE / f"diviner_{lat:.2f}_{lon:.2f}.npy"
    if cache.exists():
        a = np.load(cache)
    else:
        ix, iy = locate(x, y)
        step = abs(row(0)[0] - row(NGRID * 2)[0])
        w = int(math.ceil(RADIUS_KM / step)) + 1
        iy0, iy1 = max(0, iy - w), min(NGRID - 1, iy + w)

        def band(jx):
            return rows((jx * NGRID + iy0) * 2, (jx * NGRID + iy1) * 2 + 1)

        with ThreadPoolExecutor(8) as ex:
            blocks = list(ex.map(band, range(max(0, ix - w), min(NGRID, ix + w + 1))))
        a = np.vstack(blocks)
        np.save(cache, a)
    cx, cy = a[:, [0, 3, 6]].mean(1), a[:, [1, 4, 7]].mean(1)
    near = np.hypot(cx - x, cy - y) <= RADIUS_KM
    a = a[near]
    tavg, tmax, ice = a[:, 12], a[:, 13], a[:, 14]
    ok = (tavg > 0) & (tmax > 0)
    k2c = lambda v: round(float(v) - 273.15, 1)  # noqa: E731
    return {
        "triangles": int(near.sum()),
        "temp_avg_c": k2c(np.mean(tavg[ok])),
        "temp_avg_coldest_c": k2c(np.min(tavg[ok])),
        "temp_max_c": k2c(np.median(tmax[ok])),
        "temp_max_hottest_c": k2c(np.max(tmax[ok])),
        # ice_depth: -1 = colder than ~101 K all year, 0 = stable at the surface, > 0 = buried, -999 = none within 2.87 m
        "ice_surface_share": round(float(np.mean((ice == -1) | ((ice >= 0) & (ice < 0.01)))), 3),
        "ice_1m_share": round(float(np.mean((ice == -1) | ((ice >= 0) & (ice <= 1.0)))), 3),
        "never_above_110k_share": round(float(np.mean(tmax[ok] < 110)), 3),
        "radius_km": RADIUS_KM,
    }


def grs_map() -> dict:
    txt = urllib.request.urlopen(urllib.request.Request(GRS, headers=UA), timeout=60).read().decode("ascii")
    out = {}
    for line in txt.splitlines():
        p = line.split()
        if len(p) >= 3:
            out[(float(p[0]), float(p[1]))] = float(p[2])
    return out


def main() -> None:
    targets = json.loads((OUT / "grid.json").read_text(encoding="utf-8"))["targets"]
    res: dict[str, dict] = {}
    grs = grs_map()
    for t in targets:
        if t["body"] == "mars":
            la = math.floor(t["lat"] / 5) * 5 + 2.5
            lo = math.floor((t["lon"] % 360) / 5) * 5 + 2.5
            v = grs.get((la, lo))
            res[t["id"]] = {"h2o_wt_pct": None if v is None or v > 9000 else round(v, 1), "grs_bin": [la, lo],
                            "source": "Mars Odyssey GRS, water-equivalent hydrogen, 5° map (Boynton et al. 2007)"}
        elif t["body"] == "moon" and t["lat"] < -80:
            t0 = time.time()
            d = diviner(t["lat"], t["lon"])
            res[t["id"]] = {**d, "source": "LRO Diviner polar resource product (Paige et al.)"}
            print(f"  {t['id']:14s} {d} ({time.time() - t0:.0f} s)", flush=True)
    for k, v in res.items():
        if "h2o_wt_pct" in v:
            print(f"  {k:14s} H2O {v['h2o_wt_pct']} wt%")
    (CACHE / "target_resources.json").write_text(json.dumps(res, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
