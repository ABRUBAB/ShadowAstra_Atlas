# ShadowAstra Atlas: handoff for the next person or AI agent

_Last updated: 23 Oct 2026 (v0.4). First build session 10–14 Oct 2026; second session 23 Oct 2026._

Read this first. With this file, `../CLAUDE.md`, `PROJECT_PLAN.md` and `../DESIGN.md` you have the full context. The complete chat history is in `D:\NASA_space_apps_challenge_2026\_claude_history\` (outside the repo, because it is private).

---

## 0. v0.4 in one page (23 Oct 2026), read this first

**What changed:** the site now has a real global data engine and a tested model. Section 3 below describes v0.3; everything here supersedes it.

- **Data engine** (`pipeline/`, Python, see `pipeline/README.md`): every land cell on Earth at 0.5° (80,206 cells) measured from NASA POWER, MODIS via GIBS colormap inversion, AWS Terrain Tiles (SRTM), Smithsonian GVP, impact craters (`pipeline/catalogue.py`) and Natural Earth. Moon/Mars targets use full-precision 16-bit USGS LOLA (118 m) and MOLA (463 m) GeoTIFFs via HTTP range requests. Output: `public/data/grid.bin` (typed arrays, 4.3 MB) + `grid.json` (layout, names, targets, model evaluation). Cache: `pipeline/.cache/` (~700 MB, git-ignored).
- **Model:** positive-unlabelled LightGBM on 38 known sites (`KNOWN_ANALOGS`), 4 bags, physical features only. Spatial hold-out (hide each site and all known sites within 300 km): Moon median rank top 0.8% (rule 35.3%), Mars top 4.9% (rule 31.1%); in top 10%: 82% / 71% (rule 14% / 14%).
- **Terrain encoder** (`s07_patches.py`, `s08_encoder.py`): self-supervised CNN on 42×42 height patches from Earth, Moon and Mars, trained on the local CPU. Result in `pipeline/.cache/shape_eval.json`.
- **New page `/discover` (Find new sites):** pick a job and a target, all cells scored live (`src/lib/grid.ts` → `scoreAll`), 3D score globe (`components/three/ScoreGlobe.tsx`) or flat map, ranked distinct places (`rankPlaces`, 400 km spacing; "only new" hides places within 150 km of known sites), place report, search (towns, regions, countries), saved places (localStorage), model test chart. URL: `?target=&task=&at=lat,lon`.
- **Compare (`/lab`)** accepts any coordinates: `earth=@lat,lon` (`src/lib/places.ts`). Rocks, cold and bare-ground scores now come from the grid (Computed), not demo values.
- **Home** rebuilt: town checker (`components/CheckTown.tsx`), Earth or Mars game (`components/EarthOrMars.tsx`), Meet Astra with 10 reactions and a badge log (`lib/fieldlog.ts`, `ui/BadgeToast.tsx`).
- **UI kit** `components/ui/kit.tsx`: `.surface` spotlight cards (one global pointer listener, `useSpotlight`), Counter, Ring, Meter, Chip, Tip, Seg, Magnetic, WordCycler, RevealWords, Kicker (outlined numbers), Toaster/`toast()`, BackToTop, GlyphTile. Command palette (Ctrl K or /) in `ui/CommandPalette.tsx`.
- **Astra:** new moods `cold`, `hot`; actions `shiver`, `fan`, `point`, `binoculars`; typed speech; `climateReaction()`; Ask Astra answers from the grid (`astraAnswerAsync`: "How Mars-like is Cairo?", "Best new site for Jezero?").
- **Plain names:** Analog Lab → Compare, Atlas → Maps, Data & Method → How it works, About → Team (routes unchanged). Analog Fit → Match score; Shadow Lab → shadow map; Light Twin → sunlight match; Reality gap → "Earth can't copy". Task labels are plain ("Drive a rover or walk").
- **Fixed:** infinite loop between the two linked Leaflet maps in Compare (BodyMap `setMetresPerPixel` now goes silent before `map.stop()`).

### 0.1 Gotchas learned in v0.4
- NASA POWER returns HTTP 429 when hit hard: `common.fetch` backs off 15 s × attempt on 429/503; `s02_power.py` uses 2 threads. A rerun only fetches failed boxes (disk cache).
- GIBS IGBP water entry is `sourceValue="0,17"`: categorical lists use the last number, intervals use the midpoint.
- On the Compare page the 4 MB grid loads while the 3D terrain is computed, so the rocks/cold rows can take 10 to 30 s on slow machines (they show "Demo" until then).
- README screenshots: a Playwright script with `channel="msedge"` and `--use-angle=swiftshader` (sandbox disabled in Claude Code). Plain `msedge --headless --screenshot` returns before data loads.
- Dev server runs on port 3000 (teammate change in `vite.config.ts`).

### 0.2 Next TODOs (hackathon, 14 to 15 Nov)
1. 28 Oct: read the challenge Resources tab and add the official datasets as new `pipeline/sNN_*.py` steps.
2. EMIT minerals (Earth), Diviner (Moon) for the rocks and cold scores.
3. Field test plan PDF export from the place report; Bangla mode.
4. Kaggle GPUs (owner has 2 accounts): only needed if the encoder grows (bigger patches, HiRISE). Put `kaggle.json` in `C:\Users\user\.kaggle\`; never paste keys in chat.
5. New portrait for Mohammed Mahmud Parvez; YouTube link in README.

---

## 1. What this is

- **Event:** NASA International Space Apps Challenge 2026, Dhaka (Bangladesh) local event.
- **Challenge:** *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars.* This means using open Earth, Moon and Mars data from NASA and other agencies to identify and characterize **new** terrestrial analogs. The challenge names four factors: topography, geology, environment and resources.
- **Team:** ShadowAstra (6 people, Dhaka). **Project:** ShadowAstra Atlas.
- **Live site:** https://shadowastra-atlas.vercel.app (Vercel auto-deploys every push to `main`)
- **Repo:** https://github.com/ABRUBAB/ShadowAstra_Atlas (public)
- **Owner:** Abdullah Rubab, GitHub **ABRUBAB**, rubab2712@gmail.com

### Team (as shown on the site)
| Name | Role | Photo file |
|---|---|---|
| Abdullah Rubab | Team lead | public/team/rubab.webp |
| Tanvir Hossin | Planetary terrain research | public/team/hossin.webp |
| Md. Tanvir Hasan | Scientific validation | public/team/hasan.webp |
| Mohammad Saniul Alam | Experience design | public/team/saniul.webp |
| Tasnuva Arif | Development & testing (narrator of the film) | public/team/tasnuva.webp |
| Mohammed Mahmud Parvez | Film editing | public/team/parvez.webp (**old crop**; still needs a new photo) |

The original colour photos are in the parent folder (`Rubab_profile.png`, `tanvir_hossin.jpg`, `saniul.jpg`, `tasnuva.jpg`, `tanvir_hasan.jpg`). They are cropped to 4:5 at 800×1000 WebP.

### Timeline and deadlines (verify with organisers)
- 1 Oct 2026: Video 1 (concept film, ≤240 s) submitted on YouTube. ✅
- Oct 2026: preliminary round, with the GitHub repo showing progress. ✅ (this prototype)
- ~28 Oct: full challenge statement expected.
- Bangladesh hackathon 13–14 Nov; global window 14–15 Nov. Video 2 timing was unclear (1 Nov or 13 Nov). Ask the Local Lead.

---

## 2. Owner's standing instructions (follow these)

1. **Git:** commit and push directly to `main` as **ABRUBAB <rubab2712@gmail.com>** (the global git config is already set). **Never add Claude or any AI as co-author.** No `Co-Authored-By` lines.
2. **Speed:** deadlines are tight. "Just do it and push." Don't ask unnecessary questions.
3. **Design:** premium, award-level and *not AI-looking*. Warm "observatory" palette, one sunlight accent, calm motion, no neon or glow. Dark is the default theme; light mode is a warm paper theme. See `../DESIGN.md`.
4. **Text:** **no em dashes (—) in website text**, and plain, easy English.
5. **3D first, 2D where it helps.** Use real NASA (and ESA) data and never fake imagery.
6. **Honesty:** every value is labelled **Computed**, **Demo** or **Reality gap**. Don't invent scores or facts.
7. **Astra** (the astronaut mascot) is **"he"**. Keep him on every page: he reacts to results and gives tips.
8. **NASA data form field ≤ 200 characters.** The approved text is in `SUBMISSION.md`.

---

## 3. What exists today (v0.3)

| Route | Contents |
|---|---|
| `/` Home | 3D Earth hero (NASA Blue/Black Marble day–night shader) with the Moon on an orbit ring and Mars behind; 10 chapters (challenge, 6 novelty ideas, worlds, false-friend scroll story, Moon base polar map, pipeline, sustainability, library, progress, team); Astra in each chapter |
| `/atlas` | 3D globes plus 13 live map layers (Earth GIBS + Sentinel-2, Moon Trek, Mars Trek, LOLA south-pole stereographic); task and world filters; site detail; 8 queued screening regions |
| `/lab` Analog Lab | **Top:** side-by-side or swipe real-imagery comparison, matched metres-per-pixel, an evidence panel (Analog Fit ring, 6 parameters, weights) and Astra's reaction. UX: numbered steps ①②③, quick pairs, coach tips, section dock, deep links `#evidence #geology #light #footprint #gaps`. **Below:** 01 3D terrain slabs (real DEM + imagery drape, cut walls, slice line, Sun controls, Shadow overlay), cross-section profile, slope stats; 02 geology plates (matched-scale real imagery); 03 Light Twin calendar + Shadow Lab maps; 04 Rehearse closer (distance, CO₂, closest credible sites, stewardship); 05 reality gaps, auto-summary, model roadmap |
| `/methods` | Pipeline (scroll-drawn), scoring formulas, parameter cards, weights table, filterable source registry, model plan, principles |
| `/about` | Sweeping-Sun lunar pole hero, crew with photos, the name meaning, 10 award categories mapped to features, values, scroll-linked timeline |
| Global | Branded splash (first visit per session), orbit loader, **Ask Astra** chat assistant (rule-based, answers from our data), theme toggle (dark/light), film grain |

URL helpers: `?theme=light|dark`, `?splash=0`, `/lab?earth=<id>&target=<id>&task=<id>`.

### Science that is actually computed in the browser
- **Terrain:** elevation sampled on a shared azimuthal-equidistant grid (`src/lib/terrain.ts`).
  - Earth uses AWS Terrain Tiles (SRTM, metres).
  - Moon uses Trek `LRO_LOLA_DEM_Global_128ppd_v04` 8-bit (≈ −9150 + 78.2·DN m).
  - Mars uses Trek `Mars_MGS_MOLA_DEM_mosaic_global_463m_8` 8-bit (≈ −10538 + 129.9·DN m).
  - The 8-bit calibrations are our own fits from known extremes. Treat them as preview-grade.
- **Topography score** = 0.65·slope-histogram overlap + 0.35·relief agreement.
- **Lighting score** = 1 − W₁/25° (Wasserstein distance of daylight Sun-elevation distributions), using the **best month** (`src/lib/sun.ts`).
- **Shadow Lab:** a horizon method with 24 azimuths and a constant Sun elevation. It outputs the persistent-shadow fraction.
- Geology, temperature and regolith are **demo values** from literature ratings (`src/lib/scoring.ts`). Radiation is a reality gap and is never scored.

---

## 4. Code map

```
ShadowAstra_Atlas/
  index.html                 theme pre-paint script (?theme=, localStorage "sa-theme")
  src/styles.css             Tailwind v4 tokens, light theme + dark "islands" ([data-theme])
  src/App.tsx                routes, Splash, AskAstra, idle prefetch
  src/data/sites.ts          EARTH_SITES (17), TARGETS (18), TASKS (8), SCREENING_REGIONS (8)
  src/data/layers.ts         13 map layers (GIBS, Trek, Sentinel-2)
  src/lib/terrain.ts         DEM + imagery sampling, stats, illumination, profile
  src/lib/sun.ts             Light Twin solar geometry
  src/lib/scoring.ts         params, task weights, demo values, CO2, stewardship
  src/lib/astra.ts           Ask Astra question-answering engine (no LLM)
  src/lib/geo.ts             projections, matched-scale maths, polar image mapping
  src/components/three/      Planet (shader), HeroScene, GlobeView, TerrainTwins, Starfield, Controls, textures (LOD)
  src/components/map/        BodyMap (Leaflet, 3 CRSs), Swipe
  src/components/ui/         Chrome (Nav, Footer, theme toggle), Astronaut, AskAstra, Splash
  src/pages/                 Home, Atlas, Lab, Methods, About
  scripts/                   build_textures.py, build_thumbs.py (rebuild NASA assets)
  public/textures|thumbs|team|brand
  docs/                      PROJECT_PLAN.md, HANDOFF.md (this), SUBMISSION.md, readme/ (README images, animated SVGs)
```

Commands: `npm install` · `npm run dev` (port 3000) · `npm run build` · `npm run typecheck`.
Stack: React 19, TypeScript 7, Vite 8, Tailwind 4, three.js + R3F 9 (no drei), Leaflet, GSAP + Lenis, Motion.

---

## 5. Gotchas learned the hard way

- **Leaflet scale sync:** never zoom a map while it is mid-`flyTo`. `BodyMap.setMetresPerPixel` calls `map.stop()` first, and the Lab positions its paired maps with `flyTo(..., animate=false)`.
- **Sentinel-2 cloudless** has colour artifacts over polar ice. Earth sites above |60°| use NASA Blue Marble (`earthVisible()` in terrain.ts).
- **Polar Moon targets** use the reprojected LOLA image (`public/textures/moon_south_pole_lola.webp`, CRS.Simple). Equirect tiles near the pole are cut to ≤80 tiles.
- **Light theme:** space scenes (home hero, Atlas stage, 3D terrain card, splash) are wrapped in `data-theme="dark"`. Use `var(--color-*)` and not hex in anything theme-sensitive. SVG colours must go in `style={{ stroke: ... }}`, not attributes.
- **Lab URL rewrite** drops the `#hash`, so it is read once at mount.
- **Headless screenshots** (for the README): Edge `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=…`. Scroll-reveal sections render empty in headless; use the in-app browser for those. The dev server must be running.
- Windows Git Bash: write long Python edit scripts to a file. Inline heredocs with backticks and quotes broke once.

---

## 6. Open TODOs

1. New portrait for **Mohammed Mahmud Parvez** (add `parvez.jpg` and crop it to 4:5 WebP).
2. Add the **YouTube video link** to the README and site once the owner shares it.
3. Hackathon (Nov), from `PROJECT_PLAN.md`:
   - Full-precision DEMs (LOLA polar 5–20 m, HiRISE 1 m, NASADEM 30 m).
   - EMIT / Diviner / THEMIS / CRISM for geology, temperature and regolith.
   - Physical baseline ranker, then a terrain encoder on Kaggle.
   - Screen the 8 queued regions and export a Site Passport (PDF).
   - A Bangla classroom mode.
4. Optional: the owner mentioned `npx plugins add vercel/vercel-plugin`. It was not run. Deployment already works without it.

## 7. Where the history is
- `D:\NASA_space_apps_challenge_2026\_claude_history\CHAT_LOG.md`: readable chat (all user requests plus Claude replies)
- `…\_claude_history\session-raw.jsonl`: full raw transcript
- `…\_claude_history\session-2026-10-10_to_14-export.zip`: the official app export
- Earlier planning docs (from a previous AI, now archived) are in the parent folder: `SHADOWASTRA_ATLAS_MASTER_PLAN.md`, video scripts, `KAGGLE_TRAINING_PLAN.md`, and so on.
