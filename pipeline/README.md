# ShadowAstra Atlas data pipeline

This folder rebuilds `public/data/`: every land area on Earth (0.5° cells, about 55 km), measured with open NASA data and compared with 18 Moon and Mars targets at the same physical scale, plus the test results the How it works page shows. The website loads these files and does all scoring in the browser.

Steps 1 to 6 need no logins. Step 17 needs a free NASA Earthdata token, the Kaggle steps need the team's token files (see `docs/HANDOFF.md`). Every download is cached in `pipeline/.cache/` (about 1 GB, ignored by git), so a rerun only fetches what is missing.

```bash
pip install -r pipeline/requirements.txt
cd pipeline
python s01_gibs.py      # MODIS land cover, NDVI, day/night ground temperature, snow (NASA GIBS)   ~5 min
python s02_power.py     # NASA POWER climatology: air temperature, rain, humidity, sunshine          ~40 min
python s03_terrain.py   # slopes, height range, roughness for every land cell (AWS Terrain Tiles)  ~20 min
python s04_context.py   # volcanoes (Smithsonian GVP), impact craters, Natural Earth names          ~2 min
python s05_targets.py   # Moon/Mars targets from full-precision LOLA and MOLA + sunlight table     ~3 min
python s17_emit.py      # NASA EMIT L3 minerals on our grid (needs the EMIT file, see the script)   ~10 s
python s20_target_resources.py  # Diviner (every Moon target), Lunar Prospector oxides, Odyssey GRS  ~5 min
python s06_build.py     # indicators, learned ensemble + hold-out test, export to public/data      ~12 min
python s19_k3_export.py # Kaggle K3 terrain AI: shape.bin, AI twin bands, its tests                ~10 s
python s14_validate.py  # every test on the website's own files → validation.json                ~40 min
python s16_model_zoo.py # adds the Kaggle K5 nine-model comparison to validation.json               ~1 s
python s23_pinpoint.py  # best 10 km spot: test on the 66 field sites → validation.json "pinpoint"    ~8 min
python s22_parity_fixture.py    # tests/fixtures/parity.json, so the browser can be checked against Python ~1 min
python s24_review.py kit        # expert review kit for the top 20 candidates (docs/review)          ~4 min
python s21_open_dataset.py      # the open dataset (add --push with HF_TOKEN set to publish)          ~1 min
```

Optional: `s18_minerals_test.py` (run with `SA_MINERALS=1`, ~16 min) decides whether EMIT minerals join the learned model. They did not help, so `s06_build.py` leaves them out by default.

Target facts only (no score changes): `python s20_target_resources.py --patch-grid` writes the new facts straight into `public/data/grid.json` without rerunning the 12 minute `s06_build.py`. When the expert review comes back: `python s24_review.py import review_sheet.csv` → `public/data/review.json`.

## What each step does

| Step | Source | Output |
|---|---|---|
| `s01_gibs.py` | NASA GIBS WMS images of MODIS products, turned back into numbers with the official GIBS colormaps | land cover fractions, NDVI, LST day/night, snow |
| `s02_power.py` | NASA POWER regional climatology (MERRA-2), one parameter per request, 10° boxes | T2M, T2M_MIN, T2M_MAX, PRECTOTCORR, RH2M, ALLSKY_SFC_SW_DWN |
| `s03_terrain.py` | AWS Terrain Tiles (SRTM based) | slope histogram (8 bins), mean and 90th percentile slope, relief (2nd to 98th percentile), roughness |
| `s04_context.py` | Smithsonian GVP, Earth Impact Database selection (`catalogue.py`), Natural Earth | distance to volcano, impact score, country, region, nearest town |
| `s05_targets.py` | USGS Astrogeology 16-bit LRO LOLA (118 m) and MGS MOLA (463 m) GeoTIFFs, read with HTTP range requests | target terrain statistics, best-month sunlight match per Earth latitude |
| `s17_emit.py` | NASA EMIT L3 Aggregated Mineral Spectral Abundance 0.5° v002 (LP DAAC) | `.cache/emit.npz`: 11 minerals and 4 families (clays, sulfates, carbonates, iron oxides); EMIT cells sit a quarter cell off ours, so each of our cells averages the four it overlaps |
| `s20_target_resources.py` | LRO Diviner polar resource product (PDS, HTTP range reads within 10 km of each south-pole target); Diviner global temperatures (Williams et al. 2017, 0.5° x 96 times of day, the 3 x 3 cells around each of the other Moon targets); Lunar Prospector GRS oxides and thorium (2° map); Mars Odyssey GRS H₂O 5° map. SWIM ice (swim.psi.edu) is not included: the site was down on 25 Oct 2026 and serves files only through a form | `.cache/target_resources.json`: ground temperatures (day and night away from the pole) and stable-ice shares (Moon), FeO, TiO₂ and Th (Moon), water in the topsoil (Mars) |
| `s06_build.py` | everything above + `catalogue.py` known sites | `grid.bin` (typed arrays) and `grid.json` (layout, names, targets with minerals and resources, model test, confidence limits) |
| `s19_k3_export.py` | Kaggle K3 outputs (`kaggle/_out/k3_ssl`) | `shape.bin` (terrain AI similarity per target), `terrain/{moon,mars}/tNN.bin` (5 AI twins per 1° cell), its tests |
| `s14_validate.py` | the website's own data files | `validation.json`: independent sites, known sites, model share, jobs, robustness, ablations, terrain AI in the full score, EMIT mineral term |
| `s22_parity_fixture.py` | the website's own data files, scored by `s14_validate.py` | `tests/fixtures/parity.json`: 28 target and job combinations over 300 places, mineral percentiles and confidence levels; `tests/unit/parity.test.ts` checks the browser against it |
| `s23_pinpoint.py` | AWS Terrain Tiles (SRTM) on the same 1.19 km grid, NASA MODIS water mask (MOD44W on GIBS) | `validation.json → pinpoint`: where the 10 km window holding each of the 66 field sites ranks (result: 42% on average, chance 50%, sign test p = 0.13, so a hint, not a prediction); `tests/fixtures/pinpoint.json` for the browser twin |
| `s24_review.py` | the website's own data files, `s23` for the 10 km spot | `docs/review/EXPERT_REVIEW_KIT.md`, `docs/review/review_sheet.csv`, `public/data/review.json` (pending until the ratings come back) |

## Same scale everywhere

Every footprint, on Earth, the Moon or Mars, is a 50 km square resampled to 42 × 42 points (1.19 km apart) with an azimuthal equidistant projection on that body's own radius, smoothed the same way. `terrain_lib.py` is a NumPy twin of `src/lib/terrain.ts`, so numbers match the website.

## The learned model and its test

- Positives: 38 known analog field sites in `catalogue.py` (NASA, ESA, CSA and university campaigns). Everything else is unlabelled background.
- Model: the Kaggle K5 winner, a rank-average of tuned XGBoost, tuned LightGBM and logistic regression, with positive-unlabelled bagging (4 bags of 6,000 background cells while testing, 8 for the shipped model). Physical features only: no cities or farmland.
- Confidence: the share of real (not gap-filled) measurements, and how much the single runs (3 models × 8 bags) disagree about a place.
- Test: for each known site, hide it and every other known site within 300 km, retrain, and record its rank among all 80,206 land cells. The same test is run for a simple hand-weighted rule. `s14_validate.py` adds 28 published sites never used for training.

Results are written into `grid.json` (`evaluation`) and `validation.json`, and shown on the website (How it works, Find new sites).

## Rule for new data

New data only changes the score if it ranks the known sites better (the independent sites are reported, never used to choose). Otherwise it is shown as a fact. EMIT minerals as a model input and the terrain AI in the full score both went through this rule; see `validation.json` → `minerals` and `terrain_ai`.

## Swapping in the official 2026 datasets

The challenge datasets from NASA and partner agencies are released on 28 October 2026. Each source here is one script with one output per variable on the shared 360 × 720 grid (`common.save`), so a new dataset only needs a new `sNN_*.py` that writes its arrays, plus a line in `s06_build.py`.
