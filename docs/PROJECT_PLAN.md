# ShadowAstra Atlas: master plan v4

**Team ShadowAstra · Dhaka · NASA Space Apps Challenge 2026** · status on 24 Oct 2026 · replaces v3 (see git history)

> **One line:** tell us your mission and your limits; we search every place on Earth, compare it with the Moon or Mars spot you care about using NASA data from all three worlds, and hand you a field-ready report on the best new test sites, with the evidence and the doubts.

---

## 1. What the challenge asks, and where we stand

> "Selecting future landing sites and lunar base locations depends on many factors, including **topography, geology, environment, and available resources**… use open **Earth, Moon, and Mars** data from NASA and other space agencies to **identify and characterize new terrestrial analogs for future bases or landing sites**, drawing on **deserts, polar regions, volcanic and arid terrains, caves**, and other environments…"

| The challenge needs | Status (24 Oct) | Still to do |
|---|---|---|
| Topography | Done: 50 km slope histogram and height range on all three worlds; Moon and Mars measured everywhere at 0.5° (Kaggle K1) | 10 km "pinpoint" inside a candidate |
| Geology | Volcano and crater proximity scored; GLiM rock type shown for every place; Mars TES minerals, geology units, craters and caves in `pipeline/.cache` | Score rock types with a finer rock map (0.5° dominant class tested worse); EMIT minerals (needs an Earthdata token) |
| Environment | Night cold, day and night swing, dryness, Sun angle by month | Diviner temperatures for the Moon side (K1b path broken) |
| Resources | Bare dry ground, ice and snow | Mars ground ice (SWIM), Moon hydrogen; Odyssey GRS maps downloaded but not used yet |
| Bases **and landing sites** | Done: nine jobs including "Test a landing" | |
| Caves | Lava-tube job; Mars MGC³ caves and LROC lunar pits downloaded | Show caves and pits as Maps layers |
| **Characterize** | Done: place report, printable site report, compare up to four, confidence badges | |
| **New** analogs | Done: mission builder with the team's own limits; known sites left out by default | |

## 2. What the website does today

| Page | What it does |
|---|---|
| **Find new sites** `/discover` | Mission builder: destination (Moon or Mars), job, needs in plain words (home city, distance, town, altitude, month, Antarctica, only new), a visible search of all 80,206 land places, ten distinct results with satellite thumbnails, relaxation hints, compare up to four, place report with a close-up map, confidence badge and rock type, printable `/report`. |
| **Maps** `/atlas` | Earth, Moon and Mars globes and live NASA layers; sharper imagery as you zoom (Esri on Earth, CTX 5 m on Mars, Kaguya on the Moon); **Earth twins of any spot**: tap the Moon or Mars. |
| **Compare** `/lab` | Any Earth place next to a Moon or Mars target at the same scale: maps (side by side or swipe), match medallion, 3D terrain twins, slope and profile, geology plates, light twin, shadow map, travel CO₂, what Earth can't copy. |
| **How it works** `/methods` | Dot-globe hero, the four factors with real numbers, a scroll story for Jezero, the proof (independent sites, model-share curve, job test, ablations, robustness, nine-model comparison, failures), every dataset. |
| **Learn** `/learn` | Classroom lessons, a quiz scored with real data, a printable worksheet, in English, Spanish and বাংলা. |
| **Home**, **Team** | Entry points, town checker, Earth-or-Mars game, Astra, the team. |

## 3. Science, with the numbers

- **Data engine** (`pipeline/`): 80,206 land cells at 0.5° from NASA POWER, MODIS (GIBS), SRTM terrain tiles, Smithsonian GVP, impact craters, Natural Earth, GLiM. Targets from full-precision LOLA 118 m and MOLA 463 m.
- **Score:** five factors weighted by the job, plus a positive-unlabelled LightGBM trained on 38 known sites, which counts for **60%** (chosen on the known sites only, see `validation.json → mixing`).
- **Tests** (`pipeline/s14_validate.py`):
  - Hidden known sites (each site and its neighbours within 300 km hidden, model retrained): top **2.2%** of land.
  - 28 published sites never used for training: top **21%** (Moon sites top 5.2%); a simple rule manages top 40%.
  - Mission factors alone: top 41%. They explain and tune the result; they don't find the sites on their own.
  - Choosing a site's real job ranks it higher for **78% of 78 sites** (p < 0.001).
  - ±25% weight noise keeps 8 to 10 of the top 10 places.
  - Rocks & craters is the factor that matters most; bare, dry ground pulls famous volcano and crater sites down.
- **Model zoo** (Kaggle K5, 3 h CPU): an **ensemble of tuned XGBoost, tuned LightGBM and logistic regression** gives hidden known sites top **1.2%** and the 28 new sites top **14.7%**, better than the LightGBM on the site (2.4% / 20.0%). nnPU failed (30.7%) and is reported as such.

## 4. Roadmap, in priority order

1. **Ship the K5 ensemble** as the site's learned model: write `kaggle/_out/k5_models/k5_model_{moon,mars}.npy` into `grid.bin` (`model_moon`, `model_mars`), teach `s14_validate.py` to use the same ensemble when it retrains around independent sites, rerun s14, check How it works.
2. **K3 terrain transformer** (re-pushed 24 Oct with batch 64 after running out of memory): when it completes, fetch `k3_eval.json`, `shape_ssl.npz` and `*_twins.npz`. Ship it only if it beats the formula on the known and independent sites; then it can replace `public/data/shape.bin` and improve the twin finder.
3. **Official challenge datasets** (released 28 Oct): read the Resources tab, add each as a `pipeline/sNN_*.py` step.
4. **Resources factor on the target side:** Mars SWIM ice and Odyssey GRS hydrogen, Moon Diviner and Lunar Prospector (fix the K1b PDS paths), so "Ice & loose ground" compares real values on both worlds.
5. **Finer rock types** (GLiM vector or 0.1° fractions) and EMIT minerals, then re-test rock scoring.
6. **Pinpoint**: the best 10 km spot inside each 55 km candidate (Earth terrain tiles at higher zoom).
7. **Expert review** by Md. Tanvir Hasan of the top 20 candidates with a short rubric; show it on How it works.
8. Fresh README screenshots of the new pages; the video; a new portrait for Mohammed Mahmud Parvez.

## 5. What the team needs to provide

- **Kaggle:** done. Tokens live in `D:\NASA_space_apps_challenge_2026\_secrets\kaggle1` and `kaggle2` (see `docs/HANDOFF.md`). Use a VPN if kaggle.com doesn't load on your network.
- **NASA Earthdata token** (free) for EMIT minerals: add it to Kaggle as a secret named `EARTHDATA_TOKEN` on account 2. Never paste it in chat.
- **Bangla and Spanish proofreading** of the Learn page.
- **Expert review:** Md. Tanvir Hasan, 1 to 2 hours on the top candidates.

## 6. Sources consulted

Challenge page (spaceappschallenge.org) · ESA CAFE *Catalogue of Planetary Analogues* (Preston, Grady, Barber 2012) · Europlanet field sites · Austrian Space Forum AMADEE campaigns · ISRO HOPE (Tso Kar) · Apollo geology training sites · NASA Perseverance team at Lake Salda · USGS MGC³ caves · LROC lunar pits · Robbins crater databases · USGS SIM 3292 Mars geology · MGS TES maps (ASU) · USGS CTX Exploration Zones · GLiM (Hartmann & Moosdorf 2012) · NASA Trek (CTX, Kaguya) · DINO (Caron et al. 2021) · nnPU (Kiryo et al. 2017).
