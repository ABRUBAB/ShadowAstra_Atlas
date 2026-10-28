# ShadowAstra Atlas: master plan v5

**Team ShadowAstra · Dhaka · NASA Space Apps Challenge 2026** · status on 25 Oct 2026 · replaces v4 (see git history)

> **One line:** tell us your mission and your limits; we search every place on Earth, compare it with the Moon or Mars spot you care about using NASA data from all three worlds, and hand you a field-ready report on the best new test sites, with the evidence and the doubts.

---

## 1. What the challenge asks, and where we stand

> "Selecting future landing sites and lunar base locations depends on many factors, including **topography, geology, environment, and available resources**… use open **Earth, Moon, and Mars** data from NASA and other space agencies to **identify and characterize new terrestrial analogs for future bases or landing sites**, drawing on **deserts, polar regions, volcanic and arid terrains, caves**, and other environments…"

| The challenge needs | Status (25 Oct) | Still to do |
|---|---|---|
| Topography | Done: 50 km slope histogram and height range on all three worlds; Moon and Mars measured everywhere at 0.5° (Kaggle K1); terrain AI (Kaggle K3) as a second judge and for AI twins; **best 10 km spot** inside every place (tested on 66 field sites: a slight lean, not a clear effect, so shown as a hint) | A sharper pinpoint (rim, channel and cave cues, not slopes alone) |
| Geology | Volcano and crater proximity scored; GLiM rock type shown; **NASA EMIT minerals** (clays, sulfates, carbonates, iron oxides) for every dry place, matched with the published minerals at Jezero, Gale, Meridiani and Mawrth; **Lunar Prospector iron and titanium oxide** at every Moon target | Finer rock map: blocked on data (GLiM's vector map is not openly downloadable by script; the 0.5° dominant class tested worse); Mars TES maps and geology units still only in `pipeline/.cache` |
| Environment | Night cold, day and night swing, dryness, Sun angle by month; **LRO Diviner** temperatures at all ten Moon targets (polar product at the pole, day-and-night curve from the global product elsewhere) | |
| Resources | Bare dry ground, ice and snow on Earth; **Diviner stable-ice shares** at the Moon's south pole; **Mars Odyssey GRS water** at every Mars target | Mars SWIM ice (swim.psi.edu was down on 25 Oct); Lunar Prospector hydrogen has no derived PDS map (Diviner covers the pole) |
| Bases **and landing sites** | Done: nine jobs including "Test a landing" | |
| Caves | Lava-tube job; Mars MGC³ caves and LROC lunar pits downloaded | Show caves and pits as Maps layers |
| **Characterize** | Done: place report, printable site report, compare up to four, confidence badges | |
| **New** analogs | Done: mission builder with the team's own limits; known sites left out by default | |

## 2. What the website does today

| Page | What it does |
|---|---|
| **Find new sites** `/discover` | Mission builder: destination (Moon or Mars), job, needs in plain words (home city, distance, town, altitude, month, Antarctica, only new, who judges ground shape), a visible search of all 80,206 land places, ten distinct results with satellite thumbnails, relaxation hints, compare up to four, place report with a close-up map, the best 10 km spot, confidence badge, rock type, EMIT minerals and measured Moon or Mars facts, printable `/report`. |
| **Maps** `/atlas` | Earth, Moon and Mars globes and live NASA layers; sharper imagery as you zoom (Esri on Earth, CTX 5 m on Mars, Kaguya on the Moon); **Earth twins of any spot**: tap the Moon or Mars, by formula or by the terrain AI; shareable `?spot=`. |
| **Compare** `/lab` | Any Earth place next to a Moon or Mars target at the same scale: maps (side by side or swipe), match medallion, 3D terrain twins, slope and profile, geology plates and minerals, light twin, shadow map, travel CO₂, what Earth can't copy. |
| **How it works** `/methods` | Dot-globe hero, the four factors with real numbers, a scroll story for Jezero, the proof (independent sites, model-share curve, job test, ablations, robustness, nine-model comparison, failures), **new evidence** (terrain AI, EMIT minerals, Diviner, Lunar Prospector and Odyssey for all 18 targets, the 10 km pinpoint test, the expert review), every dataset. |
| **Learn** `/learn` | Classroom lessons, a quiz scored with real data, a printable worksheet, in English, Spanish and বাংলা. |
| **Home**, **Team** | Entry points, town checker, Earth-or-Mars game, Astra, the team. |

## 3. Science, with the numbers

- **Data engine** (`pipeline/`): 80,206 land cells at 0.5° from NASA POWER, MODIS (GIBS), SRTM terrain tiles, NASA EMIT minerals, Smithsonian GVP, impact craters, Natural Earth, GLiM. Targets from full-precision LOLA 118 m and MOLA 463 m, plus LRO Diviner (south pole) and Mars Odyssey GRS facts.
- **Score:** five factors weighted by the job, plus the learned model, which counts for **60%** by default. The model is the Kaggle K5 winner: a rank-average of tuned XGBoost, tuned LightGBM and logistic regression, positive-unlabelled, trained on 38 known sites. The known sites alone would pick 90%; we keep 60% so target and job still matter, and Find lets users pick 30, 60 or 90%.
- **Tests** (`pipeline/s14_validate.py`):
  - Hidden known sites (each site and its neighbours within 300 km hidden, model retrained): learned model top **1.2%** (Moon 0.5%, Mars 2.4%); as the site scores them top **2.4%**.
  - 28 published sites never used for training: top **17.8%** as the site scores them (Moon 7.2%, Mars 25.8%), learned model alone **15%**; a simple rule manages top 40%.
  - Mission factors alone: top 41%. They explain and tune the result; they don't find the sites on their own.
  - Choosing a site's real job ranks it higher for **78% of 78 sites** (p < 0.001).
  - ±25% weight noise keeps 9 of the top 10 places.
  - Rocks & craters is the factor that matters most; bare, dry ground pulls famous volcano and crater sites down.
- **Model zoo** (Kaggle K5, 3 h CPU): the ensemble won both tests (1.2% / 14.7%) and is now the site model. nnPU failed (30.7%) and is reported as such.
- **Terrain AI** (Kaggle K3, DINO ViT-S/8 on three worlds, 2 × T4, 86 min): for ground shape alone it beats the formula on known (44% vs 62%) and independent sites (58% vs 71%) and ties on expert pairs (35% vs 34%). In the full score it adds nothing (2.8% vs 2.4%), so it is an option in Find and powers AI twins.
- **EMIT minerals:** no gain as model inputs (worse where EMIT sees); as a Mars mineral term in Rocks & craters, worse on the known Mars sites (22.4% → 22.8%) though better on the independent ones (41.3% → 38.2%). Shown as facts, not scored.

## 4. Roadmap, in priority order

Done in v0.6 (25 Oct): K5 ensemble shipped; K3 terrain AI tested and shipped (AI twins, option in Find); EMIT minerals, Diviner and Odyssey facts; fresh README screenshots; the open dataset on Hugging Face (https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas).

Done in v0.7 (25 Oct): engineering pass (`docs/ENGINEERING.md`): three memory leaks fixed, faster clicks and loads (measured before and after), slow-GPU mode, error boundaries and fallbacks, CSP and security headers, URL validation, WCAG 2.2 fixes (contrast, pause motion, focus not hidden), 67 unit tests (Python parity included) and an end-to-end suite with accessibility scans, CI, deploy smoke test and uptime check. Science: best 10 km spot with its 66-site test (`s23`), Diviner day and night for the three non-polar Moon targets and Lunar Prospector oxides for all ten (`s20`), the expert review kit (`s24`, `docs/review/`), the open dataset refreshed.

1. **Official challenge datasets** (NASA publishes the Resources tab on 13 Nov, the first day of the hackathon; the full statement came out 28 Oct): read the Resources tab, add each as a `pipeline/sNN_*.py` step, and test each under the rule for new data.
2. **Expert review**: Md. Tanvir Hasan fills `docs/review/review_sheet.csv` (1 to 2 hours, rubric in `docs/review/EXPERT_REVIEW_KIT.md`); then `python pipeline/s24_review.py import review_sheet.csv` and push. How it works shows it automatically.
3. **Mars SWIM ice** once swim.psi.edu is back (add to `s20`, facts only).
4. **Finer rock types** if the GLiM vector map can be obtained from the authors (or Macrostrat), then re-test rock scoring.
5. The video; a new portrait for Mohammed Mahmud Parvez.
6. After each data or model change, rerun `pipeline/s21_open_dataset.py --push` so the open dataset matches the site, then `node scripts/smoke.mjs`.

## 5. What the team needs to provide

- **Kaggle:** done. Tokens live in `D:\NASA_space_apps_challenge_2026\_secrets\kaggle1` and `kaggle2` (see `docs/HANDOFF.md`). Use a VPN if kaggle.com doesn't load on your network.
- **NASA Earthdata token:** done; it lives in `_secrets/earthdata_token.txt` (valid until December 2026). Never paste it in chat.
- **Bangla and Spanish proofreading** of the Learn page.
- **Expert review:** Md. Tanvir Hasan, 1 to 2 hours on the top candidates.

## 6. Sources consulted

Challenge page (spaceappschallenge.org) · ESA CAFE *Catalogue of Planetary Analogues* (Preston, Grady, Barber 2012) · Europlanet field sites · Austrian Space Forum AMADEE campaigns · ISRO HOPE (Tso Kar) · Apollo geology training sites · NASA Perseverance team at Lake Salda · USGS MGC³ caves · LROC lunar pits · Robbins crater databases · USGS SIM 3292 Mars geology · MGS TES maps (ASU) · USGS CTX Exploration Zones · GLiM (Hartmann & Moosdorf 2012) · NASA Trek (CTX, Kaguya) · DINO (Caron et al. 2021) · nnPU (Kiryo et al. 2017).
