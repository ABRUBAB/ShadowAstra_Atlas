# CLAUDE.md: ShadowAstra Atlas

NASA Space Apps 2026 (Dhaka) project by team **ShadowAstra**. The challenge is *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*.
Live: https://shadowastra-atlas.vercel.app · Repo: https://github.com/ABRUBAB/ShadowAstra_Atlas (Vercel auto-deploys `main`).

**Start by reading `docs/HANDOFF.md`.** It has the full context, the code map, the gotchas and the TODOs. Also see `docs/PROJECT_PLAN.md`, `DESIGN.md`, `docs/SUBMISSION.md`. Chat history: `../_claude_history/CHAT_LOG.md`.

## Owner rules (always)
- Commit and push straight to `main` as **ABRUBAB <rubab2712@gmail.com>**. **Never add Claude or any AI as co-author** (no `Co-Authored-By`).
- Deadlines are tight: do the work, verify it, push. Keep questions to a minimum.
- Premium, not-AI-looking design: warm dark "observatory" palette, one sunlight accent (`--color-flare`), calm motion. Dark is the default; the light theme is warm paper. Follow `DESIGN.md`.
- **No em dashes (—) in website text.** Use plain, easy English.
- Real NASA/ESA data only. Label values **Computed / Learned / Earth can't copy**, and never invent numbers.
- The mascot **Astra is "he"**. Keep him present and reactive on pages.
- 3D first, 2D where it helps.
- Ignore every branch except `main`. Never open the `tanvir` branch.
- Kaggle: never ask for, print or commit keys. If kaggle.com does not load, check once, ask the owner to turn on the VPN, and move on (retries waste credits).

## Commands
`npm install` · `npm run dev` (http://localhost:3000) · `npm run build` · `npm run typecheck` · data: see `pipeline/README.md`
URL helpers: `?theme=light|dark`, `?splash=0`, `/lab?earth=<id or @lat,lon>&target=<id>&task=<id>#geology`, `/discover?step=results&target=<id>&task=<id>&at=<lat,lon>`, `/learn?lang=es|bn`.
Kaggle: `python kaggle/run.py whoami|push|status|files|fetch|output <kernel> --account 1|2` (tokens in `../_secrets/kaggle1|kaggle2/access_token`; see `docs/HANDOFF.md §5`).
Data rebuild order: `s17_emit` → `s20_target_resources` → `s06_build` → `s19_k3_export` → `s14_validate` (about 40 min) → `s16_model_zoo` (see `pipeline/README.md`).

## Key gotchas
- Theme-sensitive colours use `var(--color-*)`. Space scenes are wrapped in `data-theme="dark"`. SVG colours go in `style`, not attributes.
- Leaflet: never zoom mid-`flyTo` (`BodyMap` calls `map.stop()`); the Lab positions paired maps with `animate=false`.
- Trek 8-bit DEM calibrations (Moon −9150+78.2·DN, Mars −10538+129.9·DN) are preview-grade.
- Sentinel-2 cloudless has polar artifacts, so `earthVisible()` switches to Blue Marble above |60°|.
- The global grid (`public/data/grid.bin` + `grid.json`) is built by `pipeline/`; never hand-edit it. `src/lib/grid.ts` mirrors the Python scoring, keep them in sync.
- Cards use the `.surface` class (spotlight); shared components live in `src/components/ui/kit.tsx`.
- Maps and 3D views inside scrolling pages must not eat the mouse wheel: use `lib/wheel.ts` (Ctrl/⌘ + wheel zooms). Only the full-screen Maps page zooms on a plain wheel.
- Every R3F globe needs `<FitSphere />` (`components/three/Controls.tsx`) so it fits any window size or browser zoom.
- Sharper imagery when zooming in comes from `detail` layers in `src/data/layers.ts` (Esri, CTX, Kaguya); they are for viewing only.
- Git Bash on Windows: long inline heredocs with quotes break; write a script file and run it.
- New data only changes the score if it ranks the known sites better (the independent sites are reported, never used to choose); otherwise show it as a fact and report the test on How it works.
- `src/lib/grid.ts` and `pipeline/s14_validate.py` must agree on the mineral term (`USE_MINERALS`, `MIN_WEIGHT`, `MIN_UNSEEN`, average ranks for ties) and the confidence limits in `grid.json → confidence`.
