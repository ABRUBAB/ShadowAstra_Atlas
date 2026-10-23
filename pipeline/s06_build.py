"""Step 6 · Build the discovery dataset and train the analog model.

Outputs (public/data/):
  grid.bin   compact typed arrays for every land cell
  grid.json  layout, feature scales, target table, name tables, model evaluation

Indicators (0–1, higher = more Moon/Mars-like) are simple, documented transforms of
the measured features. The browser turns them into dimension scores and a
mission-weighted match score, so every slider works live.

Rock types come from GLiM (Hartmann & Moosdorf 2012, 0.5° dominant class). Each Moon or
Mars target has a rock family (catalogue.TARGET_ROCK); the browser scores how close a
place's rock is to it with the table exported in grid.json.

The analog model is a positive–unlabelled LightGBM classifier: known field analog
sites are positives, the rest of the land is unlabelled background. We test it by
leaving each known site out in turn and asking where it would rank among all land.
We also export, for every place, how much of it was measured (coverage) and how much
the model's bags disagree (spread), so the site can say "not enough evidence".

    python pipeline/s06_build.py      (needs steps 1–5)
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import lightgbm as lgb
import numpy as np

from catalogue import KNOWN_ANALOGS, LITHOLOGY, ROCK_FAMILY, TARGET_ROCK
from common import CACHE, LAT, LON, OUT, fetch_json, load

RNG = np.random.default_rng(42)
GLIM = CACHE / "dl_glim" / "glim_wgs84_0point5deg.txt.asc"
LITH_GROUPS = {
    "lith_volcanic": ("vb", "va", "vi", "py"),
    "lith_plutonic": ("pb", "pa", "pi"),
    "lith_sediment": ("su", "ss", "sm", "sc"),
    "lith_salt": ("ev",),
    "lith_meta": ("mt",),
    "lith_ice": ("ig",),
}
PARAMS = dict(objective="binary", learning_rate=0.05, num_leaves=15, min_data_in_leaf=5, feature_fraction=0.8,
              bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0, verbose=-1, num_threads=12)
BAGS = 4
FINAL_BAGS = 8


def pct_rank(x: np.ndarray) -> np.ndarray:
    """Percentile rank 0..1 among finite values; NaN stays NaN."""
    out = np.full(x.shape, np.nan, np.float32)
    ok = np.isfinite(x)
    order = x[ok].argsort().argsort()
    out[ok] = order / max(1, ok.sum() - 1)
    return out


def hav(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def fill(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    return np.where(np.isfinite(a), a, b)


def glim_grid() -> np.ndarray:
    """GLiM class (1..16) on the shared 360 × 720 grid; coastal gaps take the nearest class within one cell."""
    if not GLIM.exists():
        print("GLiM grid missing: rock types will be 'Unknown'")
        return np.zeros((360, 720), np.int16)
    g = np.loadtxt(GLIM, skiprows=6).astype(np.int16)
    g[g < 0] = 0
    filled = g.copy()
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            sh = np.roll(np.roll(g, di, 0), dj, 1)
            take = (filled == 0) & (sh > 0) & (sh != 11)  # never borrow "water"
            filled[take] = sh[take]
    return filled


def features() -> SimpleNamespace:
    """Every measured feature, indicator and the model matrix for the kept land cells."""
    land = load("land")
    relief = np.load(CACHE / "terr_relief.npy")
    keep = (land >= 0.25) & np.isfinite(relief)
    I, J = np.where(keep)
    n = len(I)

    def g(name):
        arr = load(name) if (CACHE / f"{name}.npy").exists() else np.full(land.shape, np.nan, np.float32)
        return arr[I, J]

    terr = {k: np.load(CACHE / f"terr_{k}.npy")[I, J] for k in ("mean_slope", "p90_slope", "relief", "rough", "elev")}
    hist = np.load(CACHE / "terr_hist.npy")[I, J]
    ctx = np.load(CACHE / "context.npz")
    pos_of = {(i, j): k for k, (i, j) in enumerate(zip(ctx["I"], ctx["J"]))}
    cidx = np.array([pos_of.get((i, j), -1) for i, j in zip(I, J)])
    take = lambda key, default=np.nan: np.where(cidx >= 0, ctx[key][np.maximum(cidx, 0)], default)  # noqa: E731

    raw = {
        "elev": terr["elev"],
        "relief": terr["relief"],
        "slope": terr["mean_slope"],
        "slope90": terr["p90_slope"],
        "rough": terr["rough"],
        "t_mean": g("power_t2m"),
        "t_min": g("power_t2m_min"),
        "t_max": g("power_t2m_max"),
        "precip": g("power_prectotcorr") * 365.25,
        "rh": g("power_rh2m"),
        "sun": g("power_allsky_sfc_sw_dwn"),
        "lst_day_max": g("lst_day_max"),
        "lst_night_min": g("lst_night_min"),
        "lst_range": g("lst_range"),
        "ndvi": g("ndvi_max"),
        "barren": g("lc_barren"),
        "snowice": g("lc_snowice"),
        "shrub": g("lc_shrub"),
        "forest": g("lc_forest"),
        "crop": g("lc_crop"),
        "urban": g("lc_urban"),
        "snow_months": g("snow_months"),
        "volc_km": take("dvolc"),
        "impact": take("impact", 0.0),
    }
    # how much of each place was really measured (before any gap filling)
    measured = ("t_mean", "t_min", "t_max", "precip", "rh", "sun", "lst_day_max", "lst_night_min", "ndvi", "barren", "snow_months")
    coverage = np.mean([np.isfinite(raw[k]) for k in measured], axis=0).astype(np.float32)

    # sensible fallbacks where a source has gaps (e.g. polar night in MODIS)
    raw["ndvi"] = np.where(np.isfinite(raw["ndvi"]), raw["ndvi"], np.where(raw["snowice"] > 0.5, 0.0, 0.3))
    raw["lst_night_min"] = fill(raw["lst_night_min"], raw["t_min"] - 5)
    raw["lst_day_max"] = fill(raw["lst_day_max"], raw["t_max"] + 5)
    raw["lst_range"] = fill(raw["lst_range"], raw["lst_day_max"] - raw["lst_night_min"])

    veg = np.clip((raw["ndvi"] - 0.1) / 0.5, 0, 1)
    ind = {
        "dry": 1 - fill(pct_rank(raw["precip"]), veg),
        "bare": np.clip(np.clip(raw["barren"] + raw["snowice"] + 0.3 * raw["shrub"], 0, 1) * 0.6 + (1 - veg) * 0.4, 0, 1),
        "cold": 1 - pct_rank(raw["lst_night_min"]),
        "swing": pct_rank(raw["lst_range"]),
        "airdry": 1 - fill(pct_rank(raw["rh"]), 1 - veg),
        "hot": pct_rank(raw["lst_day_max"]),
        "volcanic": np.exp(-np.nan_to_num(raw["volc_km"], nan=5000) / 60),
        "impact": np.nan_to_num(raw["impact"]),
        "ice": np.clip(raw["snowice"] + np.nan_to_num(raw["snow_months"]) / 24 + 0.3 * (np.nan_to_num(raw["t_mean"], nan=10) < -2), 0, 1),
        "remote": 1 - np.clip(3 * np.nan_to_num(raw["urban"]) + np.nan_to_num(raw["crop"]), 0, 1),
        "rugged": pct_rank(raw["slope"]),
    }
    for k, v in ind.items():
        ind[k] = np.nan_to_num(v, nan=0.0).astype(np.float32)

    lith = glim_grid()[I, J].astype(np.int64)
    codes = np.array([c for c, _ in LITHOLOGY])
    lith_code = codes[np.clip(lith, 0, len(codes) - 1)]
    groups = {name: np.isin(lith_code, members).astype(np.float32) for name, members in LITH_GROUPS.items()}

    # Physical features only: human land use (cities, farms) says nothing about the Moon or Mars.
    model_feats = [k for k in raw if k not in ("volc_km", "urban", "crop")]
    feat_names = model_feats + ["volcanic", "lat_abs"] + list(groups)
    X = np.column_stack([raw[k] for k in model_feats] + [ind["volcanic"], np.abs(LAT[I])] + list(groups.values())).astype(np.float32)

    cell_of = {}
    for sid, _name, la, lo, _worlds in KNOWN_ANALOGS:
        k = snap(I, J, la, lo)
        if k >= 0:
            cell_of[sid] = k

    return SimpleNamespace(land=land, I=I, J=J, n=n, raw=raw, ind=ind, hist=hist, lith=lith, coverage=coverage,
                           X=X, feat_names=feat_names, cell_of=cell_of, take=take)


def snap(I, J, la, lo, max_d2=4):
    """Nearest kept cell to a point, within two cells; -1 if none."""
    i, j = int((90 - la) / 0.5), int((lo + 180) / 0.5)
    d = (I - i) ** 2 + (J - j) ** 2
    k = int(d.argmin())
    return k if d[k] <= max_d2 else -1


def train_predict(F: SimpleNamespace, pos_idx, bags: int = BAGS, rng=RNG):
    """Positive-unlabelled bagging: each bag draws a fresh random background sample.

    Returns the mean probability, the mean gain per feature and the spread of the bags'
    percentile ranks (how much the bags disagree about each place)."""
    n = F.n
    prob, gain, ranks = np.zeros(n), np.zeros(len(F.feat_names)), []
    for b in range(bags):
        neg = np.setdiff1d(rng.choice(n, size=min(6000, n), replace=False), pos_idx)
        idx = np.concatenate([pos_idx, neg])
        y = np.concatenate([np.ones(len(pos_idx)), np.zeros(len(neg))])
        w = np.concatenate([np.full(len(pos_idx), len(neg) / max(1, len(pos_idx)) / 4), np.ones(len(neg))])
        m = lgb.train({**PARAMS, "seed": 7 + b}, lgb.Dataset(F.X[idx], y, weight=w, feature_name=F.feat_names), num_boost_round=220)
        p = m.predict(F.X)
        prob += p / bags
        gain += m.feature_importance("gain") / bags
        ranks.append(pct_rank(p))
    spread = np.std(np.stack(ranks), axis=0).astype(np.float32)
    return prob, gain, spread


def baseline(F: SimpleNamespace, world: str) -> np.ndarray:
    ind = F.ind
    if world == "moon":
        return 0.3 * ind["bare"] + 0.25 * ind["cold"] + 0.2 * np.maximum(ind["volcanic"], ind["impact"]) + 0.15 * ind["dry"] + 0.1 * ind["remote"]
    return 0.3 * ind["dry"] + 0.3 * ind["bare"] + 0.15 * ind["cold"] + 0.1 * ind["airdry"] + 0.15 * np.maximum(ind["volcanic"], ind["impact"])


def rock_affinity(family: str) -> list[float]:
    aff = ROCK_FAMILY[family]["aff"]
    return [round(float(aff.get(code, 0.1 if code not in ("nd", "wb") else 0.0)), 3) for code, _ in LITHOLOGY]


def main() -> None:
    F = features()
    I, J, n, raw, ind, hist = F.I, F.J, F.n, F.raw, F.ind, F.hist
    print(f"{n} land cells with terrain · {len(F.cell_of)}/{len(KNOWN_ANALOGS)} known analogs mapped to cells")
    known_rock = np.bincount(F.lith, minlength=len(LITHOLOGY))
    print("rock classes:", {LITHOLOGY[c][0]: int(v) for c, v in enumerate(known_rock) if v})

    targets = json.loads((CACHE / "targets.json").read_text(encoding="utf-8"))
    tnpz = np.load(CACHE / "targets.npz")

    worlds_of = {a[0]: a[4] for a in KNOWN_ANALOGS}
    model_out, spread_out, evaluation = {}, {}, {}
    for world in ("moon", "mars"):
        pos = {sid: k for sid, k in F.cell_of.items() if world in worlds_of[sid]}
        ids, idxs = list(pos.keys()), list(pos.values())
        base = baseline(F, world)
        loo_model, loo_base = [], []
        lat_p, lon_p = LAT[I[idxs]], LON[J[idxs]]
        for h in range(len(ids)):
            # spatial block: also hide every known site within 300 km of the held-out one
            near = hav(lat_p[h], lon_p[h], lat_p, lon_p) < 300
            train_idx = [x for m, x in enumerate(idxs) if not near[m]]
            p, _, _ = train_predict(F, train_idx)
            others = np.ones(n, bool)
            others[train_idx] = False
            loo_model.append(float((p[others] > p[idxs[h]]).mean()))
            loo_base.append(float((base[others] > base[idxs[h]]).mean()))
        prob, gain, spread = train_predict(F, idxs, bags=FINAL_BAGS)
        model_out[world] = pct_rank(prob)
        spread_out[world] = spread
        order = np.argsort(gain)[::-1]
        evaluation[world] = {
            "positives": len(ids),
            "model_median_top_pct": round(100 * float(np.median(loo_model)), 1),
            "baseline_median_top_pct": round(100 * float(np.median(loo_base)), 1),
            "model_in_top10_pct": round(100 * float(np.mean(np.array(loo_model) <= 0.10)), 1),
            "baseline_in_top10_pct": round(100 * float(np.mean(np.array(loo_base) <= 0.10)), 1),
            "per_site": {sid: [round(100 * m, 1), round(100 * b, 1)] for sid, m, b in zip(ids, loo_model, loo_base)},
            "importance": [[F.feat_names[k], round(float(gain[k] / gain.sum()), 4)] for k in order[:10]],
        }
        e = evaluation[world]
        print(f"  {world}: {e['positives']} sites · median rank top {e['model_median_top_pct']}% (model) vs {e['baseline_median_top_pct']}% (baseline)"
              f" · in top 10%: {e['model_in_top10_pct']}% vs {e['baseline_in_top10_pct']}% · bag spread median {np.median(spread):.3f}")
        print("    ", [x[0] for x in e["importance"][:6]])

    # ---------------------------------------------------------- export
    take = F.take
    names = json.loads((CACHE / "names.json").read_text(encoding="utf-8"))
    region_ok = np.array([k not in ("Continent", "Dragons-be-here") for k in names["region_kind"]] + [False])
    region = take("region", -1).astype(np.int64)
    region = np.where((region >= 0) & region_ok[region], region, -1)
    impact_idx = np.where(np.nan_to_num(raw["impact"]) > 0.05, take("aimp", -1), -1).astype(np.int64)

    def remap(idx: np.ndarray, table: list[str]):
        """Keep only the names that cells use; return new indices and the short table."""
        used = np.unique(idx[idx >= 0])
        lut = np.full(len(table) + 1, -1, np.int64)
        lut[used] = np.arange(len(used))
        return np.where(idx >= 0, lut[idx], -1), [table[u] for u in used]

    country, t_country = remap(take("country", -1).astype(np.int64), names["countries"])
    region, t_region = remap(region, names["regions"])
    place_raw = take("place", -1).astype(np.int64)
    place, t_place = remap(place_raw, names["places"])
    ne_places = fetch_json("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson")["features"]
    place_ll = [[round(ne_places[u]["geometry"]["coordinates"][1], 2), round(ne_places[u]["geometry"]["coordinates"][0], 2)] for u in np.unique(place_raw[place_raw >= 0])]
    volc, t_volc = remap(take("avolc", -1).astype(np.int64), names["volcanoes"])
    impact_idx, t_impact = remap(impact_idx, names["impacts"])

    def q(a, dtype, scale=1.0):
        """Quantise with a reserved no-data value (min for signed types, max for unsigned)."""
        info = np.iinfo(dtype)
        nod = info.min if info.min < 0 else info.max
        lo, hi = (info.min + 1, info.max) if info.min < 0 else (0, info.max - 1)
        v = np.clip(np.round(np.nan_to_num(a) * scale), lo, hi)
        return np.where(np.isfinite(a), v, nod).astype(dtype), int(nod)

    arrays, fields = {}, {}

    def put(name, a, dtype, scale=1.0, kind="value"):
        arrays[name], nod = q(np.asarray(a, np.float64), dtype, scale)
        fields[name] = {"scale": scale, "nodata": nod, "kind": kind}

    for k, v in ind.items():
        put(f"i_{k}", v, np.uint8, 254, "indicator")
    for b in range(hist.shape[1]):
        put(f"h{b}", hist[:, b], np.uint8, 254, "slope_hist")
    put("model_moon", model_out["moon"], np.uint16, 65000, "model")
    put("model_mars", model_out["mars"], np.uint16, 65000, "model")
    put("u_moon", spread_out["moon"], np.uint8, 254, "quality")
    put("u_mars", spread_out["mars"], np.uint8, 254, "quality")
    put("q_cover", F.coverage, np.uint8, 254, "quality")
    put("f_lith", F.lith, np.uint8, 1, "name")
    for k, (dt, sc) in {
        "elev": (np.int16, 1), "relief": (np.uint16, 1), "slope": (np.uint8, 8), "t_mean": (np.int8, 1),
        "t_min": (np.int8, 1), "t_max": (np.int8, 1), "precip": (np.uint16, 1), "rh": (np.uint8, 2),
        "sun": (np.uint8, 20), "lst_day_max": (np.int8, 1), "lst_night_min": (np.int8, 1), "ndvi": (np.uint8, 250),
        "barren": (np.uint8, 250), "snowice": (np.uint8, 250), "volc_km": (np.uint16, 1),
    }.items():
        put(f"f_{k}", raw[k], dt, sc, "feature")
    put("n_country", np.where(country >= 0, country, np.nan), np.int16, 1, "name")
    put("n_region", np.where(region >= 0, region, np.nan), np.int16, 1, "name")
    put("n_place", np.where(place >= 0, place, np.nan), np.int16, 1, "name")
    put("n_place_km", take("dplace", np.nan), np.uint16, 1, "feature")
    put("n_volc", np.where(volc >= 0, volc, np.nan), np.int16, 1, "name")
    put("n_impact", np.where(impact_idx >= 0, impact_idx, np.nan), np.uint8, 1, "name")

    mask = np.zeros(F.land.shape, bool)
    mask[I, J] = True  # cells are stored in row-major order of this mask
    blob = bytearray(np.packbits(mask.ravel()).tobytes())
    layout = []
    for k, a in arrays.items():
        blob += b"\0" * ((-len(blob)) % a.itemsize)
        layout.append({"name": k, "dtype": a.dtype.name, "offset": len(blob), **fields[k]})
        blob += a.tobytes()
    (OUT / "grid.bin").write_bytes(bytes(blob))

    known = []
    for sid, name, la, lo, w in KNOWN_ANALOGS:
        known.append({"id": sid, "name": name, "lat": la, "lon": lo, "worlds": w.split(","), "cell": F.cell_of.get(sid, -1)})

    def rock(tid):
        fam = TARGET_ROCK.get(tid, "volcanic")
        return {"family": fam, "label": ROCK_FAMILY[fam]["label"], "aff": rock_affinity(fam)}

    meta = {
        "version": 3,
        "res": 0.5,
        "rows": int(F.land.shape[0]),
        "cols": int(F.land.shape[1]),
        "count": n,
        "mask_bytes": int(np.ceil(mask.size / 8)),
        "bin_bytes": len(blob),
        "layout": layout,
        "slope_bins": [0, 1, 2, 4, 6, 10, 15, 25, 90],
        "targets": [
            {"id": t["id"], "body": t["body"], "name": t["name"], "lat": t["lat"], "lon": t["lon"], "terrain": t["terrain"],
             "light": np.round(tnpz["light"][k] * 100).astype(int).tolist(), "light_month": tnpz["best"][k].astype(int).tolist(),
             "rock": rock(t["id"])}
            for k, t in enumerate(targets)
        ],
        "lithology": [{"code": c, "label": lab} for c, lab in LITHOLOGY],
        "names": {"country": t_country, "region": t_region, "place": t_place, "place_ll": place_ll, "volcano": t_volc, "impact": t_impact},
        "known": known,
        "evaluation": evaluation,
        "sources": {
            "terrain": "AWS Terrain Tiles (SRTM-based), 50 km footprint at 1.19 km spacing",
            "moon_terrain": "LRO LOLA LDEM 118 m (USGS Astrogeology mirror, 16-bit)",
            "mars_terrain": "MGS MOLA 463 m (USGS Astrogeology mirror, 16-bit)",
            "climate": "NASA POWER climatology (MERRA-2): T2M, T2M_MIN, T2M_MAX, PRECTOTCORR, RH2M, ALLSKY_SFC_SW_DWN",
            "surface": "NASA GIBS MODIS 2024 monthly NDVI, land surface temperature (day and night), snow cover; MODIS IGBP land cover 2023",
            "context": "Smithsonian GVP Holocene volcanoes; Earth Impact Database selection; Natural Earth names",
            "rocks": "GLiM Global Lithological Map, 0.5° dominant class (Hartmann & Moosdorf 2012)",
        },
    }
    (OUT / "grid.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"grid.bin {len(blob) / 1e6:.2f} MB · grid.json {(OUT / 'grid.json').stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
