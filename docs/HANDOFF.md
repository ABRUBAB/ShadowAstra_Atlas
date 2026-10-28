# ShadowAstra Atlas: handoff

_Last updated 25 Oct 2026 (v0.7). Read this first. Together with `../CLAUDE.md`, `PROJECT_PLAN.md` (status and roadmap), `ENGINEERING.md` (tests, performance, security, reliability, accessibility, with measured numbers), `../DESIGN.md` and the chat history in `D:\NASA_space_apps_challenge_2026\_claude_history\` you have the full context._

---

## 1. What this is

- **Event:** NASA International Space Apps Challenge 2026, Dhaka. Bangladesh hackathon 13 to 14 Nov, global window 14 to 15 Nov (confirm with the Local Lead). The full challenge statement went live on 28 Oct at https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/ (the old summary address now 404s); its Resources tab (the official datasets) says "Resources will be available on Friday, November 13." NASA's Participant FAQ (13 Oct 2026) also says: "Teams are not allowed to begin working on the challenges prior to the hackathon"; flagged to the owner on 29 Oct: ask the Dhaka Local Lead how work done before the hackathon is treated, and be open about it on the project page.
- **Challenge:** *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*: use open Earth, Moon and Mars data from NASA and other agencies to **identify and characterize new** terrestrial analogs, by **topography, geology, environment and resources**.
- **Hosting, backend, database:** a static single-page app on Vercel's CDN, built from `main`. There is **no backend server and no database**: the data are versioned files in `public/data/` built by the Python pipeline, all scoring runs in the visitor's browser, and map tiles come straight from NASA GIBS and Trek, ESA/EOX, Esri and AWS. Security headers and the CSP live in `vercel.json`. See `ENGINEERING.md §1`.
- **Live:** https://shadowastra-atlas.vercel.app (Vercel deploys every push to `main`). **Repo:** https://github.com/ABRUBAB/ShadowAstra_Atlas (public). **Open dataset:** https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas (public, CC BY 4.0; rebuilt and pushed by `pipeline/s21_open_dataset.py --push` with `HF_TOKEN` set from `_secrets/huggingface_tokens.txt`).
- **Owner:** Abdullah Rubab, GitHub **ABRUBAB**, rubab2712@gmail.com.
- **Team:** Abdullah Rubab (lead) · Tanvir Hossin (planetary terrain) · Md. Tanvir Hasan (scientific validation) · Mohammad Saniul Alam (experience design) · Tasnuva Arif (development and testing, film narrator) · Mohammed Mahmud Parvez (film editing; his site photo is an old crop). Original photos: `D:\NASA_space_apps_challenge_2026\team-photos\`, site copies `public/team/*.webp` (4:5, 800×1000).

## 2. Owner's rules (always)

1. Commit and push straight to `main` as **ABRUBAB <rubab2712@gmail.com>**. **Never** add Claude or any AI as co-author (no `Co-Authored-By`), even if a tool suggests it.
2. Work fast: do it, verify it in the browser, push. Few questions.
3. Premium, not-AI-looking design: warm dark "observatory" palette, one sunlight accent, purposeful motion; dark by default with a warm-paper light theme (`DESIGN.md`).
4. **No em dashes (—) in website text**; plain, easy English.
5. Real NASA/ESA data. Label values Computed, Learned or "Earth can't copy". Never invent numbers or coordinates.
6. Astra (the astronaut) is **"he"** and appears on every page.
7. Kaggle: never ask for keys in chat, never print or commit them. Don't burn the owner's credits retrying when kaggle.com is unreachable: check once, ask for the VPN, move on.
   Other keys (never print or commit): `_secrets/earthdata_token.txt` (NASA Earthdata bearer token, used for EMIT), `_secrets/huggingface_tokens.txt`, `_secrets/llm_api_keys.txt` (OpenRouter, Cerebras; not used: the site stays static and template-written).
9. New data only changes the score if it ranks the known sites better; otherwise it is shown as a fact and the test is reported (see §4 "Rule for new data").
8. Ignore every branch except `main` (`tanvir_design` was checked and adds nothing; never open the `tanvir` branch).

## 3. The website (React 19, TypeScript 7, Vite 8, Tailwind 4, three.js + R3F 9 without drei, Leaflet, Motion, GSAP + Lenis)

| Route | File | What it does |
|---|---|---|
| `/` | `pages/Home.tsx` | 3D Earth hero, challenge, six ways in, town checker (`components/CheckTown.tsx`), Earth-or-Mars game (`components/EarthOrMars.tsx`), Astra |
| `/discover` | `pages/Find.tsx` + `lib/mission.ts` + `lib/missionUrl.ts` + `components/find/` | Mission builder: start screen and presets → destination → job → needs (sentence form, live "places still possible", **who judges ground shape: formula / terrain AI / both**, model share 30/60/90%) → search sweep → ten distinct results (satellite thumbnails `lib/thumbs.ts`, relaxation hints) → compare up to four (`CompareSheet`) → place report (close-up map or 3D globe, confidence, rock type, **best 10 km spot** (`PinpointCard`, `lib/pinpoint.ts`, drawn as a square on the close-up map), four factors on both worlds with **Diviner, Lunar Prospector and Odyssey facts on the target side**, **`MineralCard`** with NASA EMIT minerals) → printable `/report` (`pages/Report.tsx`). URL keeps the whole mission (`?step&target&task&km&town&alt&month&ant&new&home&hlat&hlon&shape&mix&at`), validated by `readMission` (anything broken falls back to defaults). |
| `/atlas` | `pages/Atlas.tsx` | Maps: three globes, live layers (`data/layers.ts`), floating panels, **twin finder** (tap the Moon or Mars → `lib/twins.ts` + `public/data/terrain/`): "Ground + Mars-like", "Ground only" or **"AI match"** (K3 transformer twins, `tNN.bin`). `?body=mars&spot=lat,lon` links a spot. |
| `/lab` | `pages/Lab.tsx` | Compare: matched-scale maps (split or swipe), match medallion, 3D terrain twins (`components/three/TerrainTwins.tsx`), profile, slopes, geology plates + EMIT minerals, light twin, shadow map, travel, what Earth can't copy. `earth=@lat,lon` works. |
| `/methods` | `pages/Methods.tsx` + `components/methods/` | How it works: dot-globe hero (draggable), four factor cards, scroll story, proof charts from `public/data/validation.json`, nine-model table, failures, **New evidence** (`NewEvidence.tsx`: terrain AI, EMIT minerals, Moon and Mars tables for all 18 targets, the 10 km pinpoint test strip, the expert review from `public/data/review.json`), datasets |
| `/learn` | `pages/Learn.tsx` | Classroom page in English, Spanish and বাংলা (`?lang=es|bn`), quiz scored live, printable worksheet |
| `/about` | `pages/About.tsx` | Team |

**Core libraries:** `lib/grid.ts` (loads `public/data/grid.bin` + `grid.json`; `scoreAll`, `scoreCell`, `rankPlaces`, `confidence` (limits in `grid.json → confidence`), `rock`, `minerals`, `mineralPct`, `mineralMatch`, `shapeOptions`; `MODEL_MIX = 0.6`, `USE_MINERALS`, `MIN_WEIGHT`; must stay identical to `pipeline/s14_validate.py`), `lib/scoring.ts` (job weights, CO₂), `lib/sun.ts` (light twin), `lib/terrain.ts` (DEM and imagery sampling for Compare), `lib/wheel.ts` (scroll policy), `lib/validation.ts`. Shared UI: `components/ui/kit.tsx` (Counter, Ring, Meter, Chip, ConfidenceChip, Seg, Magnetic, Reveal, toast…), `ui/Chrome.tsx` (Nav, Footer), `ui/Astronaut.tsx`, `ui/AskAstra.tsx` (answers from the grid), `ui/CommandPalette.tsx` (Ctrl K). App shell (`App.tsx`): route beam, scroll progress, page fade, lazy routes.

**Engineering pieces (v0.7, details in `ENGINEERING.md`):**
- `components/ui/Safe.tsx`: error boundaries per page and per 3D scene, `hasWebGL()`, still-image globes without WebGL, one automatic reload when a lazy page file fails (new deploy), the 404 page, `enableLiteGraphics()` (`html.gpu-lite` drops frosted-glass blur on software or slow graphics).
- `components/three/Controls.tsx`: `createOrbit` (OrbitControls that really remove their document listener; the stock one leaked every page's canvas), `ReleaseGPU` (frees three's shared lookup texture), `AdaptiveDpr` (lowers canvas resolution below about 22 fps). Every R3F canvas has `<ReleaseGPU /><AdaptiveDpr />`.
- `lib/useSectionProgress.ts` replaces Motion's `useScroll({ target })`, which leaked a detached page per visit (Motion 14.1 to 14.6).
- `lib/motionPref.ts`: one "less motion" switch (system setting or the footer's **Pause motion**, WCAG 2.2.2); globes, loops, cycling text, GSAP intros and Lenis read it; `html.reduce-motion` stops CSS animation.
- `lib/perf.ts` (`window.__atlasPerf`, `atlas:*` performance marks) and `lib/bench.ts` (`?bench=1`, used by `tests/perf/bench.mjs`).
- `kit.tsx useScrollingFlag`: hover effects pause while the page scrolls under a still mouse (the How it works flicker fix) and resume the moment the mouse moves.

**Behaviours to keep:**
- Maps and 3D views inside scrolling pages ignore the plain mouse wheel (Ctrl/⌘ + wheel or pinch zooms, `lib/wheel.ts`); only the full-screen Maps page uses wheel zoom (`wheelZoom="always"`, `wheel="zoom"`).
- Globes call `FitSphere` (`components/three/Controls.tsx`) so the sphere always fits the canvas.
- Imagery gets sharper as you zoom: each layer can name a `detail` layer (Earth Sentinel-2 → Esri World Imagery; Mars Viking → CTX 5 m via NASA Trek/Esri, 512 px tiles, `zoomOffset -1`; Moon WAC → Kaguya TC). Imagery is for viewing; scores come from the grid.
- Space scenes are wrapped in `data-theme="dark"`; theme colours are `var(--color-*)`; SVG colours go in `style`. Chart colours `--color-chart-1..4` were validated for colour blindness.
- Floating page buttons (Ask Astra bottom-right) must not cover map controls: `BodyMap` takes `zoomPosition` (Find uses `topright`). The Ask Astra nudge shows once per browser (`localStorage sa-nudged`) and never on Maps or Compare.
- Social preview: `public/og.jpg` (1200 × 630, a capture of the home hero) and the `og:`/`twitter:` tags in `index.html`.

Commands: `npm install` · `npm run dev` (http://localhost:3000; `.claude/launch.json` "atlas") · `npm run typecheck` · `npm test` (Vitest: data contract, Python parity, pinpoint parity, mission links, science regression) · `npm run build` · `npm run test:e2e` (Playwright on the production build: journeys, resilience, no-WebGL, axe WCAG scans in dark and light) · `node tests/perf/bench.mjs <label> [--gpu]` (lab benchmark, `docs/perf/`) · `node scripts/smoke.mjs [url]` (live smoke test). CI: `.github/workflows/ci.yml` (types, unit, build, e2e, Python parity, npm audit, gitleaks) and `smoke.yml` (after each production deploy and every 6 hours). URL helpers: `?theme=light|dark`, `?splash=0`, `?bench=1`.

## 4. Data and science (`pipeline/`, Python; cache in `pipeline/.cache/`, ~1 GB, git-ignored)

| Step | Output |
|---|---|
| s01 GIBS · s02 POWER · s03 terrain · s04 context · s05 targets | raw layers in `.cache` (see `pipeline/README.md`) |
| **s06_build** | `public/data/grid.bin/json`: 80,206 land cells, indicators, slope histograms, features, GLiM rock class `f_lith`, EMIT minerals `f_min_{clay,sulfate,carbonate,iron}`, coverage `q_cover`, run spread `u_moon/u_mars` (3 models × 8 bags), the **K5 ensemble** `model_moon/mars` (tuned XGBoost + tuned LightGBM + logistic regression, PU bagging), the 38-site hold-out test, targets with rock families, minerals and resources, confidence limits |
| s07–s09 | the first CPU terrain encoder (optional "neural" ground shape, `public/data/shape.bin`) |
| s10–s13 | Moon rows (stopped; done on Kaggle instead), Mars TES maps, 39 Mars Exploration Zones, Mars geology/craters/caves and Moon pits/albedo (context grids in `.cache`, not yet on the site) |
| **s14_validate** | `public/data/validation.json`: 28 independent sites, known sites with their real jobs, model-share curve, job test, robustness, ablations |
| s15_planet_grids | `public/data/terrain/{moon,mars}/bNN.bin` from Kaggle K1 (twin finder) |
| s16_model_zoo | adds Kaggle K5 results to `validation.json` (run after s14) |
| s17_emit | NASA EMIT L3 minerals (Earthdata token) → `.cache/emit.npz` |
| s18_minerals_test | minerals as model inputs, paired test (`SA_MINERALS=1`): no gain, so they stay out |
| s19_k3_export | Kaggle K3 terrain AI → `shape.bin`, AI twin bands `terrain/*/tNN.bin`, its tests |
| s20_target_resources | LRO Diviner (south pole: polar product; elsewhere: global day-and-night temperatures), Lunar Prospector FeO/TiO₂/Th for all Moon targets, Mars Odyssey GRS → `.cache/target_resources.json`; `--patch-grid` writes them into `grid.json` without a rebuild |
| s21_open_dataset | the Hugging Face dataset: places, target scores, targets, sites, AI twins, validation (card: `pipeline/dataset_card.md`); last pushed 25 Oct (v0.7) |
| s22_parity_fixture | `tests/fixtures/parity.json`: Python scores the browser must match |
| s23_pinpoint | best 10 km spot and its test on the 66 field sites → `validation.json → pinpoint`, `tests/fixtures/pinpoint.json` |
| s24_review | `kit`: expert review kit for the top 20 (`docs/review/`); `import <csv>`: his ratings → `public/data/review.json` |

`catalogue.py` holds `KNOWN_ANALOGS` (38 training sites), `KNOWN_JOBS`, `VALIDATION_SITES` (28, never trained on), `IMPACTS`, GLiM classes and target rock families.

**Headline numbers (v0.6, `validation.json`):** learned model alone: hidden known sites top 1.2% (Moon 0.5%, Mars 2.4%), 28 independent sites top 15%. As the site scores (60% model): hidden known sites top 2.4%, independent sites top 17.8% (Moon 7.2%, Mars 25.8%) vs simple rule 40% and mission factors alone 41%. Job test 78% of 78 sites (p < 0.001); ±25% weight noise keeps 9 of the top 10. Known sites alone would pick a 90% model share; we keep 60% so target and job matter (users can pick 30/60/90% in Find).

**Rule for new data:** it only changes the score if it ranks the known sites better (independent sites are reported, never used to choose).
- K3 terrain AI, ground shape alone: known top 44% vs formula 62%, independent 58% vs 71%, expert pairs 35% vs 34%. In the full score: known 2.8% (AI) vs 2.4% (formula) → formula stays default; AI is an option in Find and powers AI twins.
- EMIT minerals as model inputs: 1.19% → 1.14% overall but 1.63% → 1.83% where EMIT sees → left out. As a Mars mineral term in Rocks & craters: known Mars 22.4% → 22.8% (5 better, 18 worse), independent Mars 41.3% → 38.2% → off (`USE_MINERALS = false` in `grid.ts` and s14); shown as facts.
- Best 10 km spot (s23, slope-histogram overlap, windows more than 20% water left out): the window holding the real site ranks at 42% on average (chance 50%), 38 of 66 in the better half, sign test p = 0.13, best window 24 km from the site vs 25 km for a random one. Not a clear effect, so it is shown as a ground-shape hint with that verdict and changes no score.
- Not done, and why: Mars SWIM ice (swim.psi.edu down on 25 Oct, files only via a form); finer rock types (GLiM's vector map is not openly downloadable by script; PANGAEA ships only the 0.5° raster we use); Lunar Prospector hydrogen (no derived map in PDS; Diviner ice stability covers the pole).

## 5. Kaggle (heavy compute)

- Accounts: **1 = abdullahrubab1**, **2 = absanim** (account 2 also holds the owner's own research notebooks: only touch `shadowastra-*` items). Token files: `D:\NASA_space_apps_challenge_2026\_secrets\kaggle1\access_token` and `kaggle2\access_token` (outside the repo). The original key list is `_secrets\kaggle_api_keys.txt`.
- Runner: `python kaggle/run.py whoami|push|status|files|fetch|output|cli <kernel> --account N`. It gives the CLI the token **file path** via `KAGGLE_API_TOKEN`. GPU kernels set `"machine_shape": "NvidiaTeslaT4"` (2 × T4; the runner patches the push request because the CLI ignores it). `fetch --only "*.json,*.npz"` downloads selected outputs into `kaggle/_out/` (git-ignored).
- **Network:** this PC often cannot reach kaggle.com; the owner's VPN fixes it. `datasets create` needs an absolute folder path on Windows.

| Kernel | Account | Status (24 Oct) |
|---|---|---|
| K1 `k1_worlds` Moon/Mars full DEMs → 0.5° grids + patches | 1, CPU | done (62 min) |
| K1b `k1b_context` PDS context | 2, CPU | superseded: Odyssey GRS, Diviner (polar and global) and Lunar Prospector oxides are now read directly by `pipeline/s20_target_resources.py` |
| K2 `k2_earth` Earth patches (AWS terrain tiles z9) | 1, CPU | done |
| K3 `k3_ssl` DINO ViT-S/8 on three worlds, 2 × T4, domain-adversarial, then embeddings, similarity maps, twins, evaluation | 1, GPU | **done** (batch 64, 86 min, 3,148 steps); shipped by `pipeline/s19_k3_export.py` (shape.bin, AI twins) |
| K5 `k5_models` PU model zoo + Optuna, dataset `absanim/shadowastra-features` | 2, CPU | **done and shipped**: `s06_build.py` trains the same ensemble (tuned XGBoost + tuned LightGBM + logistic regression) |

All Kaggle jobs are finished; nothing is running there. The big K3 files (checkpoint, full embeddings) stay on Kaggle; only `*.json`, `shape_ssl.npz`, `*_twins.npz` and `*_emb_ll.npy` were fetched into `kaggle/_out/k3_ssl/`.

## 6. Gotchas

- `git push` may wait for Git Credential Manager: the owner has to sign in; never enter credentials.
- NASA POWER rate-limits (HTTP 429): `common.fetch` backs off; reruns only fetch what is missing.
- PDS Geosciences is reachable with the owner's VPN on (it was not without it). `s20_target_resources.py` reads Diviner by HTTP range and caches each window in `.cache/diviner_*.npy`.
- Diviner `ice_depth` codes: −1 = colder than about 101 K all year (ice stable at the surface), 0 = stable at the surface, > 0 = buried depth in m, −999 = no stable ice within 2.87 m.
- EMIT L3 cells are centred on whole and half degrees, a quarter cell off our grid; `s17_emit.py` averages the four overlapping cells. Mineral percentiles use average ranks for ties (about half of all places have exactly no gypsum).
- `s14_validate.py` is long (about 40 minutes); `s16_model_zoo.py` must run after it (s14 rewrites validation.json).
- Leaflet: never zoom during `flyTo` (`BodyMap.setMetresPerPixel` stops first). Compare positions paired maps with `animate=false`.
- Sentinel-2 cloudless has polar artifacts: above |60°| use Blue Marble (`earthVisible()`).
- Trek 8-bit DEM calibrations (Moon −9150 + 78.2·DN, Mars −10538 + 129.9·DN) are preview-grade; scores use the 16-bit USGS files.
- Windows Git Bash: long inline heredocs with quotes can break; write edit scripts to a scratch file. `python -I` hides user site-packages (numpy), so run downloaded-data scripts from a clean folder instead.
- The dev page needs ~10 s to load the 4.6 MB grid in dev mode; production is faster.
- Benchmarks and leak hunts: `tests/perf/bench.mjs` measures the production build; SwiftShader (no GPU) is the worst case and inflates frame and click times about 5x compared with this PC's AMD Radeon (`--gpu`). Heap-snapshot scripts used to find the three leaks are described in `ENGINEERING.md §4`. After a data change, run `node scripts/smoke.mjs` against the live site.
- The Find "needs" step recomputes the possible places only when a hard filter changes (`screenKey`), and the URL is written 250 ms after the last change; keep both or clicks get slow again.
- Canvases filled with putImageData must use `getContext("2d", { willReadFrequently: true })`, or WebGL and toDataURL read them back from the GPU (100 ms+ per read).
- README screenshots were refreshed for v0.6 with a headless Chrome script (Playwright, `channel="chrome"`, SwiftShader WebGL). The desktop app's own browser pane cannot draw while the app window is hidden, so headless capture is the reliable way.

## 7. Where things are on this PC

```
D:\NASA_space_apps_challenge_2026\
  CLAUDE.md            folder guide
  ShadowAstra_Atlas\   the repo (this)
  _claude_history\     CHAT_LOG.md (readable), raw transcripts, official exports (private)
  _secrets\            Kaggle token files, Earthdata, Hugging Face and LLM keys (never commit, never print)
  team-photos\         original team photos and logo
  reference\           official challenge material (portal page, Participants Guide, key dates, award list)
  _archive\            earlier plans from a previous AI and old concept work (kept, not used)
```
