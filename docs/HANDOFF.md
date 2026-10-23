# ShadowAstra Atlas: handoff

_Last updated 24 Oct 2026 (v0.5). Read this first. Together with `../CLAUDE.md`, `PROJECT_PLAN.md` (status and roadmap), `../DESIGN.md` and the chat history in `D:\NASA_space_apps_challenge_2026\_claude_history\` you have the full context._

---

## 1. What this is

- **Event:** NASA International Space Apps Challenge 2026, Dhaka. Bangladesh hackathon 13 to 14 Nov, global window 14 to 15 Nov (confirm with the Local Lead). Official challenge datasets released 28 Oct.
- **Challenge:** *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*: use open Earth, Moon and Mars data from NASA and other agencies to **identify and characterize new** terrestrial analogs, by **topography, geology, environment and resources**.
- **Live:** https://shadowastra-atlas.vercel.app (Vercel deploys every push to `main`). **Repo:** https://github.com/ABRUBAB/ShadowAstra_Atlas (public).
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
8. Ignore every branch except `main` (`tanvir_design` was checked and adds nothing; never open the `tanvir` branch).

## 3. The website (React 19, TypeScript 7, Vite 8, Tailwind 4, three.js + R3F 9 without drei, Leaflet, Motion, GSAP + Lenis)

| Route | File | What it does |
|---|---|---|
| `/` | `pages/Home.tsx` | 3D Earth hero, challenge, six ways in, town checker (`components/CheckTown.tsx`), Earth-or-Mars game (`components/EarthOrMars.tsx`), Astra |
| `/discover` | `pages/Find.tsx` + `lib/mission.ts` + `components/find/pieces.tsx` | Mission builder: start screen and presets → destination → job → needs (sentence form, live "places still possible") → search sweep → ten distinct results (satellite thumbnails `lib/thumbs.ts`, relaxation hints) → compare up to four (`CompareSheet`) → place report (close-up map or 3D globe, confidence, rock type, four factors on both worlds) → printable `/report` (`pages/Report.tsx`). URL keeps the whole mission (`?step&target&task&km&town&alt&month&ant&new&home&hlat&hlon&at`). |
| `/atlas` | `pages/Atlas.tsx` | Maps: three globes, live layers (`data/layers.ts`), floating panels, **twin finder** (tap the Moon or Mars → `lib/twins.ts` + `public/data/terrain/`) |
| `/lab` | `pages/Lab.tsx` | Compare: matched-scale maps (split or swipe), match medallion, 3D terrain twins (`components/three/TerrainTwins.tsx`), profile, slopes, geology plates, light twin, shadow map, travel, what Earth can't copy. `earth=@lat,lon` works. |
| `/methods` | `pages/Methods.tsx` + `components/methods/` | How it works: dot-globe hero, four factor cards, scroll story, proof charts from `public/data/validation.json`, nine-model table, failures, datasets |
| `/learn` | `pages/Learn.tsx` | Classroom page in English, Spanish and বাংলা (`?lang=es|bn`), quiz scored live, printable worksheet |
| `/about` | `pages/About.tsx` | Team |

**Core libraries:** `lib/grid.ts` (loads `public/data/grid.bin` + `grid.json`; `scoreAll`, `scoreCell`, `rankPlaces`, `confidence`, `rock`; `MODEL_MIX = 0.6`; must stay identical to `pipeline/s14_validate.py`), `lib/scoring.ts` (job weights, CO₂), `lib/sun.ts` (light twin), `lib/terrain.ts` (DEM and imagery sampling for Compare), `lib/wheel.ts` (scroll policy), `lib/validation.ts`. Shared UI: `components/ui/kit.tsx` (Counter, Ring, Meter, Chip, ConfidenceChip, Seg, Magnetic, Reveal, toast…), `ui/Chrome.tsx` (Nav, Footer), `ui/Astronaut.tsx`, `ui/AskAstra.tsx` (answers from the grid), `ui/CommandPalette.tsx` (Ctrl K). App shell (`App.tsx`): route beam, scroll progress, page fade, lazy routes.

**Behaviours to keep:**
- Maps and 3D views inside scrolling pages ignore the plain mouse wheel (Ctrl/⌘ + wheel or pinch zooms, `lib/wheel.ts`); only the full-screen Maps page uses wheel zoom (`wheelZoom="always"`, `wheel="zoom"`).
- Globes call `FitSphere` (`components/three/Controls.tsx`) so the sphere always fits the canvas.
- Imagery gets sharper as you zoom: each layer can name a `detail` layer (Earth Sentinel-2 → Esri World Imagery; Mars Viking → CTX 5 m via NASA Trek/Esri, 512 px tiles, `zoomOffset -1`; Moon WAC → Kaguya TC). Imagery is for viewing; scores come from the grid.
- Space scenes are wrapped in `data-theme="dark"`; theme colours are `var(--color-*)`; SVG colours go in `style`. Chart colours `--color-chart-1..4` were validated for colour blindness.

Commands: `npm install` · `npm run dev` (http://localhost:3000; `.claude/launch.json` "atlas") · `npm run typecheck` · `npm run build`. URL helpers: `?theme=light|dark`, `?splash=0`.

## 4. Data and science (`pipeline/`, Python; cache in `pipeline/.cache/`, ~1 GB, git-ignored)

| Step | Output |
|---|---|
| s01 GIBS · s02 POWER · s03 terrain · s04 context · s05 targets | raw layers in `.cache` (see `pipeline/README.md`) |
| **s06_build** | `public/data/grid.bin/json`: 80,206 land cells, indicators, slope histograms, features, GLiM rock class `f_lith`, coverage `q_cover`, model bag spread `u_moon/u_mars`, PU LightGBM `model_moon/mars` (8 bags), the 38-site hold-out test, targets with rock families |
| s07–s09 | the first CPU terrain encoder (optional "neural" ground shape, `public/data/shape.bin`) |
| s10–s13 | Moon rows (stopped; done on Kaggle instead), Mars TES maps, 39 Mars Exploration Zones, Mars geology/craters/caves and Moon pits/albedo (context grids in `.cache`, not yet on the site) |
| **s14_validate** | `public/data/validation.json`: 28 independent sites, known sites with their real jobs, model-share curve, job test, robustness, ablations |
| s15_planet_grids | `public/data/terrain/{moon,mars}/bNN.bin` from Kaggle K1 (twin finder) |
| s16_model_zoo | adds Kaggle K5 results to `validation.json` |

`catalogue.py` holds `KNOWN_ANALOGS` (38 training sites), `KNOWN_JOBS`, `VALIDATION_SITES` (28, never trained on), `IMPACTS`, GLiM classes and target rock families.

**Headline numbers:** hidden known sites top 2.2% of land; 28 independent sites top 21% (Moon top 5.2%) vs simple rule 40%; job test 78% of 78 sites (p < 0.001); ±25% weight noise keeps 8 to 10 of the top 10. K5 ensemble: 1.2% / 14.7% (not shipped yet).

## 5. Kaggle (heavy compute)

- Accounts: **1 = abdullahrubab1**, **2 = absanim** (account 2 also holds the owner's own research notebooks: only touch `shadowastra-*` items). Token files: `D:\NASA_space_apps_challenge_2026\_secrets\kaggle1\access_token` and `kaggle2\access_token` (outside the repo). The original key list is `_secrets\kaggle_api_keys.txt`.
- Runner: `python kaggle/run.py whoami|push|status|files|fetch|output|cli <kernel> --account N`. It gives the CLI the token **file path** via `KAGGLE_API_TOKEN`. GPU kernels set `"machine_shape": "NvidiaTeslaT4"` (2 × T4; the runner patches the push request because the CLI ignores it). `fetch --only "*.json,*.npz"` downloads selected outputs into `kaggle/_out/` (git-ignored).
- **Network:** this PC often cannot reach kaggle.com; the owner's VPN fixes it. `datasets create` needs an absolute folder path on Windows.

| Kernel | Account | Status (24 Oct) |
|---|---|---|
| K1 `k1_worlds` Moon/Mars full DEMs → 0.5° grids + patches | 1, CPU | done (62 min) |
| K1b `k1b_context` PDS context | 2, CPU | partly: Odyssey GRS 5×5 fetched; Diviner path 404; Lunar Prospector crawl matched the wrong files |
| K2 `k2_earth` Earth patches (AWS terrain tiles z9) | 1, CPU | done |
| K3 `k3_ssl` DINO ViT-S/8 on three worlds, 2 × T4, domain-adversarial, then embeddings, similarity maps, twins, evaluation | 1, GPU | first run ran out of GPU memory (batch 192); **re-pushed 24 Oct with batch 64**, about 8 h |
| K5 `k5_models` PU model zoo + Optuna, dataset `absanim/shadowastra-features` | 2, CPU | done; results in `kaggle/_out/k5_models/` and on How it works |

Next for Kaggle: `python kaggle/run.py status k3_ssl --account 1`; when complete, `fetch k3_ssl --account 1 --only "*.json,shape_ssl.npz,*_twins.npz"`, read `k3_eval.json` (SSL vs formula on known, independent and expert pairs). Then see `PROJECT_PLAN.md §4`.

## 6. Gotchas

- `git push` may wait for Git Credential Manager: the owner has to sign in; never enter credentials.
- NASA POWER rate-limits (HTTP 429): `common.fetch` backs off; reruns only fetch what is missing.
- PDS Geosciences is unreachable from this network; use Kaggle.
- Leaflet: never zoom during `flyTo` (`BodyMap.setMetresPerPixel` stops first). Compare positions paired maps with `animate=false`.
- Sentinel-2 cloudless has polar artifacts: above |60°| use Blue Marble (`earthVisible()`).
- Trek 8-bit DEM calibrations (Moon −9150 + 78.2·DN, Mars −10538 + 129.9·DN) are preview-grade; scores use the 16-bit USGS files.
- Windows Git Bash: long inline heredocs with quotes can break; write edit scripts to a scratch file. `python -I` hides user site-packages (numpy), so run downloaded-data scripts from a clean folder instead.
- The dev page needs ~10 s to load the 4.6 MB grid in dev mode; production is faster.
- README screenshots are from v0.4 and should be refreshed.

## 7. Where things are on this PC

```
D:\NASA_space_apps_challenge_2026\
  CLAUDE.md            folder guide
  ShadowAstra_Atlas\   the repo (this)
  _claude_history\     CHAT_LOG.md (readable), raw transcripts, official exports (private)
  _secrets\            Kaggle token files (never commit, never print)
  team-photos\         original team photos and logo
  reference\           official challenge material (portal page, Participants Guide, key dates, award list)
  _archive\            earlier plans from a previous AI and old concept work (kept, not used)
```
