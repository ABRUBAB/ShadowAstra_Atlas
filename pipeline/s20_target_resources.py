"""Step 20 · Measured cold, ice and water on the Moon and Mars side of every comparison.

Earth places are measured everywhere (steps 1 to 6). This adds the same kind of facts for the
targets, from NASA orbiters, so a report can put real numbers on both sides:

  Moon, south pole (7 targets)   LRO Diviner polar resource product (Paige et al., PDS
                                 LRO-L-DLRE-5-PRP v2): yearly average and maximum surface
                                 temperature, and depth to stable water ice, on 0.5 km triangles.
                                 The 605 MB table is sorted on a regular grid of Moon-centred
                                 x, y, so we binary-search it with HTTP range requests and read
                                 only the triangles within RADIUS_KM of each target.
  Moon, elsewhere (3 targets)    LRO Diviner global cumulative product (Williams et al. 2017, PDS
                                 LRO-L-DLRE-5-GCP v1): bolometric temperature in 0.5° cells and
                                 96 local-time bins, 2009 to 2015. The 3 x 3 cells around a target
                                 (about 45 km) give its day-and-night curve: average, hottest
                                 (noon) and coldest (pre-dawn) ground. Fixed-length records, so
                                 only those rows are read, with HTTP range requests.
  Moon (all 10 targets)          Lunar Prospector gamma-ray spectrometer oxides and thorium
                                 (Prettyman et al. 2006, PDS LP-L-GRS-5-ELEM-ABUNDANCE v1), 2°
                                 equal-area map; the instrument sees about 5° (150 km) of ground.
                                 Hydrogen from Lunar Prospector is not in a derived PDS map; at the
                                 pole Diviner's ice stability answers the same question better.
  Mars (8 targets)               Mars Odyssey GRS water-equivalent hydrogen (H2O weight %, upper
                                 tens of cm), 5° smoothed map (Boynton et al. 2007, PDS
                                 ODY-M-GRS-5-ELEMENTS v1). Defined between about 60°S and 60°N.
                                 SWIM ice consistency (Morgan et al. 2021) was planned too, but
                                 swim.psi.edu was down on 25 Oct 2026 and serves its maps only
                                 through a download form; add it when the site is back.

These are shown as facts ("Earth can't copy" where Earth has no equivalent), never scored.

    python pipeline/s20_target_resources.py      → pipeline/.cache/target_resources.json
    python pipeline/s20_target_resources.py --patch-grid   also writes them into public/data/grid.json
        (the key s06_build copies; facts only, so no score, model or grid.bin changes)
"""

from __future__ import annotations

import json
import math
import sys
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
GCP = "https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp/global_cumul_avg_cyl_{band}_002.tab"
GCP_REC, GCP_LT = 113, 96  # bytes per record; local-time bins per 0.5° cell (0.25 h)
LPGRS = "https://pds-geosciences.wustl.edu/lunar/lp-l-grs-5-elem-abundance-v1/lp_9001/data/lpgrs_high1_elem_abundance_2deg.tab"


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


def gcp_curve(lat: float, lon: float) -> np.ndarray:
    """Mean Diviner bolometric temperature (K) by local time over the 3 x 3 cells around a point."""
    lo = math.floor(lat / 10) * 10
    north = lo >= 0

    def tag(v: int) -> str:
        return f"{abs(v):02d}{'n' if v > 0 or (v == 0 and north) else 's'}"

    url = GCP.format(band=f"{tag(lo)}{tag(lo + 10)}")
    j0 = int((lat - lo) // 0.5)
    i0 = int((lon + 180) // 0.5) % 720
    cache = CACHE / f"diviner_gcp_{lat:.2f}_{lon:.2f}.npy"
    if cache.exists():
        a = np.load(cache)
    else:
        blocks = []
        for i in ((i0 - 1) % 720, i0, (i0 + 1) % 720):
            ja, jb = max(0, j0 - 1), min(19, j0 + 1)  # rows are ordered lon, lat, local time
            r0, r1 = (i * 20 + ja) * GCP_LT, (i * 20 + jb) * GCP_LT + GCP_LT - 1
            raw = get_range(url, GCP_REC * (r0 + 1), GCP_REC * (r1 + 2) - 1).decode("ascii")
            blocks.append(np.array([[float(x) for x in line.split(",")] for line in raw.splitlines() if line.strip()]))
        a = np.vstack(blocks)
        np.save(cache, a)
    assert a.shape[1] == 11 and np.all(np.abs(a[:, 1] - lat) <= 1.0), "unexpected Diviner rows"
    tbol = np.where(a[:, 10] > 0, a[:, 10], np.nan).reshape(-1, GCP_LT)
    return np.nanmean(tbol, axis=0)


def diviner_global(lat: float, lon: float) -> dict:
    c = gcp_curve(lat, lon)
    ok = np.isfinite(c)
    # fill local-time gaps by circular linear interpolation, so the average covers the whole day
    x = np.arange(GCP_LT)
    filled = np.interp(x, np.r_[x[ok] - GCP_LT, x[ok], x[ok] + GCP_LT], np.r_[c[ok], c[ok], c[ok]])

    def k2c(v: float) -> float:
        return round(float(v) - 273.15, 1)

    return {"temp_avg_c": k2c(filled.mean()), "temp_max_c": k2c(np.nanmax(c)), "temp_min_c": k2c(np.nanmin(c)),
            "local_time_bins": int(ok.sum()), "radius_km": 22.0}


def lp_oxides() -> list[list[float]]:
    from common import fetch

    return [[float(x) for x in line.split()] for line in fetch(LPGRS).decode("ascii").splitlines() if line.strip()]


def lp_at(table: list[list[float]], lat: float, lon: float) -> dict:
    """Columns: index, lat min/max, lon min/max (-180..180), atomic mass, neutron density, MgO, Al2O3, SiO2, CaO, TiO2, FeO, K, Th, U."""
    row = next(r for r in table if r[1] <= lat < r[2] and r[3] <= lon < r[4])
    return {"feo_wt_pct": round(row[12] * 100, 1), "tio2_wt_pct": round(row[11] * 100, 1), "th_ppm": round(row[14], 1)}


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
    lp = lp_oxides()
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
        elif t["body"] == "moon":
            d = diviner_global(t["lat"], t["lon"])
            res[t["id"]] = {**d, "source": "LRO Diviner global temperatures, day and night (Williams et al. 2017)"}
            print(f"  {t['id']:14s} {d}", flush=True)
        if t["body"] == "moon":
            res[t["id"]].update(lp_at(lp, t["lat"], t["lon"]))
            res[t["id"]]["oxides_source"] = "Lunar Prospector gamma-ray spectrometer, about 150 km footprint (Prettyman et al. 2006)"
    for k, v in res.items():
        if "h2o_wt_pct" in v:
            print(f"  {k:14s} H2O {v['h2o_wt_pct']} wt%")
    (CACHE / "target_resources.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    if "--patch-grid" in sys.argv:
        gp = OUT / "grid.json"
        g = json.loads(gp.read_text(encoding="utf-8"))
        for t in g["targets"]:
            if t["id"] in res:
                t["resources"] = res[t["id"]]
        gp.write_text(json.dumps(g, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"resources written into {gp.name} for {sum(t['id'] in res for t in g['targets'])} targets")


if __name__ == "__main__":
    main()
