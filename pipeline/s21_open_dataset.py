"""Step 21 · Export the open dataset (Hugging Face: ABRUBAB/shadowastra-atlas).

Everything the website knows, as plain tables anyone can reuse, written from the same files
the website loads (public/data) with the NumPy twin of its scoring (s14_validate.py):

  places.parquet          one row per land area (80,206): names, measurements in real units,
                          EMIT minerals, slope histogram, indicators, learned model, confidence
  target_scores.parquet   one row per land area and Moon or Mars target (18 × 80,206): the match
                          score for the target's main job as the site shows it, and every factor
  targets.csv/.json       the 18 targets: terrain, rocks, published minerals, Diviner / Odyssey facts
  known_sites.csv         the 38 training sites; validation_sites.csv the 28 never used for training
  ai_twins.parquet        the 5 closest Earth places for every 1° Moon and Mars cell (Kaggle K3)
  validation.json         every test the How it works page shows

    python pipeline/s21_open_dataset.py                  → pipeline/.cache/hf_dataset/
    HF_TOKEN=... python pipeline/s21_open_dataset.py --push
"""

from __future__ import annotations

import csv
import json
import re
import shutil
import sys
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

import s14_validate as v
from catalogue import KNOWN_ANALOGS, KNOWN_JOBS, VALIDATION_SITES

ROOT = Path(__file__).resolve().parent.parent
OUTD = Path(__file__).resolve().parent / ".cache" / "hf_dataset"
REPO = "ABRUBAB/shadowastra-atlas"
SLOPE_BINS = ["0_1", "1_2", "2_4", "4_6", "6_10", "10_15", "15_25", "25_90"]
FEATURES = {  # grid field → column name (real units)
    "f_elev": "elevation_m", "f_relief": "height_range_50km_m", "f_slope": "mean_slope_deg",
    "f_t_mean": "air_temp_mean_c", "f_t_min": "air_temp_coldest_month_c", "f_t_max": "air_temp_warmest_month_c",
    "f_precip": "rain_mm_per_year", "f_rh": "humidity_pct", "f_sun": "sunshine_kwh_m2_day",
    "f_lst_day_max": "ground_temp_hottest_day_c", "f_lst_night_min": "ground_temp_coldest_night_c",
    "f_ndvi": "plants_ndvi_max", "f_barren": "bare_ground_share", "f_snowice": "snow_ice_share", "f_volc_km": "volcano_km",
}


def target_jobs() -> dict[str, str]:
    """Each target's main job, as Find new sites picks it (the first in src/data/sites.ts)."""
    src = (ROOT / "src" / "data" / "sites.ts").read_text(encoding="utf-8")
    block = src[src.index("export const TARGETS") : src.index("export interface EarthSite")]
    return {m[0]: re.findall(r'"([^"]+)"', m[1])[0] for m in re.findall(r'id: "([^"]+)",.*?tasks: \[([^\]]*)\]', block, re.S)}


def table(cols: dict) -> pa.Table:
    return pa.table({k: (pa.array(a) if not isinstance(a, np.ndarray) else pa.array(a, from_pandas=True)) for k, a in cols.items()})


def main() -> None:
    OUTD.mkdir(parents=True, exist_ok=True)
    g = v.Grid()
    m = g.meta
    n = g.n
    val = lambda name: np.where(g.a[name] == g.f[name]["nodata"], np.nan, g.a[name].astype(np.float64) / g.f[name]["scale"])  # noqa: E731
    names = m["names"]

    def label(field, table_):
        raw = g.a[field].astype(np.int64)
        ok = raw != g.f[field]["nodata"]
        return [table_[x] if o else None for x, o in zip(raw, ok)]

    # ------------------------------------------------------------- places
    cols: dict = {"cell": np.arange(n, dtype=np.int32), "lat": g.lat.astype(np.float32), "lon": g.lon.astype(np.float32)}
    cols["country"] = label("n_country", names["country"])
    cols["country"] = [c if c else ("Antarctica" if la < -60 else None) for c, la in zip(cols["country"], g.lat)]
    cols["region"] = label("n_region", names["region"])
    cols["nearest_town"] = label("n_place", names["place"])
    cols["nearest_town_km"] = np.round(val("n_place_km"), 0)
    for f, c in FEATURES.items():
        cols[c] = np.round(val(f), 3).astype(np.float32)
    cols["nearest_volcano"] = label("n_volc", names["volcano"])
    cols["impact_crater"] = label("n_impact", names["impact"])
    lith = [x["label"] for x in m["lithology"]]
    cols["rock_type_glim"] = [lith[int(x)] if lith[int(x)] != "Unknown" else None for x in g.a["f_lith"]]
    for fam in ("clay", "sulfate", "carbonate", "iron"):
        cols[f"emit_{fam}_share"] = np.round(val(f"f_min_{fam}"), 4).astype(np.float32)
    for b, name in enumerate(SLOPE_BINS):
        cols[f"slope_share_{name}_deg"] = np.round(g.H[:, b], 4).astype(np.float32)
    for k in g.I:
        cols[f"indicator_{k}"] = np.round(g.I[k], 4).astype(np.float32)
    conf = m["confidence"]
    cover = val("q_cover")
    cols["measured_share"] = np.round(cover, 3).astype(np.float32)
    for w in ("moon", "mars"):
        cols[f"learned_{w}"] = np.round(g.model[w], 5).astype(np.float32)
        spread = val(f"u_{w}")
        cols[f"learned_{w}_spread"] = np.round(spread, 3).astype(np.float32)
        level = np.where((cover < conf["cover_low"]) | (spread > conf["spread_low"]), "low",
                         np.where((cover < conf["cover_medium"]) | (spread > conf["spread_medium"]), "medium", "high"))
        cols[f"confidence_{w}"] = level.tolist()
    known_ll = np.array([(a[2], a[3]) for a in KNOWN_ANALOGS])
    d = v.hav(g.lat[:, None], g.lon[:, None], known_ll[None, :, 0], known_ll[None, :, 1])
    near = d.argmin(1)
    near_km = d[np.arange(n), near]
    cols["known_site_within_150km"] = [KNOWN_ANALOGS[i][0] if km < 150 else None for i, km in zip(near, near_km)]
    cols["nearest_known_site_km"] = np.round(near_km, 0).astype(np.float32)
    pq.write_table(table(cols), OUTD / "places.parquet", compression="zstd")
    print(f"places.parquet: {n} rows × {len(cols)} columns")

    # ------------------------------------------------------------- target scores
    jobs = target_jobs()
    parts = []
    for t in m["targets"]:
        job = jobs[t["id"]]
        w = v.TASK_WEIGHTS[job]
        D = v.dims(g, t, job, use_min=v.USE_MINERALS)
        mission = sum(D[k] * w[k] for k in v.DIMS) / sum(w.values())
        model = g.model[t["body"]]
        parts.append({
            "cell": np.arange(n, dtype=np.int32), "target": [t["id"]] * n, "body": [t["body"]] * n, "job": [job] * n,
            "match_score": np.round((1 - v.MIX) * mission + v.MIX * model, 4).astype(np.float32),
            "factors_only": np.round(mission, 4).astype(np.float32),
            "ground_shape": np.round(D["topography"], 4).astype(np.float32),
            "ground_shape_ai": np.round(g.shape[t["id"]], 4).astype(np.float32) if t["id"] in g.shape else np.full(n, np.nan, np.float32),
            "rocks_craters": np.round(D["geology"], 4).astype(np.float32),
            "cold_heat": np.round(D["temperature"], 4).astype(np.float32),
            "sunlight_angle": np.round(D["lighting"], 4).astype(np.float32),
            "bare_dry_ground": np.round(D["regolith"], 4).astype(np.float32),
            "learned": np.round(model, 5).astype(np.float32),
        })
    ts = pa.concat_tables([table(p) for p in parts])
    pq.write_table(ts, OUTD / "target_scores.parquet", compression="zstd")
    print(f"target_scores.parquet: {ts.num_rows} rows")

    # ------------------------------------------------------------- targets
    rows = []
    for t in m["targets"]:
        r = {"id": t["id"], "body": t["body"], "name": t["name"], "lat": t["lat"], "lon": t["lon"], "main_job": jobs[t["id"]],
             "mean_slope_deg": t["terrain"]["mean_slope"], "p90_slope_deg": t["terrain"]["p90_slope"], "height_range_50km_m": t["terrain"]["relief"],
             "roughness_m": t["terrain"]["rough"], "rocks": t.get("rock", {}).get("label"),
             "water_made_minerals": ",".join(t.get("minerals", {}).get("families", [])) or None, "minerals_source": t.get("minerals", {}).get("source")}
        res = t.get("resources", {})
        for k in ("temp_avg_c", "temp_avg_coldest_c", "temp_max_c", "temp_max_hottest_c", "temp_min_c", "ice_surface_share", "ice_1m_share", "radius_km", "h2o_wt_pct",
                  "feo_wt_pct", "tio2_wt_pct", "th_ppm"):
            r[k] = res.get(k)
        r["resources_source"] = res.get("source")
        r["oxides_source"] = res.get("oxides_source")
        rows.append(r)
    with open(OUTD / "targets.csv", "w", newline="", encoding="utf-8") as fh:
        wr = csv.DictWriter(fh, fieldnames=list(rows[0]))
        wr.writeheader()
        wr.writerows(rows)
    full = [{k: t[k] for k in t if k not in ("light", "light_month")} | {"main_job": jobs[t["id"]]} for t in m["targets"]]
    (OUTD / "targets.json").write_text(json.dumps(full, indent=1, ensure_ascii=False), encoding="utf-8")

    # ------------------------------------------------------------- sites
    with open(OUTD / "known_sites.csv", "w", newline="", encoding="utf-8") as fh:
        wr = csv.writer(fh)
        wr.writerow(["id", "name", "lat", "lon", "worlds", "jobs"])
        for sid, name, la, lo, worlds in KNOWN_ANALOGS:
            wr.writerow([sid, name, la, lo, worlds, KNOWN_JOBS[sid]])
    with open(OUTD / "validation_sites.csv", "w", newline="", encoding="utf-8") as fh:
        wr = csv.writer(fh)
        wr.writerow(["id", "name", "lat", "lon", "world", "jobs", "programme_or_source"])
        wr.writerows(VALIDATION_SITES)

    # ------------------------------------------------------------- AI twins
    tw = []
    for body in ("moon", "mars"):
        z = np.load(ROOT / "kaggle" / "_out" / "k3_ssl" / f"{body}_twins.npz")
        ll, cell = z["ll"], z["cell"].astype(np.int64)
        k = len(ll)
        tw.append(table({
            "body": [body] * (k * 5), "lat": np.repeat(ll[:, 0], 5).astype(np.float32), "lon": np.repeat(ll[:, 1], 5).astype(np.float32),
            "rank": np.tile(np.arange(1, 6, dtype=np.int8), k), "earth_cell": cell.ravel().astype(np.int32),
            "earth_lat": g.lat[cell.ravel()].astype(np.float32), "earth_lon": g.lon[cell.ravel()].astype(np.float32),
        }))
    tw = pa.concat_tables(tw)
    pq.write_table(tw, OUTD / "ai_twins.parquet", compression="zstd")
    print(f"ai_twins.parquet: {tw.num_rows} rows")

    shutil.copy(ROOT / "public" / "data" / "validation.json", OUTD / "validation.json")
    shutil.copy(Path(__file__).resolve().parent / "dataset_card.md", OUTD / "README.md")
    for f in sorted(OUTD.iterdir()):
        print(f"  {f.name:24s} {f.stat().st_size / 1e6:6.2f} MB")

    if "--push" in sys.argv:
        import os

        from huggingface_hub import HfApi

        api = HfApi(token=os.environ["HF_TOKEN"])
        api.create_repo(REPO, repo_type="dataset", exist_ok=True)
        api.upload_folder(folder_path=str(OUTD), repo_id=REPO, repo_type="dataset",
                          commit_message="ShadowAstra Atlas open dataset (site v0.7: Diviner day and night for every Moon target, Lunar Prospector oxides, pinpoint test)")
        print(f"pushed: https://huggingface.co/datasets/{REPO}")


if __name__ == "__main__":
    main()
