# ShadowAstra Atlas: master plan v3

**Team ShadowAstra · Dhaka · NASA Space Apps Challenge 2026** · written 23 Oct 2026 · replaces v2 (see git history)

> **One line:** tell us your mission and your limits; we search every place on Earth, compare it with the exact Moon or Mars spot you care about using NASA data from all three worlds, and hand you a field-ready report on the best new test sites, with the evidence and the doubts.

---

## 1. What the challenge actually asks (re-read 23 Oct)

> "Selecting future landing sites and lunar base locations depends on many factors, including **topography, geology, environment, and available resources**… use open **Earth, Moon, and Mars** data from NASA and other space agencies to **identify and characterize new terrestrial analogs for future bases or landing sites**, drawing on **deserts, polar regions, volcanic and arid terrains, caves**, and other environments…"

| The challenge needs | v0.4 had | Gap | v5 answer |
|---|---|---|---|
| Topography | 50 km slope/relief stats, Earth vs 18 targets | targets are single points | Moon and Mars **global grids**; any spot can be a target; a 10 km "pinpoint" inside each candidate |
| Geology | distance to volcanoes and craters | no rock types, no minerals | Earth **GLiM rock types**, **EMIT minerals** (hematite, gypsum, clays, carbonates), salt flats; Moon mare/highland + FeO; Mars basalt, sulfate, clay, iron-oxide context; crater density on all three |
| Environment | cold, heat swing, dryness, Sun angle | Moon/Mars side not measured | Moon Diviner temperatures, Mars TES thermal inertia and albedo; month-by-month light and cold |
| Resources | none | missing factor | water ice (Earth permafrost/glaciers ↔ Mars SWIM ice ↔ Moon hydrogen/shadow), regolith materials, sunlight for power |
| Moon and Mars data | 18 points of LOLA/MOLA | thin | global grids from LOLA, MOLA, TES, Diviner, Kaguya, Lunar Prospector, SWIM, cave and crater catalogues |
| Bases **or landing sites** | jobs only for bases and science | landing missing | new job "Test a landing" (hazard detection, terrain navigation, plume and dust) |
| Caves | lava-tube job, no cave data | missing | Mars cave candidates (USGS MGC³, 1,000+), lunar pits (LROC), Earth karst and young basalt fields |
| **Characterize** | short place report | no full dossier | **Site report**: the four factors side by side with real values on both worlds, confidence, best months, access, permits, limits; **PDF download** |
| New analogs | ranked list | no user requirements | **Mission builder**: the user's own requirements filter and rank the planet |

## 2. Honest diagnosis of v0.4 (owner review, 23 Oct)

1. **Find new sites is confusing.** It opens with results already computed, so a visitor doesn't know what was searched or what to do. It must start from the user's needs and *show* the search.
2. **Not enough science.** A single tabular model and one CPU-trained encoder that lost to the formula. No independent test set, no uncertainty, no ablations.
3. **Pages look plain.** Maps, Compare and How it works lack hero moments, real imagery in cards, and motion where it matters.
4. **Planned features never shipped:** site passport (now "Site report"), screening with abstention, Bangla classroom mode, expert-pair labels, uncertainty.

## 3. Product v5: what a normal visitor does

### 3.1 Find a test site (the core flow, rebuilt as a guided mission builder)

1. **Start screen, no results yet.** "Where should we test? Tell us your mission, we search the whole Earth." Six ready-made missions with pictures (Artemis base camp, Mars rover drive, ice drilling, lava-tube shelter, search for life, crater training) or "Build my own".
2. **Destination.** A 3D Moon or Mars. Official targets as pins (the 9 Artemis III regions, rover and human landing sites, ice plains, cave skylights), or **click any spot**. A card explains what it is like there in plain words.
3. **The job.** Illustrated cards: live at a base, test a landing, drive a rover, use local soil, find ice, explore caves, search for life, study craters, work in low Sun.
4. **Your requirements** (from ESA's CAFE field-site criteria): team home city and maximum distance, travel month, reachable by road, avoid Antarctica, altitude limit, what must match (ground, rocks, climate, ice). Each control shows live "**12,431 places still possible**".
5. **The search, shown.** The globe scans, cells light up, counters run: *80,206 checked → 9,318 meet your needs → 10 best new sites*. Astra narrates.
6. **Results.** Cards with a real satellite picture, match ring, ✓ requirement checklist, top reasons, confidence. **"What is holding back better sites?"**: e.g. *"The best match is in Antarctica (0.91). Allow Antarctica to see it."*
7. **Site report.** The four factors side by side (Earth value vs target value), radar chart, **pinpoint the exact spot** (10 km search inside the cell), best months, travel and CO₂, protection, what Earth can't copy, suggested field tests, data sources. **Download PDF.** Compare in 3D. Save.

### 3.2 Other pages

| Page | v5 |
|---|---|
| Home | Clear entry points: Plan a test mission · Check your town · Play Earth or Mars · Meet Astra. The story: Dhaka → Earth's analogs → Moon and Mars. |
| Explore worlds (Maps) | Three globes with **our data as layers** (Earth cold/dry/rock types/minerals; Moon ice/craters/pits; Mars ice/caves/thermal inertia). Click any Moon/Mars spot → "Find Earth sites for this spot". |
| Compare | Hero split view, the four factors as animated cards with values on both worlds, radar chart, 3D twins, shadow map, best months. |
| How it works | **Hero** with the planet gaining data layers as you scroll; the pipeline as an animation; validation as interactive charts; datasets as visual cards. Short text. |
| Learn (new) | Four short interactive lessons for schools (What is an analog? Why the lunar south pole? Looks alike is not enough. Find your own analog). **English and বাংলা.** |
| Team | As now. |

### 3.3 Novel ideas (what nobody has put together)

1. **Requirement-driven global analog search**: mission + destination + the team's real limits, over every land area on Earth, live in the browser.
2. **One shared feature space for three worlds** built from open NASA data at a matched 50 km scale: ground shape, rocks and minerals, thermal behaviour, ice, light.
3. **Any-spot targeting**: pick any point on the Moon or Mars, not a fixed list.
4. **Coarse-to-fine pinpoint**: from a 55 km candidate to the best 10 km spot inside it.
5. **"What's holding back better sites?"**: constraint-relaxation hints.
6. **Robustness and confidence**: a site that stays on top when the weights change is marked robust; uncertainty from model ensembles.
7. **Your town's twin on Mars**: reverse search from any Earth place to its most similar Moon and Mars spots.
8. **Site report PDF**: a characterization dossier a field team can use.
9. **An open benchmark**: literature analog pairs (ESA Catalogue of Planetary Analogues and others) to test any analog-finding method.
10. **Astra + Bangla**: a character-led, bilingual experience for the public and schools in Dhaka.

## 4. Science v5

### 4.1 Data (all open)

| World | Topography | Geology | Environment | Resources |
|---|---|---|---|---|
| Earth | SRTM terrain tiles at 50 km and 10 km | GLiM rock types (0.5°), EMIT L3 minerals (0.5°, needs Earthdata login), GVP volcanoes, impact craters, Natural Earth salt flats and glaciers, karst (WOKAM) | MODIS ground temperature and NDVI, NASA POWER climate, snow | permafrost/glaciers, basaltic ground, evaporites and clays (EMIT), sunlight |
| Moon | LRO LOLA 118 m (global grid) | mare vs highland (FeO, Kaguya), crater density (Robbins 2018), lunar pits (LROC) | Diviner temperatures and rock abundance, solar geometry | Lunar Prospector hydrogen, permanently shadowed regions, sunlight |
| Mars | MGS MOLA 463 m (global grid) | crater density (Robbins 2012), cave candidates (MGC³), mineral context per target | TES thermal inertia and albedo, solar geometry | SWIM subsurface ice (0–60°N), GRS hydrogen |

Downloads that this network can't reach (PDS Geosciences) run on Kaggle.

### 4.2 Models (each must beat a simple baseline in the tests below, or stay optional)

| # | Model | Where | Purpose |
|---|---|---|---|
| M0 | Mission formula (transparent baseline) | browser | per-factor similarity × job weights |
| M1 | Analog-likeness, PU ensemble (LightGBM, CatBoost, logistic, RF), tuned with Optuna | local + Kaggle CPU | "does this place look like places teams already use?" |
| M2 | Pair ranker (LambdaMART) on cross-world feature differences, trained on literature feature→site pairs | local | learns how much each factor matters per feature type |
| M3 | Terrain encoder v2: multi-scale hillshade + height patches (128 px, 3 scales) from all three worlds, contrastive + domain alignment | **Kaggle T4×2** | learned ground-shape similarity |
| M4 | DINOv2 / DINOv3-SAT zero-shot embeddings of matched-scale hillshades | **Kaggle GPU** | foundation-model shape similarity |
| M5 | Fusion and uncertainty: bootstrap ensembles, conformal intervals, rank robustness | local | confidence and "robust site" badges |

### 4.3 Validation (shown on How it works as charts)

1. **Spatial hold-out** on the 38 training sites (done in v0.4), now with bootstrap confidence intervals, AUC and average precision.
2. **Independent sites never used for training** (~25): CPA-only sites (Central Australia, Barberton, Columbia River Basalts, Golden Deposit, Kamchatka, Etna, Pavilion Lake, Turpan, Yellowstone), Europlanet sites (Kangerlussuaq, Makgadikgadi, Argentinian Andes), OeWF AMADEE sites (Dhofar, Ramon crater, Armenia, Dachstein), ISRO HOPE Tso Kar (Ladakh), Kutch (Matanomadh), West Clearwater, Wadi Rum, Badain Jaran. Measure: share in the top 10% of land, median rank, vs baseline.
3. **Feature-type benchmark** from the ESA Catalogue of Planetary Analogues: for each Moon/Mars feature type (lava tubes, deltas, dunes, sulfates, impact melt…), does the method rank that feature's Earth sites above others? AUC and nDCG per method (M0–M4).
4. **Robustness**: rank stability (Kendall τ) of the top 50 under ±30% weight noise.
5. **Ablations**: remove each factor or data source; report the change.
6. **Sanity checks**: known extremes (driest, coldest) reproduced.
7. **Expert review**: Md. Tanvir Hasan reviews the top 20 candidates with a written rubric.

## 5. Phases

| Phase | Deliverables | Needs |
|---|---|---|
| **A. UX rebuild** | Mission builder, search animation, results with relaxation hints, site report + PDF, How it works hero and scrollytelling, Compare and Maps redesign, Home entry points | nothing |
| **B. Data v2** | Earth: GLiM, salt flats, glaciers, full crater list, karst, accessibility. Mars global grid: MOLA terrain, TES, MGC³ caves, craters, SWIM. Moon global grid: LOLA terrain, pits, craters, Kaguya FeO. Four-factor scoring in browser and Python | downloads (local) |
| **C. Science v2** | Independent and CPA benchmarks, model zoo (M1, M2), bootstrap, robustness, ablations | local CPU |
| **D. Deep models** | M3 encoder v2, M4 DINOv2/DINOv3 embeddings, PDS data (Diviner, Lunar Prospector, GRS) | **Kaggle keys** |
| **E. Story & reach** | Learn page, Bangla, Astra expedition animation, Your town's twin on Mars | nothing |
| **F. Official data** | Add the 28 Oct challenge datasets to the pipeline | release |

## 6. What the team needs to provide

- **Kaggle:** `kaggle.json` for account 1 at `C:\Users\user\.kaggle\kaggle.json`, account 2 at `D:\NASA_space_apps_challenge_2026\_secrets\kaggle2\kaggle.json`. Never paste keys in chat or commit them.
- **NASA Earthdata login** (free, for EMIT minerals): create `C:\Users\user\_netrc` with `machine urs.earthdata.nasa.gov login <user> password <pass>`.
- **Expert review:** Md. Tanvir Hasan, 1 to 2 hours on the top candidates.

## 7. Sources consulted (23 Oct)

Challenge page (spaceappschallenge.org) · ESA CAFE TN2 *Catalogue of Planetary Analogues* (Preston, Grady, Barber 2012) · ESA CAFE executive summary (site criteria) · MarsOz site-selection criteria · Europlanet 2024 RI field sites · OeWF AMADEE campaigns · ISRO HOPE (Tso Kar) · EMIT L3ASA user guide (LP DAAC) · USGS MGC³ cave catalogue · LROC lunar pit shapefile · SWIM ice products (PSI) · Putzig & Mellon 2007 thermal inertia · Diviner GDR · Kaguya MI FeO (USGS) · Lunar Prospector neutron maps · GLiM (PANGAEA) · Malaria Atlas Project accessibility (Weiss 2018) · Robbins crater databases · NASA Artemis III regions (Oct 2024) · arXiv 2501.08584 (Siamese network analogs, Qaidam) · findmars.space and MarScope (CTX embeddings) · DINOv2/DINOv3.
