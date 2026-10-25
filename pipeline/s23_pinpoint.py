"""Step 23 · Pinpoint: the best 10 km spot inside a 55 km place, and a test of whether it finds real field sites.

Every place on the site is a 0.5° cell (about 55 km). Field teams work in a few kilometres, so the
place report also shows the 10 km piece of the cell whose ground is most like the target's:

  * heights from the same SRTM terrain tiles, on the same 1.19 km grid, with the same smoothing and
    slope baseline as every other ground statistic on the site (terrain_lib, s03);
  * a 59.5 km square around the cell centre, cut into 10 km windows (8 x 8 slopes) every 2.4 km,
    keeping windows whose centre lies in the central 50 km and that are at most 20% water (NASA
    MODIS water mask, MOD44W on GIBS: lakes and sea are dead flat in the height data);
  * each window scored by how much of its slope histogram overlaps the target's (the 0.65 part of
    the ground-shape formula). Height range is reported, not scored: it grows with window size,
    so a 10 km window cannot be compared fairly with a target's 50 km range.

The test: for each of the 38 known and 28 independent test sites, take the cell it falls in and the
target of its world whose ground best matches that cell at 50 km, rank the 10 km windows, and see
where the window holding the real site lands (0 = best window, 1 = worst; chance is 0.5).

    python pipeline/s23_pinpoint.py   → validation.json "pinpoint", pipeline/.cache/pinpoint_test.json,
                                         tests/fixtures/pinpoint.json (browser parity)
"""

from __future__ import annotations

import json
import math
import time
from pathlib import Path

import numpy as np
from scipy.stats import binomtest, wilcoxon

import s14_validate as v
from catalogue import KNOWN_ANALOGS, VALIDATION_SITES
from s03_terrain import zoom_for
from terrain_lib import EARTH, FOOT_KM, N, RADIUS_KM, SLOPE_BINS, local_points, sample, smooth

ROOT = Path(__file__).resolve().parent.parent
STEP = FOOT_KM / N  # 1.19 km, the spacing of every ground statistic on the site
NP = 50  # samples per side: a 59.5 km square
WIN = 8  # window: 8 x 8 slopes, 9.5 km
STRIDE = 2  # a window every 2.4 km
HALF = 25.0  # window centres within the central 50 km
MAX_WATER = 0.2  # windows more than 20% water are left out
WATER = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Water_Mask/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png"


def heights(lat: float, lon: float) -> np.ndarray:
    la, lo = local_points("earth", np.array([lat]), np.array([lon]), foot_km=NP * STEP, n=NP)
    h = sample(EARTH, zoom_for(lat), la, lo)[0]
    h = np.where(np.isnan(h), np.nanmean(h), h)
    return smooth(h[None], 0.8)[0]


def water(lat: float, lon: float) -> np.ndarray | None:
    """1 where the NP x NP grid (same layout as heights()) is on water, from the MODIS mask at zoom 9."""
    import io

    from PIL import Image

    from common import fetch

    la, lo = local_points("earth", np.array([lat]), np.array([lon]), foot_km=NP * STEP, n=NP)
    W = 256 * 2**9
    r = np.radians(np.clip(la[0], -85, 85))
    X = ((lo[0] + 180) / 360 * W) % W
    Y = (1 - np.log(np.tan(r) + 1 / np.cos(r)) / np.pi) / 2 * W
    out = np.zeros((NP, NP), np.uint8)
    got = False
    for tx, ty in {(int(a // 256), int(b // 256)) for a, b in zip(X.ravel(), Y.ravel())}:
        try:
            im = np.asarray(Image.open(io.BytesIO(fetch(WATER.format(z=9, x=tx, y=ty)))).convert("RGBA"))
        except RuntimeError:
            continue
        got = True
        m = (np.floor(X / 256) == tx) & (np.floor(Y / 256) == ty)
        out[m] = im[np.minimum(255, np.floor(Y[m] % 256).astype(int)), np.minimum(255, np.floor(X[m] % 256).astype(int)), 3] > 127
    return out if got else None


def windows(h: np.ndarray, target_hist: np.ndarray, wet: np.ndarray | None = None) -> np.ndarray:
    """Rows of (x km east, y km north, overlap score, mean slope °, height range m) per 10 km window.
    Same arithmetic as src/lib/pinpoint.ts (checked by tests/unit/pinpoint.test.ts)."""
    n = h.shape[0]
    d = STEP * 1000 * 2
    gx = (h[1:-1, 2:] - h[1:-1, :-2]) / d
    gy = (h[2:, 1:-1] - h[:-2, 1:-1]) / d
    s = np.degrees(np.arctan(np.hypot(gx, gy)))  # s[j, i] is the slope at height pixel (j + 1, i + 1)
    out = []
    for wj in range(0, n - 2 - WIN + 1, STRIDE):
        for wi in range(0, n - 2 - WIN + 1, STRIDE):
            cj, ci = wj + 1 + (WIN - 1) / 2, wi + 1 + (WIN - 1) / 2
            x, y = (ci + 0.5 - n / 2) * STEP, (n / 2 - cj - 0.5) * STEP
            if abs(x) > HALF or abs(y) > HALF:
                continue
            if wet is not None and wet[wj + 1 : wj + 1 + WIN, wi + 1 : wi + 1 + WIN].mean() > MAX_WATER:
                continue
            w = s[wj : wj + WIN, wi : wi + WIN].ravel()
            hist = np.array([((w >= SLOPE_BINS[b]) & (w < SLOPE_BINS[b + 1])).mean() for b in range(len(SLOPE_BINS) - 1)])
            hh = np.sort(h[wj + 1 : wj + 1 + WIN, wi + 1 : wi + 1 + WIN].ravel())
            q = lambda p: hh[min(len(hh) - 1, int(p * len(hh)))]  # noqa: E731 - same quantile as terrain.ts
            out.append((x, y, float(np.minimum(hist, target_hist).sum()), float(w.mean()), float(q(0.98) - q(0.02))))
    return np.array(out)


def offset_km(lat0: float, lon0: float, lat: float, lon: float) -> tuple[float, float]:
    """Azimuthal-equidistant x (east) and y (north) of a point from a centre, km."""
    p0, p, dl = math.radians(lat0), math.radians(lat), math.radians(lon - lon0)
    cosc = math.sin(p0) * math.sin(p) + math.cos(p0) * math.cos(p) * math.cos(dl)
    c = math.acos(max(-1.0, min(1.0, cosc)))
    k = 1.0 if c < 1e-12 else c / math.sin(c)
    R = RADIUS_KM["earth"]
    return R * k * math.cos(p) * math.sin(dl), R * k * (math.cos(p0) * math.sin(p) - math.sin(p0) * math.cos(p) * math.cos(dl))


def main() -> None:
    t0 = time.time()
    g = v.Grid()
    hist = np.stack([g.a[f"h{b}"] / 254.0 for b in range(8)], 1)
    relief = g.a["f_relief"].astype(np.float64)
    targets = g.meta["targets"]
    sites = [(a[0], a[1], a[2], a[3], a[4].split(","), "known") for a in KNOWN_ANALOGS]
    sites += [(s[0], s[1], s[2], s[3], s[4].split(","), "independent") for s in VALIDATION_SITES]
    rows, fixture = [], []
    for sid, name, lat, lon, worlds, group in sites:
        k = g.cell_at(lat, lon)
        clat, clon = float(g.lat[k]), float(g.lon[k])
        # the target whose 50 km ground best matches this cell (ground-shape formula of the site)
        cand = [t for t in targets if t["body"] in worlds]
        rel_ok = relief[k] != g.f["f_relief"]["nodata"]
        sims = []
        for t in cand:
            th = np.array(t["terrain"]["hist"])
            ov = np.minimum(hist[k], th).sum()
            ratio = max(relief[k] / g.f["f_relief"]["scale"] if rel_ok else 1.0, 1) / max(t["terrain"]["relief"], 1)
            sims.append(0.65 * ov + 0.35 * max(0.0, 1 - abs(math.log10(ratio))))
        t = cand[int(np.argmax(sims))]
        th = np.array(t["terrain"]["hist"], dtype=np.float64)
        h = heights(clat, clon)
        wet = water(clat, clon)
        W = windows(h, th, wet)
        if not len(W):  # all water: the land-blind answer, as the site does
            W = windows(h, th)
        sx, sy = offset_km(clat, clon, lat, lon)
        i = int(np.argmin(np.hypot(W[:, 0] - sx, W[:, 1] - sy)))
        better = int((W[:, 2] > W[i, 2]).sum())
        ties = int((W[:, 2] == W[i, 2]).sum()) - 1
        p = (better + 0.5 * ties) / (len(W) - 1)
        b = int(np.argmax(W[:, 2]))
        dist_best = float(math.hypot(W[b, 0] - sx, W[b, 1] - sy))
        dist_all = float(np.median(np.hypot(W[:, 0] - sx, W[:, 1] - sy)))
        rows.append({"id": sid, "name": name, "group": group, "target": t["id"], "rank": round(p, 4), "windows": len(W),
                     "water_share": None if wet is None else round(float(wet.mean()), 3),
                     "site_km_from_centre": round(math.hypot(sx, sy), 1), "best_km_from_site": round(dist_best, 1),
                     "median_km_from_site": round(dist_all, 1), "best_score": round(float(W[b, 2]), 4),
                     "site_score": round(float(W[i, 2]), 4), "mean_score": round(float(W[:, 2].mean()), 4)})
        if sid in ("meteor-crater", "atacama", "shark-bay"):  # shark-bay: a coast, so the water rule is tested too
            hr = np.round(h, 2)  # the fixture stores centimetres, so it is scored on exactly those heights
            fixture.append({"id": sid, "n": NP, "step": STEP, "target_hist": th.round(4).tolist(), "heights": hr.astype(float).tolist(),
                            "water": None if wet is None else wet.astype(int).ravel().tolist(),
                            "windows": [[round(float(c), 6) for c in r] for r in windows(hr, np.round(th, 4), wet)]})
        print(f"  {sid:16s} {t['id']:14s} window rank {p:.2f}  best {dist_best:5.1f} km from site (median {dist_all:4.1f})  {time.time() - t0:4.0f} s", flush=True)

    def summary(rs: list[dict]) -> dict:
        r = np.array([x["rank"] for x in rs])
        db = np.array([x["best_km_from_site"] for x in rs])
        dm = np.array([x["median_km_from_site"] for x in rs])
        top = int((r < 0.5).sum())
        return {"n": len(rs), "median_rank": round(float(np.median(r)), 3), "mean_rank": round(float(r.mean()), 3),
                "top_quarter": round(float((r <= 0.25).mean()), 3), "better_half": top,
                "sign_test_p": round(float(binomtest(top, len(r), 0.5, alternative="greater").pvalue), 4),
                "wilcoxon_p": round(float(wilcoxon(r - 0.5, alternative="less").pvalue), 4),
                "best_km_median": round(float(np.median(db)), 1), "random_km_median": round(float(np.median(dm)), 1)}

    res = {"all": summary(rows), "known": summary([x for x in rows if x["group"] == "known"]),
           "independent": summary([x for x in rows if x["group"] == "independent"]),
           "rows": rows, "method": {"spacing_km": round(STEP, 3), "window_km": round(WIN * STEP, 1), "stride_km": round(STRIDE * STEP, 1), "area_km": 2 * HALF}}
    a = res["all"]
    res["works"] = bool(a["median_rank"] < 0.5 and a["sign_test_p"] < 0.05)
    (Path(__file__).resolve().parent / ".cache" / "pinpoint_test.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    vp = ROOT / "public" / "data" / "validation.json"
    val = json.loads(vp.read_text(encoding="utf-8"))
    val["pinpoint"] = res
    vp.write_text(json.dumps(val, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    fx = ROOT / "tests" / "fixtures" / "pinpoint.json"
    fx.write_text(json.dumps({"win": WIN, "stride": STRIDE, "half": HALF, "max_water": MAX_WATER, "sites": fixture}, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({k: res[k] for k in ("all", "known", "independent", "works")}, indent=1))
    print(f"done in {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
