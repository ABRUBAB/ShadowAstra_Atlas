# ShadowAstra Atlas: project plan

NASA Space Apps Challenge 2026 · Team ShadowAstra · Dhaka
Challenge: *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*

## 1. Problem

> "Selecting future landing sites and lunar base locations depends on many factors, including topography, geology, environment, and available resources … such terrestrial analog sites are not entirely well characterized. Your challenge is to use open Earth, Moon, and Mars data from NASA and other space agencies to identify and characterize new terrestrial analogs …"
> NASA Space Apps 2026 challenge summary

Two gaps follow from this:

1. **Characterization gap.** Famous analogs (Atacama, Haughton, Death Valley, Dry Valleys) are known by reputation. Their fit for a *specific* task and target is rarely measured side by side.
2. **Discovery gap.** New candidate regions are not screened systematically against the mission targets that matter now: the Artemis south-pole regions, ice-rich Mars plains and cave skylights.

## 2. Product

ShadowAstra Atlas is a web atlas that answers one question:

> **"Where on Earth can we rehearse this Moon or Mars task, and what will that rehearsal fail to reproduce?"**

| Experience | Purpose | Status |
|---|---|---|
| Home | Story, challenge, three worlds, false-friend explainer, progress | ✅ v0.1 |
| Atlas | 3D globes and 2D NASA maps of Earth, Moon and Mars; task/world filters; site detail; screening queue | ✅ v0.1 |
| Compare | Earth site vs. Moon/Mars target at matched physical scale; side-by-side or swipe | ✅ v0.1 |
| Data & Method | Pipeline, source registry, model plan, principles | ✅ v0.1 |
| Site passport | Exportable field-test protocol per candidate | ⏳ hackathon |
| Screening results | New candidate regions with evidence, uncertainty and abstention | ⏳ hackathon |

### Characterization dimensions (from the challenge text)

| Dimension | Earth evidence | Moon evidence | Mars evidence |
|---|---|---|---|
| Topography | NASADEM / ASTER GDEM / Copernicus DEM: slope, roughness, relief | LOLA DEMs, LROC NAC DTMs, Kaguya TC | MOLA, HiRISE / CTX / HRSC DTMs |
| Geology | EMIT minerals, HLS spectra, geologic maps | LROC, Diviner, Chandrayaan-2 | CRISM, THEMIS, geologic maps |
| Environment | MODIS LST, illumination geometry, aridity | Diviner temperature, LOLA illumination | THEMIS thermal inertia, climate context |
| Resources | Ground ice / permafrost, basalt feedstock | PSR ice (LCROSS, LEND), regolith | SWIM ice maps, hydrated minerals |
| Field access | Remoteness (VIIRS night lights), permits, protection status | — | — |

## 3. Method

1. **Define the rehearsal.** Mission task, target region and physical scale (for example, a 2 km rover corridor at Mons Mouton).
2. **Measure the target.** Compute slope/roughness/relief distributions at several scales, plus thermal and material context, from LOLA/MOLA/HiRISE.
3. **Screen Earth.** Tile the candidate regions. Mask vegetation, water, cloud and protected land. Compute the same features from NASADEM/HLS/EMIT/MODIS.
4. **Rank honestly.**
   - Baseline: a transparent distance over multi-scale terrain features, plus a tree ranker.
   - Our model: a compact terrain encoder trained on matched-scale DEM tiles (self-supervised, then task-pair ranking) on Kaggle T4 GPUs.
   - Optional Earth context: frozen Prithvi-EO-2.0 features, used only where validation shows a gain.
5. **Abstain when unsure.** Missing coverage or model disagreement returns "insufficient evidence".
6. **Passport.** The passport contains the test protocol, measurable outcomes, reality gaps, permissions, stewardship and full data lineage.

**Validation:** region-held-out splits, known analogs as controls, hard negatives ("looks right, tests wrong"), nDCG@k, expert pairwise agreement, and coverage–abstention curves.

## 4. Roadmap

| Phase | When | Deliverables |
|---|---|---|
| **0 · Preliminary round** | Oct 2026 | Video (≤240 s) ✅ · this repository: UI, live NASA layers for 3 worlds, catalogue, matched-scale compare ✅ |
| **1 · Data pipeline** | Before the hackathon | Source audit · DEM download scripts · feature extraction (slope, roughness, relief) for 2 targets × 8 regions |
| **2 · Hackathon weekend** | Nov 2026 | Baseline ranker · screening results for the queued regions · one complete site passport · Video 2 demo |
| **3 · Model** | After baseline | Terrain encoder on Kaggle · held-out benchmark vs. baseline · uncertainty |
| **4 · Validation** | Ongoing | Expert review · Dhaka university workshop · open dataset release |

## 5. Team responsibilities

| Member | Owns |
|---|---|
| Abdullah Rubab | Scope, architecture, integration, submission |
| Tanvir Hossin | Moon/Mars target products, task definitions, citations |
| Mohammad Saniul Alam | Design system, map & compare interaction, accessibility |
| Tasnuva Arif | Frontend QA, demo reliability, narration |
| Md. Tanvir Hasan | Earth data, splits, baseline, independent checks, security |
| Mohammed Mahmud Parvez | Film, motion, asset & credit ledger |

## 6. Principles

- No number on screen that does not come from a dataset or the pipeline.
- Known analogs are calibration controls, not "discoveries".
- Compare relief only at a matched physical scale, using each body's own radius.
- Every layer shows its instrument, resolution and provider.
- Earth cannot reproduce gravity, vacuum or radiation. We say so for every site.
- Field visits require permission, local partnership and environmental care.
