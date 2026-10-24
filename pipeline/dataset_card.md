---
license: cc-by-4.0
pretty_name: ShadowAstra Atlas
language:
- en
tags:
- space
- planetary-science
- moon
- mars
- analog-sites
- geospatial
- earth-observation
- nasa
- remote-sensing
size_categories:
- 1M<n<10M
configs:
- config_name: places
  data_files: places.parquet
  default: true
- config_name: target_scores
  data_files: target_scores.parquet
- config_name: ai_twins
  data_files: ai_twins.parquet
- config_name: targets
  data_files: targets.csv
- config_name: known_sites
  data_files: known_sites.csv
- config_name: validation_sites
  data_files: validation_sites.csv
---

# ShadowAstra Atlas: every land area on Earth, measured as a Moon or Mars practice site

Where on Earth can a team rehearse a Moon base or a Mars mission? We measured all **80,206 land areas** on Earth (0.5° cells, about 55 km wide) with open NASA data, the same way we measured **18 Moon and Mars targets**, and scored every place for every target. This dataset is everything behind the [ShadowAstra Atlas](https://shadowastra-atlas.vercel.app) website, built by Team ShadowAstra (Dhaka, Bangladesh) for the **NASA Space Apps Challenge 2026**: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*.

- Live site: https://shadowastra-atlas.vercel.app
- Code and pipeline: https://github.com/ABRUBAB/ShadowAstra_Atlas (`pipeline/s21_open_dataset.py` rebuilds these files)
- Every test, explained: https://shadowastra-atlas.vercel.app/methods

## Files

| File | Rows | What it holds |
|---|---|---|
| `places.parquet` | 80,206 | One row per land area: names, measurements in real units, NASA EMIT minerals, slope histogram, 0 to 1 indicators, the learned Moon and Mars scores and a confidence level |
| `target_scores.parquet` | 1,443,708 | One row per land area and target: the match score as the website shows it for the target's main job, and each factor behind it |
| `targets.csv`, `targets.json` | 18 | The Moon and Mars targets: terrain at 50 km, main rocks, published water-made minerals, LRO Diviner and Mars Odyssey measurements |
| `ai_twins.parquet` | 648,000 | The 5 closest Earth places for every 1° cell of the Moon and Mars, from our terrain AI |
| `known_sites.csv` | 38 | Analog sites used to train the learned model, with the jobs they were used for |
| `validation_sites.csv` | 28 | Published analog sites never used for training, kept as an untouched test |
| `validation.json` | | Every test result shown on the How it works page |

Join `target_scores` and `ai_twins` (`earth_cell`) to `places` on `cell`.

## Key columns

**places**
- `cell`, `lat`, `lon`: the centre of the 0.5° cell. `country`, `region`, `nearest_town`, `nearest_town_km` from Natural Earth.
- Terrain over a 50 km square (SRTM via AWS Terrain Tiles): `elevation_m`, `height_range_50km_m` (2nd to 98th percentile), `mean_slope_deg`, `slope_share_<a>_<b>_deg` (share of ground with slopes between a and b degrees).
- Climate (NASA POWER, MERRA-2 climatology): `air_temp_*`, `rain_mm_per_year`, `humidity_pct`, `sunshine_kwh_m2_day`.
- Surface (NASA GIBS, Terra MODIS 2024): `ground_temp_hottest_day_c`, `ground_temp_coldest_night_c`, `plants_ndvi_max`, `bare_ground_share`, `snow_ice_share`.
- Context: `volcano_km` and `nearest_volcano` (Smithsonian GVP Holocene volcanoes), `impact_crater` (Earth Impact Database), `rock_type_glim` (GLiM dominant class).
- `emit_<clay|sulfate|carbonate|iron>_share`: mineral share of the ground from NASA EMIT L3 (0.5°, v002). Empty where EMIT has no clear view (plants, water, snow, cloud, towns, or beyond ±52°); 16,868 places have values.
- `indicator_*`: the 0 to 1 transforms the scores use (`dry`, `bare`, `cold`, `swing`, `airdry`, `hot`, `volcanic`, `impact`, `ice`, `remote`, `rugged`).
- `learned_moon`, `learned_mars`: percentile rank (0 to 1) from the learned model, a rank-average of tuned XGBoost, tuned LightGBM and logistic regression trained positive-unlabelled on the 38 known sites. `*_spread`: how much its 24 single runs disagree. `measured_share`: share of measurements that are real, not gap-filled. `confidence_*`: high, medium or low from those two.
- `known_site_within_150km`, `nearest_known_site_km`: whether a known test site is nearby.

**target_scores**
- `target`, `body`, `job` (the target's main job, as the website picks it first).
- `match_score` = 40% `factors_only` + 60% `learned`, as the website shows by default.
- `factors_only`: the job-weighted mean of `ground_shape` (slope histograms and height range compared with the target at the same 50 km scale, LRO LOLA 118 m or MGS MOLA 463 m), `rocks_craters`, `cold_heat`, `sunlight_angle` (Sun-height match in the best month) and `bare_dry_ground`.
- `ground_shape_ai`: the terrain AI's similarity rank for the target (an option on the website, not in `match_score`).

**targets**: `temp_avg_c`, `temp_max_c`, `ice_surface_share`, `ice_1m_share` within 10 km of the seven south-pole Moon targets (LRO Diviner polar resource product, Paige et al.); `h2o_wt_pct`, water-equivalent hydrogen in the topsoil at each Mars target (Mars Odyssey GRS, 5° map, Boynton et al. 2007); `water_made_minerals` from published CRISM, OMEGA, TES and rover results.

**ai_twins**: for each Moon or Mars cell (`body`, `lat`, `lon`), `rank` 1 to 5 and the Earth place (`earth_cell`, `earth_lat`, `earth_lon`). Made by a self-supervised vision transformer (DINO ViT-S/8) trained on Kaggle (2 × T4) with 50 km height maps from all three worlds and a domain-adversarial head.

## How good is it?

Ranks are "top X% of all land": 1% means only 1 in 100 land areas scores higher.

| Test | Result |
|---|---|
| Hidden known sites (each site and its neighbours within 300 km hidden, model retrained) | learned model top **1.2%** (Moon 0.5%, Mars 2.4%); `match_score` top **2.4%** |
| 28 published sites never used for training | `match_score` top **17.8%** (Moon 7.2%, Mars 25.8%); learned model alone 15%; a simple hand-made rule 40% |
| Scoring a site for the job it was really used for | ranks it higher for 78% of 78 sites (sign test p < 0.001) |
| Weights shifted by ±25% | 9 of the top 10 places stay |
| Terrain AI, ground shape alone | known sites top 44% vs formula 62%; new sites 58% vs 71%; expert pairs 35% vs 34% |

New data only changes the score if it ranks the known sites better. EMIT minerals did not (as a model input or as a Mars mineral term), so they are measurements here, not part of `match_score`. Details: `validation.json` and the How it works page.

## Use it

```python
import pandas as pd

base = "hf://datasets/ABRUBAB/shadowastra-atlas/"
places = pd.read_parquet(base + "places.parquet")
scores = pd.read_parquet(base + "target_scores.parquet", filters=[("target", "==", "jezero")])

best = scores.merge(places, on="cell").query("known_site_within_150km.isna()").nlargest(10, "match_score")
print(best[["region", "country", "lat", "lon", "match_score", "emit_clay_share", "emit_carbonate_share"]])
```

With 🤗 Datasets: `load_dataset("ABRUBAB/shadowastra-atlas", "places")`.

## Limits

- 55 km cells: many famous analog sites were chosen for something much smaller (an ice cave, a lake, a hot spring), so they can rank low here.
- Earth can never copy gravity, vacuum, radiation or lunar nights. The website shows these next to every score; this dataset scores only what Earth can copy.
- The Moon and Mars targets are 18 named places; `ai_twins` covers every 1° cell of both.
- Scores rank places for study. Visiting any site needs permission, local partners and care for the land; Antarctic sites need Treaty permits.

## Sources and licence

This dataset is released under **CC BY 4.0**: please credit "Team ShadowAstra, ShadowAstra Atlas (NASA Space Apps Challenge 2026)" and the original sources:
NASA POWER (LaRC); NASA GIBS and Terra MODIS; NASA EMIT L3 ASA v002 (JPL, LP DAAC, doi:10.5067/EMIT/EMITL3ASA.002); SRTM via AWS Terrain Tiles; LRO LOLA and MGS MOLA (USGS Astrogeology); LRO Diviner and Mars Odyssey GRS (PDS Geosciences); Smithsonian Global Volcanism Program; Earth Impact Database (PASSC); GLiM (Hartmann and Moosdorf 2012, CC BY); Natural Earth (public domain). NASA does not endorse this project.

## Team ShadowAstra, Dhaka

Abdullah Rubab (lead) · Tanvir Hossin (planetary terrain) · Md. Tanvir Hasan (scientific validation) · Mohammad Saniul Alam (experience design) · Tasnuva Arif (development and testing) · Mohammed Mahmud Parvez (film editing).

```bibtex
@misc{shadowastra2026,
  title  = {ShadowAstra Atlas: Earth analog sites for Moon and Mars missions},
  author = {Team ShadowAstra},
  year   = {2026},
  note   = {NASA Space Apps Challenge 2026, Dhaka},
  url    = {https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas}
}
```
