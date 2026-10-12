# ShadowAstra Atlas: master plan (v2)

**Team ShadowAstra · Dhaka, Bangladesh · NASA Space Apps Challenge 2026**
Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

> **One line:** ShadowAstra Atlas tells a mission team *where* on Earth to rehearse a specific Moon or Mars task, *when* to go, *how close* a credible site is, and *what the rehearsal can never prove*. It does this with open NASA data compared at the same physical scale and under the same Sun.

---

## 1. The problem, precisely

The challenge text names four selection factors (**topography, geology, environment, resources**) and one gap:

> "…terrestrial analog sites are not entirely well characterized. Your challenge is to use open Earth, Moon, and Mars data from NASA and other space agencies to identify and characterize new terrestrial analogs…"

That gap has three parts:

| Gap | What happens today | Consequence |
|---|---|---|
| **Characterization** | Analogs are chosen by reputation ("Atacama is Mars-like"). | A site can look right and still test the wrong thing. We call this the *false friend*. |
| **Discovery** | New regions aren't screened systematically against today's targets (Artemis south-pole regions, ice-rich Mars plains, cave skylights). | Better or closer sites stay unknown. |
| **Access** | The famous sites are far from most of the world's students and researchers. | Analog science stays concentrated, and every trip has a carbon cost. |

## 2. What makes us different (novelty)

| # | Idea | Why it is new | Status |
|---|---|---|---|
| 1 | **Mission-conditioned matching** | The same Earth site scores differently for *traverse*, *ice prospecting*, *ISRU*, *caves* and so on. Weights are explicit and adjustable. There is no universal "Mars-likeness". | ✅ live |
| 2 | **Terrain Twins** | Real Earth (SRTM), Moon (LRO LOLA) and Mars (MGS MOLA) elevation resampled onto **one shared grid** at the coarser native spacing, then compared in 3D at the same scale. | ✅ live (preview DEMs) |
| 3 | **Shadow Lab** | A horizon-method illumination model turns a lunar-polar Sun (≈1–2° elevation) around *both* terrains and maps never-lit ground, a proxy for cold traps. The name ShadowAstra is the method. | ✅ live |
| 4 | **Light Twin calendar** | Solar geometry finds the months when an Earth site's Sun-angle distribution best matches the target (earth-mover distance). Example: McMurdo Dry Valleys in **August**, as the Sun returns from polar night and skims the horizon the way it does at Shackleton. | ✅ live |
| 5 | **Rehearse closer** | From any team's home city, the tool ranks the nearest *credible* analogs and shows distance and an indicative CO₂e estimate. This makes analog science global and lower-carbon. | ✅ live |
| 6 | **Honest evidence** | Every parameter is tagged **Computed**, **Demo** or **Reality gap**. Gravity, vacuum and radiation are shown next to every score and never folded into it. | ✅ live |
| 7 | **Astra, the field-test astronaut** | A mascot whose visor works as a HUD. It reacts to results (happy at a high match, sad at a low one, scanning while loading) to make the uncertainty easy to feel. | ✅ live |
| 8 | **Stewardship flags** | Protection status (Antarctic Treaty, national parks, sacred and Indigenous land) is shown before any trip planning. | ✅ live |

## 3. Product map

| Page | Purpose | Status |
|---|---|---|
| **Home** | Ten-chapter story from Earth to Moon to Mars, with Astra in every chapter. | ✅ |
| **Atlas** | 3D globes plus 12 live NASA map layers for three bodies; task filters; site detail; screening queue. | ✅ |
| **Analog Lab** | Flagship: Terrain Twins, Shadow Lab, Analog Fit, Light Twin, imagery swipe, sustainability, reality gaps, auto-summary. | ✅ |
| **Data & Method** | Pipeline, scoring model, task weights, source registry (NASA, ESA, JAXA, ISRO). | ✅ |
| **About** | Team, the meaning of the name, mapping to all 10 award categories, timeline. | ✅ |
| Site Passport (export) | One-page field protocol with best season, gaps, permits and lineage. | ⏳ hackathon |
| Screening results | New candidates in the 8 queued regions, with abstention. | ⏳ hackathon |
| Classroom mode (Bangla/English) | Guided lessons on the "false friend" and the Shadow Lab. | ⏳ after hackathon |

## 4. Scoring model

Six parameters, taken from our methodology sheet:

| Parameter | Measured from (target) | Measured from (Earth) | Today | Hackathon |
|---|---|---|---|---|
| Topography | LOLA / MOLA DEM → slope histogram + relief | SRTM / NASADEM | **Computed** (8-bit preview DEMs) | Full-precision LOLA 5–20 m polar, HiRISE 1 m, NASADEM 30 m |
| Lighting | Solar geometry at target latitude, plus horizon shadows | Solar geometry, plus horizon shadows | **Computed** | Add LOLA illumination maps for validation |
| Geology | LROC / CRISM / THEMIS products | EMIT minerals, HLS, geologic maps | Demo | Feature vectors from EMIT + CRISM where sensor-compatible |
| Temperature | Diviner (Moon), THEMIS / MCS (Mars) | MODIS LST day and night | Demo | Day–night range and minimums |
| Regolith | Diviner rock abundance, THEMIS thermal inertia | Soil and grain proxies, EMIT | Demo | Thermal-inertia analogs |
| Radiation | — | — | **Reality gap** (never scored) | Shown with measured numbers |

- **Topography** = 0.65 × slope-histogram overlap + 0.35 × relief agreement (log-ratio). Both are computed on the shared grid after identical smoothing.
- **Lighting** = 1 − W₁ / 25°, where W₁ is the Wasserstein distance between daylight Sun-elevation distributions in the best month.
- **Analog Fit** = Σ wᵢ·vᵢ / Σ wᵢ over available parameters, with weights from the mission task. We also report the share of the score that is computed.
- Bands: ≥ 0.75 high · 0.50–0.74 medium · < 0.50 low.

## 5. AI / ML plan (what we will train)

1. **Physical baseline** (must be beaten): multi-scale slope, curvature, roughness and relief distributions, then a distance plus a LightGBM LambdaRank ranker.
2. **Terrain encoder**: a small CNN/ViT on matched-scale DEM patches from all three bodies (Earth NASADEM, Moon LOLA, Mars HiRISE/CTX/HRSC). It is pre-trained self-supervised (SimCLR / masked-patch) so geometry becomes body-agnostic, then fine-tuned on task-specific pairs.
3. **Mission-conditioned ranker**: terrain embedding + Earth context (EMIT, HLS, LST; optional frozen Prithvi-EO-2.0 features) + mission token → relevance score.
4. **Uncertainty and abstention**: deep ensembles plus conformal prediction. If coverage is missing, the output is "insufficient evidence".
5. **Labels**: known analog–target pairs from the literature (positives), hard negatives (looks right, tests wrong), and expert pairwise judgements. Splits are by region, with buffers, so there is no leakage.
6. **Evaluation**: nDCG@5/10, expert agreement, coverage–abstention curves and per-domain breakdown (desert, polar, volcanic). Compute runs on Kaggle T4 ×2, with versioned notebooks.

## 6. Data sources (open)

**NASA**: GIBS (Blue Marble, MODIS, ASTER GDEM, VIIRS Black Marble, LST), Solar System Treks (LROC WAC, LOLA DEM/shade, Viking MDIM, MOLA, THEMIS), SRTM/NASADEM, EMIT, HLS, LRO Diviner, MRO HiRISE/CTX/CRISM.
**Other agencies**: ESA Copernicus DEM, Mars Express HRSC; JAXA SELENE/Kaguya; ISRO Chandrayaan-2 OHRC/DFSAR. Elevation tiles come from AWS Open Data Terrain Tiles (SRTM-derived).

## 7. Sustainability and ethics

- **Fewer trips**: screen remotely, then send people only to the shortlist. The Lab shows each trip's footprint (indicative 0.15 kg CO₂e per passenger-km).
- **Closest credible analog**: the default city is Dhaka, and any team can pick its own.
- **Stewardship**: protected, sacred and Indigenous land is flagged. Consent comes before coordinates, and sensitive sites can be blurred.
- **Open science**: code, method and data lineage are public, so the tools reach places that can't fund expeditions.

## 8. How we meet every award category

| Award | Evidence a judge can open |
|---|---|
| Best Use of Science | Mission-conditioned scoring, matched-scale terrain stats, shadow model, reality gaps |
| Best Use of Data | 12 live NASA layers plus LOLA, MOLA and SRTM elevation; ESA, JAXA and ISRO in the pipeline; per-value provenance |
| Best Use of Technology | WebGL Terrain Twins, browser-side illumination, three-body GIS, trainable ranker |
| Galactic Impact | A reusable where / when / what-not answer for analog field campaigns |
| Best Mission Concept | "What mission can we test here?", turned into a passport with a best season |
| Most Inspirational | Astra's journey: success and honest failure |
| Best Storytelling | Earth → Moon → Mars; the false friend; light and shadow |
| Global Connection | Rehearse-closer from any city; search anywhere on Earth |
| Art & Technology | NASA-mosaic globes, sunlight-and-shadow palette, premium motion |
| Local Impact | Dhaka STEM workshop, Bangla classroom mode, a university pilot |

## 9. Roadmap

| Phase | When | Deliverables | Done when |
|---|---|---|---|
| 0 Preliminary | Oct 2026 | Film ✅, this prototype ✅ | Judges can open Lab, Atlas and Method |
| 1 Data | Before the hackathon | Download full-precision DEMs for 6 targets and 12 regions; feature pipeline | Slope stats reproducible from a notebook |
| 2 Hackathon | Nov 2026 | Baseline ranker, screening of the queued regions, passport export, Video 2 | One new candidate fully characterized, or honestly rejected |
| 3 Model | After baseline | Terrain encoder plus ranker; benchmark against baseline | Beats baseline on held-out regions |
| 4 Impact | Ongoing | Expert review, Dhaka workshop, open dataset | Feedback is recorded and claims are revised |

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| 8-bit preview DEMs quantize relief | Labelled as preview. Full-precision PDS DEMs come in Phase 1, and stats are re-computed. |
| Demo values mistaken for results | Tagged "Demo" everywhere; the computed share of each score is shown. |
| Tile services slow during judging | Static texture fallbacks, cached tiles, a poster image before WebGL loads. |
| Over-claiming discovery | Known sites are calibration controls. New candidates need evidence or get abstention. |
| Site sensitivity | Stewardship flags and location blurring where needed. |

## 11. Team responsibilities

| Member | Owns |
|---|---|
| Abdullah Rubab | Leads the team: scope, architecture, integration, submission |
| Tanvir Hossin | Researches planetary terrain: Moon/Mars targets and products |
| Mohammad Saniul Alam | Designs the experience: maps, Lab and interaction |
| Tasnuva Arif | Development and testing; narration |
| Md. Tanvir Hasan | Validates the science: splits, baselines, checks |
| Mohammed Mahmud Parvez | Edits the film; motion language |

## 12. v0.3 additions (preliminary round)

- **Ask Astra:** an on-page assistant that answers from our catalogue, Sun maths and distance maths (no language model, no invented facts). It is page-aware and links straight into the Lab.
- **Guided Lab:** numbered steps (① Earth site, ② target, ③ task), one-click quick pairs, a floating section dock, coach tips, deep links (`/lab#geology`) and a badge legend.
- **Light mode:** a warm paper theme with its own accent colours. Space scenes stay dark. Dark is the default.
- **Branded loading:** an orbit-mark splash on first visit and a compact orbit loader between pages.
- **Plain English:** simpler copy across the site.
- **Real team portraits** on Home and About.
