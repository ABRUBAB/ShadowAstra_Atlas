# ShadowAstra Atlas: engineering report

_v0.7, 25 Oct 2026. What was checked, how, what it showed, and what is still open. Every number here was measured on the build it describes; where something was not run or could not be run, it says so._

**Reproduce everything:**

```bash
npm ci
npm run typecheck          # app, tests and configs (TypeScript 7, strict, no unused code)
npm test                   # Vitest: 67 unit, data-contract, parity and regression tests
npm run build
npx playwright test        # 43 browser tests on the production build (desktop, phone, no WebGL), axe WCAG scans
node tests/perf/bench.mjs after          # lab benchmark, software WebGL (worst case)
node tests/perf/bench.mjs after-gpu --gpu  # same on this PC's GPU
node scripts/smoke.mjs https://shadowastra-atlas.vercel.app   # live smoke test
cd pipeline && python s22_parity_fixture.py && python s23_pinpoint.py   # science fixtures and the pinpoint test
```

---

## 1. Architecture, hosting, backend, database

- **Hosting:** Vercel serves the site as static files from its global CDN, built from the `main` branch of https://github.com/ABRUBAB/ShadowAstra_Atlas on every push (live at https://shadowastra-atlas.vercel.app). `vercel.json` holds the SPA rewrite, the security headers and the cache rules.
- **Backend:** none. There is no server code, no API and no serverless function. Everything a visitor sees is computed in their own browser.
- **Database:** none. The data are versioned files in `public/data/`, written by the Python pipeline (`pipeline/`) and committed with the code: `grid.bin` (5.0 MB of typed arrays, 2.3 MB on the wire with Brotli) and `grid.json` (layout, names, targets, confidence limits), `shape.bin` (terrain AI), `terrain/` (Moon and Mars bands, AI twins), `validation.json` (every test), `review.json`. The open copy of all scores is the Hugging Face dataset https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas.
- **Third-party services at run time:** map and terrain tiles straight from NASA GIBS and NASA Solar System Treks, ESA Sentinel-2 cloudless (EOX), Esri World Imagery and Mars CTX, and AWS Terrain Tiles; Google Fonts. No analytics, no cookies, no accounts.
- **Why static is the right call:** one person or six can run it for free, it cannot be hacked through a server it does not have, it scales to any traffic on the CDN, and every number on the site can be checked against the open files. A backend would only be needed for things the site does not do: user accounts, shared saved lists, or scoring too heavy for a phone. If that day comes, the natural step is a small Vercel serverless function plus a managed Postgres (or Supabase), with the grid still served as a static file.
- **Code map:** React 19 + TypeScript 7 + Vite 8 + Tailwind 4; three.js r186 + React Three Fiber 9 (no drei); Leaflet; Motion 14, GSAP and Lenis. `src/lib/grid.ts` loads and scores the grid and mirrors `pipeline/s14_validate.py` exactly (tested). Pages are lazy routes; each page and each 3D scene sits in its own error boundary (`components/ui/Safe.tsx`).

## 2. Improvement matrix

Status key: **Done** (implemented and verified) · **Improve** (implemented, needs more) · **Missing** · **N/A** (not applicable) · **Blocked** (not verifiable here, reason given). P0 is the most urgent.

| # | Area | Item | Status | Evidence | Risk if ignored | Prio | Action taken | Verification |
|---|---|---|---|---|---|---|---|---|
| 1 | UX | How it works hero: "drag the globe" but the text layer covered it | Done | `elementFromPoint` returned the text container, not the canvas | Broken promise on the first screen | P0 | Text layer `pointer-events-none`, buttons re-enabled (`pages/Methods.tsx`); Astra's line depends on WebGL | e2e "the globe can be dragged" (canvas under the pointer, drag) |
| 2 | Perf | Flicker while scrolling the charts on How it works | Done | 104 hover-style changes per scroll burst; p50 frame 76 ms | Looks broken, drains battery | P0 | `useScrollingFlag` pauses hover while the page moves, grain layer cut to the viewport, lighter blurs and shadows | 104 → 13 hover changes, p50 frame 76 → 49 ms (lab); e2e checks the flag clears and clicks still land |
| 3 | Perf | Clicks swallowed right after a scroll (side effect of #2) | Done | `is-scrolling` blocked pointer events for 150 ms | Lost clicks during trackpad momentum | P1 | Flag clears as soon as the mouse really moves (`components/ui/kit.tsx`) | e2e: wheel then immediate click toggles the theme |
| 4 | Reliability | Memory leak: Motion `useScroll({target})` | Done | Heap snapshots: Motion's module-level timeline cache kept each visited page (about 3 MB per How it works visit) | Tab slows and crashes on long sessions | P0 | `lib/useSectionProgress.ts` replaces it (About, How it works) | Heap diff and retainer paths, §4 |
| 5 | Reliability | Memory leak: three.js shared lookup texture held each renderer | Done | Retainer path: DFG LUT `_listeners.dispose` → WebGL context → detached Home page | Same | P0 | `ReleaseGPU` captures and disposes it (`components/three/Controls.tsx`) | Find loop +3.8 → +0.8 MB over 4 Home round trips |
| 6 | Reliability | Memory leak: OrbitControls keydown listener on `document` never removed | Done | Retainer path: `document` listener → bound OrbitControls → canvas → page, 4 copies after 4 visits | Same | P0 | `createOrbit` removes it from the real document root | 1 copy left after 4 visits (R3F keeps the last scene only, bounded), §4 |
| 7 | Perf | Slow clicks on Find "needs" and Maps twin modes | Done | Event Timing breakdown: 4 to 27 ms processing, the rest waiting for a frame | Feels laggy on weak devices | P1 | Screening recomputed only when a filter changes, URL write deferred, heat map painted with 32-bit writes, twin lists deferred and cached, `findTwins` column lookup hoisted, typed-array ranking pre-filter | §3 interaction table |
| 8 | Perf | 600 ms main-thread task when Find loads | Done | CPU profile: `knownKm` ran 3 million great-circle distances | Janky first second | P1 | Exact latitude-gap shortcut, sites sorted by latitude (`lib/mission.ts`) | Unit test: identical to brute force on all 80,206 places; longest task 602 → 99 ms (GPU lab) |
| 9 | Perf | GPU read-back of heat-map and thumbnail canvases | Done | 100 to 126 ms per read of a GPU canvas | Stalls on every map update | P1 | `willReadFrequently: true` on every pixel-written canvas | Canvas timing script; heat paint gone from the profile |
| 10 | Perf | Frosted-glass blur over moving 3D scenes on slow GPUs | Done | A/B: frame 63 to 70 ms with blur, 35 ms without (software GPU) | Unusable on old laptops | P1 | `html.gpu-lite` drops blur for software renderers or slow frames | A/B script; e2e |
| 11 | Perf | Fixed canvas resolution on slow GPUs | Done | Frame interval 84 ms at full size (software GPU) | Same | P2 | `AdaptiveDpr`: steps the pixel ratio down below about 22 fps, never below 0.5 | Canvas 1366 → 683 px, frames 84 → 56 ms |
| 12 | Perf | Layout shift on Compare (seam glow animated with `top`) | Done | 50 layout-shift entries in 10 s | Wasted layout every frame | P2 | Moved with a compositor transform | Shift entries gone |
| 13 | Perf | "Scores all 80,206 places in under 20 ms" claim | Improve | Measured p50 16 ms, p95 19 ms, p99 24 to 26 ms | Overclaim | P2 | README now gives the measured numbers | `bench.mjs` ops, n = 300 |
| 14 | Perf | Mobile first load on a slow network | Improve | 5 MB grid (2.3 MB Brotli) on 1.6 Mbit/s takes about 12 s | Long wait on phones | P2 | Progress, retry and partial UI already shown; data revalidates (no stale mix) | §3; next: split the grid by field |
| 15 | Reliability | No WebGL | Done | Pages went blank | Lost visitors | P0 | `hasWebGL()`, still-image globes, HeroScene fallback | e2e project "no-webgl" |
| 16 | Reliability | GPU context lost (driver reset) | Done | 3D view froze | Dead panel | P1 | `Scene` shows the still image and a "Try again" that starts a fresh context | e2e "a lost graphics context…" |
| 17 | Reliability | Lazy page file missing after a new deploy | Done | Chunk error blanked the page | Users mid-session after a deploy | P1 | One automatic reload (30 s guard), then a clear message | e2e "a page file that cannot be downloaded" |
| 18 | Reliability | Grid download fails or is corrupt | Done | Endless spinner | Find and Maps unusable | P0 | `checkGrid` contract, retry button, `role=status` progress | Unit "refuse a truncated file", e2e "fails once, then a retry works" |
| 19 | Reliability | Broken or hostile URL parameters | Done | Bad values reached the scorer | Wrong results, crashes | P1 | `lib/missionUrl.ts` validates every parameter against allowed values | Unit and e2e "broken mission links fall back" |
| 20 | Reliability | Unknown routes and refresh on nested routes | Done | Blank page for unknown paths | Dead links | P1 | SPA rewrite in `vercel.json`, real 404s for missing data, 404 page | Unit (config), e2e 404, smoke deep links |
| 21 | Reliability | Overlapping async (fast clicking between places or modes) | Done | Late results could overwrite newer ones | Wrong panel content | P2 | Every async hook ignores stale results (`alive` flags, keyed caches) | Code review, e2e journeys |
| 22 | Security | Security headers and CSP | Done | None before 24 Oct | XSS impact, clickjacking | P0 | CSP with the inline script's SHA-256, `frame-ancestors 'none'`, nosniff, DENY, COOP, Referrer-Policy, Permissions-Policy | Unit test ties the CSP hash to `index.html`; smoke test checks the live headers and hash |
| 23 | Security | Dependencies | Done | `npm audit`: 0 vulnerabilities (production and dev), 25 Oct | Known CVEs | P1 | CI fails on high severity; Dependabot weekly | `npm audit` output, `ci.yml` |
| 24 | Security | Secrets in the repository | Done | Scan of 31 commits and the working tree, 12 patterns (Hugging Face, OpenAI-style, AWS, GitHub, Slack, Kaggle, JWT, private keys, Google, Groq, Anthropic, generic): no hits | Leaked keys | P0 | Keys stay in `_secrets/` outside the repo; gitleaks in CI | `.tmp/secretscan.py` run, gitleaks job |
| 25 | Security | Storage and external links | Done | `localStorage` holds only UI flags and saved places (no personal data); external links use `rel="noreferrer"` | Leaks | P2 | Reviewed | Code review |
| 26 | Science | Browser and Python give the same scores | Done | 28 target and job combinations × 300 places, ties and confidence included | Site disagrees with published tests | P0 | `s22_parity_fixture.py` + `tests/unit/parity.test.ts`; a deliberate change to a weight makes it fail | Unit tests, CI job regenerates the fixture from Python |
| 27 | Science | Mineral percentile ties | Done | Half of all places have exactly no gypsum; ranks were arbitrary | Unstable ranks | P1 | Average ranks in both languages | Parity test "ties included" |
| 28 | Science | Leakage in the model test | Done (design) | Spatial blocks: sites within 300 km hidden together; 28 independent sites never used to choose anything | Inflated results | P0 | Unchanged method, documented | `s14_validate.py`, How it works |
| 29 | Science | Best 10 km spot inside a place | Done, honest result | 66 field sites: median rank 42%, chance 50%, sign test p = 0.13 | Overclaiming a spot | P1 | Built (`s23`, `lib/pinpoint.ts`), water masked, labelled a hint with its test | Parity test, How it works strip |
| 30 | Science | Target facts for all 18 targets | Done | Diviner only at the pole before | Thin Moon reports | P2 | Diviner global day and night (3 targets), Lunar Prospector oxides (10) | Values checked against Williams et al. 2017 ranges |
| 31 | Science | Mars SWIM ice | Blocked | swim.psi.edu down (HTTP 522) on 25 Oct; files only via a form, not archived | Missing fact | P3 | Documented in `s20` | Re-run when the site is back |
| 32 | Science | Finer rock types | Blocked | PANGAEA ships only the 0.5° GLiM raster; the vector map is not openly scriptable | Rock term stays coarse | P3 | Documented | Needs data from the authors or Macrostrat |
| 33 | Science | Expert review of the top 20 | Improve | Kit and import ready; ratings pending from Md. Tanvir Hasan | No outside check | P1 | `s24_review.py`, `docs/review/`, How it works shows it when it arrives | Kit generated; cross-checked against the browser ranking |
| 34 | A11y | Colour contrast (dark and light) | Done | axe found dim text and status colours under 4.5:1 | WCAG 1.4.3 fail | P0 | Token changes in `styles.css` and `DESIGN.md` | axe scans: 9 screens in dark and 5 in light, on desktop and phone, 0 serious or critical |
| 35 | A11y | Pause, stop, hide (WCAG 2.2.2) | Done | Globes, marquee, cycling text ran with no way to stop | WCAG fail | P1 | Footer "Pause motion" + system setting, remembered | e2e "Pause motion…", 5 of 5 repeats |
| 36 | A11y | System "reduce motion" switched on while the page is open | Done | Change event swallowed by reading `matches` every render | Setting ignored | P1 | Read once, then follow the event (`lib/motionPref.ts`) | e2e, 5 of 5 repeats |
| 37 | A11y | Focus not obscured by the sticky header (2.4.11) | Done | Scrolled-to elements sat under the 64 px header | Hidden focus | P2 | `scroll-padding-top: 80px` | Found by a test click that hit the header |
| 38 | A11y | Names, roles, labels | Done | Label/content mismatches, duplicate `aria-current`, unlabeled regions | Screen reader confusion | P1 | Fixed in Find steps, Lab, Methods | axe scans |
| 39 | A11y | Manual screen reader and keyboard-only pass | Missing | Not done in this session | Unknown issues | P2 | Next step | Needs a person with NVDA or VoiceOver |
| 40 | Testing | Unit, contract, parity, regression | Done | 67 tests | Silent regressions | P0 | `tests/unit/` | `npm test` |
| 41 | Testing | End-to-end and accessibility | Done | 43 tests on the production build | Same | P0 | `tests/e2e/` | `npx playwright test` |
| 42 | Testing | CI gates | Done | None before | Broken deploys | P0 | `.github/workflows/ci.yml`: types, unit, build, e2e, Python parity, npm audit, gitleaks | First run on GitHub (commit 1e8e4b8): types, unit, build, all browser tests, audit and gitleaks passed; the Python job failed because CI did not install SciPy, fixed in the next commit (the fixture rebuilt from Python is byte-identical) |
| 43 | Observability | Deploy smoke test and uptime | Done | None before | Silent outages | P1 | `scripts/smoke.mjs` + `smoke.yml` (after each production deploy, every 6 hours; failures email the owner) | 23 of 23 checks pass on the live site |
| 44 | Observability | Field performance data (real users) | N/A | No analytics by choice (privacy, no cookie banner) | Lab numbers only | P3 | `window.__atlasPerf` marks are there if needed | |
| 45 | Observability | SLOs | N/A | A static hackathon site on a CDN; Vercel's own SLA applies | | | Uptime check instead of formal SLOs | |
| 46 | Competition | Submission readiness | Improve | Site, data, tests, docs ready; video and proofreading pending | Lost points | P1 | `docs/SUBMISSION.md` | Team items in `PROJECT_PLAN.md §5` |
| 47 | Perf | Layout shift when the web fonts arrive (How it works headline rewrapped: CLS 0.09 to 0.11) | Done | Layout-shift sources: the h1 went from 3 lines to 2 on font swap | CLS over the 0.1 line | P1 | Fallback faces with the measured width and height of Geist, Instrument Serif and Geist Mono (`styles.css`) | Fonts delayed 2 s on purpose: CLS 0.114 without the fallbacks, 0.001 with them |
| 48 | Perf | Satellite thumbnails built a text key for every pixel | Done | Profile: 314 ms in the pixel sampler on How it works | Long tasks while thumbnails load | P2 | Numeric tile keys (`lib/terrain.ts sampleImagery`) | Sampler 314 → 161 ms; thumbnail long tasks 115 → 55 ms |
| 49 | Perf | Percentile ranks sorted with a JavaScript comparator (How it works) | Done | Profile: about 300 ms per load | Long task | P2 | `lib/rank.ts`: packed keys, native sort, same order | Unit test: identical on 5,000 random values with ties and on all 80,206 places; 380 → 190 ms long task |
| 50 | A11y | Spinning planet thumbnails and the Compare seam glow ignored Pause motion | Done | They kept animating with reduce motion on (found by the accessibility scans' new "wait until settled" step) | WCAG 2.2.2 gap | P1 | They now read the motion switch (`Find.tsx`, `Home.tsx`, `Atlas.tsx`, `Lab.tsx`) | The scans wait until nothing animates; they pass |
| 51 | Perf | Phone home page: 3D hero competed with the first paint | Done | Phone profile: LCP 7.1 s, TBT 5.3 s | Slow first impression in Lighthouse-style tests | P1 | On narrow screens the 3D scene (238 kB of code) loads after the headline, at the first idle moment after 1.5 s | §3 phone rows |

## 3. Performance

**Lab, not field data.** One machine (AMD Ryzen 5 5600H laptop, 6 cores, integrated Radeon graphics, 15 GB RAM, Windows 11), Chrome 155.0.8059.85 headless, the production build served by `vite preview` on localhost. **Before** = commit `0c91aa2` (the live site when this pass started) plus only the benchmark hook (`src/lib/bench.ts` and its one-line loader), built in a separate worktree; **after** = this commit. Two graphics settings: **software** (SwiftShader, no GPU: the worst case, for example a laptop whose GPU the browser blocks) and **GPU** (this PC's Radeon through ANGLE/D3D11). Script: `tests/perf/bench.mjs`; raw results: `docs/perf/bench-{before,after,before-gpu,after-gpu}.json`.

Method: page loads use a fresh browser context per sample (cold cache), 5 samples, the median shown; "phone" adds 4x CPU slowdown and a 1.6 Mbit/s, 150 ms network. LCP and CLS come from PerformanceObserver; TBT is the sum of (long task minus 50 ms) between first paint and 10 s. Operations run in the page after a warm-up, n = 300 (p99 only where n ≥ 100). Interactions are real clicks measured with Event Timing (28 clicks on the needs step, 12 on the twin modes; pointerdown, pointerup and click are separate entries); the INP estimate is the second-slowest entry, which in practice is the slowest click, the strict INP for fewer than 50 interactions. `vite preview` sends the data uncompressed; on Vercel the grid travels as 2.3 MB with Brotli instead of 5.0 MB.

### Interactions (what a click feels like)

| Interaction | Software before | Software after | GPU before | GPU after |
|---|---|---|---|---|
| Find, step 3: change a need or a filter (INP estimate, ms) | 432 | 512 (+19%) | 72 | 56 (-22%) |
| Maps: switch twin mode (INP estimate, ms) | 472 | 672 (+42%) | 96 | 64 (-33%) |

Good INP is under 200 ms. With a GPU every click is now well inside it. On software graphics the median click improved on the twin modes (424 → 312 ms) and stayed level on the needs step (360 → 328 ms), but the slowest click got worse. That is not JavaScript: a breakdown of each click shows 3 to 27 ms of script and no long tasks, the rest is the software renderer producing the next frame, and the slowest ones fall in the first seconds, while the resolution guard is still stepping the canvas down (each step reallocates it). Rendering the globes only when something moves is the next step for that case (§9).

### Operations in the page (ms)

| Operation | Before p50 / p95 / p99 | After p50 / p95 / p99 | p50 change |
|---|---|---|---|
| Score all 80,206 places | 16.4 / 19.2 / 25.1 | 15.9 / 19.0 / 24.2 | -3% |
| Whole search (screen, score, rank, hints) | 64.3 / 68.6 / 82.3 | 26.8 / 30.2 / 32.6 | -58% |
| Rank the top 30 places | 21.9 / 24.4 / 28.3 | 4.7 / 5.3 / 6.5 | -79% |
| Earth twins of a Mars spot (formula) | 64.0 / 84.8 / n/a | 14.0 / 20.3 / n/a | -78% |
| AI twins (after the band download) | 0.1 / 0.2 / n/a | 0.1 / 0.2 / n/a | +0% |
| Mineral percentiles, first use | 24.0 / 24.0 / n/a | 24.8 / 24.8 / n/a | +3% |

The old claim "scored in under 20 ms" holds for the typical case (p50 15.9 ms, p95 19.0 ms) but not the slowest 1% (p99 24.2 ms); the README now gives the measured numbers. Ranking and search got faster with no change to any result (tests: identical distances, Python parity unchanged).

### Page loads (median of 5)

**Software graphics**

| Page | LCP before → after (ms) | TBT before → after (ms) | CLS before → after | JS kB before → after |
|---|---|---|---|---|
| desktop · home | 1,524 → 1,692 (+11%) | 2,253 → 1,315 (-42%) | 0 → 0 | 484 → 492 |
| desktop · find-results | 6,348 → 5,464 (-14%) | 3,153 → 1,572 (-50%) | 0 → 0 | 585 → 591 |
| desktop · methods | 3,168 → 2,744 (-13%) | 2,217 → 1,327 (-40%) | 0.1 → 0 | 604 → 611 |
| desktop · maps | 2,644 → 1,488 (-44%) | 1,943 → 2,088 (+7%) | 0 → 0 | 595 → 600 |
| desktop · compare | 3,984 → 4,004 (+1%) | 4,600 → 3,573 (-22%) | 0 → 0 | 555 → 558 |
| phone · home | 7,100 → 6,872 (-3%) | 5,300 → 4,291 (-19%) | 0 → 0 | 484 → 492 |
| phone · find-results | 3,168 → 3,060 (-3%) | 901 → 812 (-10%) | 0 → 0 | 339 → 344 |

**GPU**

| Page | LCP before → after (ms) | TBT before → after (ms) | CLS before → after | JS kB before → after |
|---|---|---|---|---|
| desktop · home | 1,368 → 1,440 (+5%) | 731 → 767 (+5%) | 0 → 0 | 484 → 492 |
| desktop · find-results | 5,728 → 5,112 (-11%) | 1,183 → 335 (-72%) | 0 → 0 | 585 → 591 |
| desktop · methods | 2,672 → 2,248 (-16%) | 541 → 598 (+11%) | 0.1 → 0 | 604 → 611 |
| desktop · maps | 1,256 → 1,348 (+7%) | 198 → 211 (+7%) | 0 → 0 | 595 → 600 |
| desktop · compare | 4,132 → 3,692 (-11%) | 2,102 → 1,490 (-29%) | 0 → 0 | 555 → 587 |
| phone · home | 6,004 → 5,992 (-0%) | 4,311 → 3,297 (-24%) | 0 → 0 | 484 → 492 |
| phone · find-results | 3,028 → 2,964 (-2%) | 638 → 560 (-12%) | 0 → 0 | 273 → 278 |

Good LCP is under 2.5 s and CLS under 0.1. The Find results LCP is a satellite thumbnail built from map tiles fetched live from the internet, so it includes those downloads. JavaScript grew by about 7 kB (the pinpoint, the motion switch and the context-loss handling).

### Memory across in-app navigation

| Build | Used JS heap after GC at Home, MB: start, then after each loop of 5 pages | Growth over the last 4 loops |
|---|---|---|
| before | 14 · 68 · 95 · 97 · 99 · 104 · 108 | 13 MB |
| after | 14 · 64 · 92 · 90 · 90 · 91 · 91 | -1 MB |
| before-gpu | 14 · 67 · 93 · 98 · 103 · 108 · 112 | 19 MB |
| after-gpu | 14 · 65 · 95 · 91 · 91 · 91 · 92 | -3 MB |

The first two loops load the 5 MB grid, the terrain AI layer and the textures once and keep them (on purpose); a leak shows as growth after that. Details of the three leaks in §4.

## 4. Memory: how the leaks were found

Method (scripts kept in `.tmp/`, not shipped): Chrome with `--js-flags=--expose-gc`, navigate in the app between two routes N times, force GC three times, read `performance.memory.usedJSHeapSize`; then take heap snapshots over CDP and walk the retainer graph backwards from a detached DOM node (detachedness flag 2) to a GC root, skipping weak edges.

| Leak | What held the page | Fix | Result |
|---|---|---|---|
| Motion 14.1 to 14.6 `useScroll({ target })` | module-level timeline cache keyed by element | `useSectionProgress` (no cache) | about 3 MB per How it works visit gone |
| three.js r186 shared DFG lookup texture | the texture's `dispose` listeners → old renderer → canvas → page | `ReleaseGPU` disposes it after the scene unmounts | Find loop +3.8 → +0.8 MB over 4 Home round trips |
| three r186 OrbitControls | `keydown` listener on `canvas.getRootNode()`; at dispose the canvas is already detached, so removal targets the wrong root | `createOrbit` remembers the document and removes it there | Maps: 4 retained copies → 1 after 4 visits; growth 0.45 → 0.2 MB per visit and flattening |
| R3F 9 render loop | module variable holding the last rendered root's state | not fixable outside R3F; bounded (one page, released when the next 3D view renders) | documented |

Remaining growth is code warm-up (JIT code, feedback vectors) and the thumbnail cache, which levels off: Maps 16.3 → 18.9 MB over 10 Home round trips with the last four within 0.5 MB.

## 5. Reliability

Failure modes tried on purpose (all in `tests/e2e/resilience.spec.ts`, `no-webgl.spec.ts` and the unit tests unless noted):

- Global data fails, then succeeds → error with a retry button, results after retry.
- Slow network (throttled) → progress shown, results arrive.
- A lazy page file missing (new deploy) → one reload, then a clear message.
- No WebGL at all → still images on Home, How it works and Maps; every other feature works.
- GPU context lost → still image plus "Try again"; a fresh context starts.
- Truncated or mismatched `grid.bin` → refused by `checkGrid` before use.
- Broken, out-of-range or hostile mission links → safe defaults.
- Unknown address → 404 page with a way back; missing data files return real 404s (not the app shell).
- Third-party tile providers down → maps show empty tiles; thumbnails show a placeholder; scores do not depend on tiles. The smoke test reports providers separately as warnings.
- Theme, zoom, print, phone, reduced motion: light theme scanned by axe; `FitSphere` keeps globes fitted at any browser zoom; `/report` has print CSS; a phone project runs the journeys and scans; reduced motion and the pause switch are tested.

Monitoring: `smoke.yml` runs `scripts/smoke.mjs` after each production deploy and every 6 hours (23 checks: pages, deep links, headers, CSP hash, asset caching, data contract, 9 providers). A failed run emails the repository owner. Formal SLOs are not meaningful for a static site on a CDN without its own servers.

## 6. Security

- Headers on every response (`vercel.json`, verified live): `Content-Security-Policy` (`default-src 'self'`; scripts only from the site plus the one inline theme script by SHA-256; no `eval`; `object-src 'none'`; `frame-ancestors 'none'`; `base-uri` and `form-action` limited to the site; images and connections to HTTPS hosts for map tiles), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` (location only for the site, camera, microphone, payment, USB and topics off).
- `style-src 'unsafe-inline'` remains: React inline styles and Leaflet need it. Low risk because scripts cannot run inline.
- `connect-src` and `img-src` allow any HTTPS host, because tiles come from seven providers; narrowing it to those hosts is possible but brittle when a provider changes CDN.
- Dependencies: `npm audit` 0 vulnerabilities (production and tooling) on 25 Oct 2026; lockfile committed; CI fails on high severity; Dependabot opens weekly updates.
- Secrets: none in 31 commits or the working tree (12-pattern scan); keys live in `_secrets/` outside the repository; CI runs gitleaks on the full history. The site has no secrets to leak: it calls no private API.
- Input: the only inputs are URL parameters, the search box and the town picker; all are validated or matched against the grid's own lists, never inserted as HTML.
- Storage: `localStorage` and `sessionStorage` hold UI flags (`sa-*`), the field log and saved places only.

## 7. Scientific integrity

- **Parity:** the browser scorer and the Python scorer used for every published number agree to 2e-4 on 28 target and job combinations over 300 places (random, known sites, extremes, missing relief), including mineral percentiles with ties and confidence levels. A deliberate weight change makes the test fail (mutation check). CI rebuilds the fixture from Python and re-runs it.
- **The pinpoint** has its own parity test (two inland sites and a coast, so the water rule is exercised) and a synthetic test with a known answer.
- **Nothing was tuned to look better:** no formula, weight, model, training method, dataset or confidence rule changed in this pass. Two speed-ups touch scoring code (`knownKm`, the ranking pre-filter); both are proven identical by tests (all 80,206 distances equal, parity unchanged).
- **Negative results are published:** the pinpoint did not clearly beat chance (p = 0.13) and is labelled as a hint; EMIT minerals and the terrain AI did not improve the full score and stay out of it.
- **Leakage:** spatial blocks of 300 km when hiding known sites; the 28 independent sites are only reported, never used to choose.
- **Provenance:** every target fact names its instrument and paper; the open dataset carries the same columns.
- **Reproducibility:** the pipeline caches every download by URL; `s22`, `s23` and `s24` run in seconds from the cache; random choices use fixed seeds.

## 8. Tests executed (25 Oct 2026, final build)

| Check | Result |
|---|---|
| TypeScript, strict (`npm run typecheck`, app + tests + configs) | pass, 0 errors |
| Vitest (`npm test`): files 7 passed (7) | 67 passed (67) |
| Playwright (`npx playwright test`): desktop, phone and no-WebGL projects, axe WCAG 2.2 scans in dark and light | 43 passed, 0 failed, 0 flaky, 0 skipped (5.8m) |
| Production build twice, file hashes compared (reproducible build) | files: 196, IDENTICAL |
| `npm audit --omit=dev` and `npm audit` | 0 vulnerabilities each |
| Secret scan, 31 commits + working tree, 12 patterns | 0 hits |
| Smoke test of the live site before this push (`scripts/smoke.mjs`) | 23 passed, 0 failed, 0 provider warnings |
| Workflow files (`ci.yml`, `smoke.yml`, `dependabot.yml`) parse | pass (PyYAML) |
| Pinpoint test on 66 field sites (`s23_pinpoint.py`) | ran: median rank 0.419, sign test p = 0.134, not better than chance |
| GitHub Actions CI on 1e8e4b8 and 216182e | web job (types, 67 unit, build, 43 browser tests on Linux) and security job passed; Python parity job failed: SciPy missing from the CI install. Fixed; locally the rebuilt fixture is byte-identical and 33 of 33 parity tests pass |
| Manual screen reader / keyboard-only pass | not run |

During this pass the tests and benchmark scripts also caught real problems before they shipped: a link marked only by colour (WCAG 1.4.1), a media-query race that ignored the system reduce-motion setting, and clicks swallowed after scrolling. Each now has a test.

## 9. Remaining risks and next steps

- Slow and software GPUs: with software WebGL a typical click on the busiest 3D pages takes about 300 ms and the slowest about 500 to 700 ms (on this PC's integrated Radeon: 56 to 64 ms at worst). The cost is frame production, not script. Next: render 3D only when something changes (`frameloop="demand"` with damping driven manually) and pause globes that are off screen.
- Thumbnail rendering still runs on the main thread (about half its former cost after the numeric tile keys). Next: move it to a Web Worker with OffscreenCanvas.
- First load on slow mobile networks: the 2.3 MB grid. Next: split `grid.bin` so Find downloads only the fields it scores first.
- No manual screen reader pass yet; axe finds about a third of real accessibility problems.
- CI: the first GitHub runs showed the browser suite also passes on Linux runners; the one failure (SciPy not installed for the Python job) is fixed. Dependabot's update pull requests failed on the same step and pass once rebased onto main.
- Science: the expert review, SWIM ice, finer rock types and the official challenge datasets (28 Oct) are open; each is a `pipeline/` step under the rule for new data.
