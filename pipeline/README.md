# ShadowAstra Atlas data pipeline

This folder rebuilds `public/data/grid.bin` and `public/data/grid.json`: every land area on Earth (0.5° cells, about 55 km), measured with open NASA data and compared with 18 Moon and Mars targets at the same physical scale. The website loads these two files and does all scoring in the browser.

No logins or API keys are needed. Every download is cached in `pipeline/.cache/` (about 700 MB, ignored by git), so a rerun only fetches what is missing.

```bash
pip install -r pipeline/requirements.txt
cd pipeline
python s01_gibs.py      # MODIS land cover, NDVI, day/night ground temperature, snow (NASA GIBS)   ~5 min
python s02_power.py     # NASA POWER climatology: air temperature, rain, humidity, sunshine          ~40 min
python s03_terrain.py   # slopes, height range, roughness for every land cell (AWS Terrain Tiles)  ~20 min
python s04_context.py   # volcanoes (Smithsonian GVP), impact craters, Natural Earth names          ~2 min
python s05_targets.py   # Moon/Mars targets from full-precision LOLA and MOLA + sunlight table     ~3 min
python s06_build.py     # indicators, learned model + hold-out test, export to public/data         ~1 min
```

## What each step does

| Step | Source | Output |
|---|---|---|
| `s01_gibs.py` | NASA GIBS WMS images of MODIS products, turned back into numbers with the official GIBS colormaps | land cover fractions, NDVI, LST day/night, snow |
| `s02_power.py` | NASA POWER regional climatology (MERRA-2), one parameter per request, 10° boxes | T2M, T2M_MIN, T2M_MAX, PRECTOTCORR, RH2M, ALLSKY_SFC_SW_DWN |
| `s03_terrain.py` | AWS Terrain Tiles (SRTM based) | slope histogram (8 bins), mean and 90th percentile slope, relief (2nd to 98th percentile), roughness |
| `s04_context.py` | Smithsonian GVP, Earth Impact Database selection (`catalogue.py`), Natural Earth | distance to volcano, impact score, country, region, nearest town |
| `s05_targets.py` | USGS Astrogeology 16-bit LRO LOLA (118 m) and MGS MOLA (463 m) GeoTIFFs, read with HTTP range requests | target terrain statistics, best-month sunlight match per Earth latitude |
| `s06_build.py` | everything above + `catalogue.py` known sites | `grid.bin` (typed arrays) and `grid.json` (layout, names, targets, model test) |

## Same scale everywhere

Every footprint, on Earth, the Moon or Mars, is a 50 km square resampled to 42 × 42 points (1.19 km apart) with an azimuthal equidistant projection on that body's own radius, smoothed the same way. `terrain_lib.py` is a NumPy twin of `src/lib/terrain.ts`, so numbers match the website.

## The learned model and its test

- Positives: 38 known analog field sites in `catalogue.py` (NASA, ESA, CSA and university campaigns). Everything else is unlabelled background.
- Model: LightGBM, positive-unlabelled bagging (4 bags of 6,000 background cells). Physical features only: no cities or farmland.
- Test: for each known site, hide it and every other known site within 300 km, retrain, and record its rank among all 80,206 land cells. The same test is run for a simple hand-weighted rule.

Results are written into `grid.json` (`evaluation`) and shown on the website (How it works, Find new sites).

## Swapping in the official 2026 datasets

The challenge datasets from NASA and partner agencies are released on 28 October 2026. Each source here is one script with one output per variable on the shared 360 × 720 grid (`common.save`), so a new dataset only needs a new `sNN_*.py` that writes its arrays, plus a line in `s06_build.py`.
