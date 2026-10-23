# CLAUDE.md: ShadowAstra Atlas

NASA Space Apps 2026 (Dhaka) project by team **ShadowAstra**. The challenge is *Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars*.
Live: https://shadowastra-atlas.vercel.app · Repo: https://github.com/ABRUBAB/ShadowAstra_Atlas (Vercel auto-deploys `main`).

**Start by reading `docs/HANDOFF.md`.** It has the full context, the code map, the gotchas and the TODOs. Also see `docs/PROJECT_PLAN.md`, `DESIGN.md`, `docs/SUBMISSION.md`. Chat history: `../_claude_history/CHAT_LOG.md`.

## Owner rules (always)
- Commit and push straight to `main` as **ABRUBAB <rubab2712@gmail.com>**. **Never add Claude or any AI as co-author** (no `Co-Authored-By`).
- Deadlines are tight: do the work, verify it, push. Keep questions to a minimum.
- Premium, not-AI-looking design: warm dark "observatory" palette, one sunlight accent (`--color-flare`), calm motion. Dark is the default; the light theme is warm paper. Follow `DESIGN.md`.
- **No em dashes (—) in website text.** Use plain, easy English.
- Real NASA/ESA data only. Label values **Computed / Demo / Reality gap**, and never invent numbers.
- The mascot **Astra is "he"**. Keep him present and reactive on pages.
- 3D first, 2D where it helps.

## Commands
`npm install` · `npm run dev` (http://localhost:3000) · `npm run build` · `npm run typecheck` · data: see `pipeline/README.md`
URL helpers: `?theme=light|dark`, `?splash=0`, `/lab?earth=<id or @lat,lon>&target=<id>&task=<id>#geology`, `/discover?target=<id>&task=<id>&at=<lat,lon>`.

## Key gotchas
- Theme-sensitive colours use `var(--color-*)`. Space scenes are wrapped in `data-theme="dark"`. SVG colours go in `style`, not attributes.
- Leaflet: never zoom mid-`flyTo` (`BodyMap` calls `map.stop()`); the Lab positions paired maps with `animate=false`.
- Trek 8-bit DEM calibrations (Moon −9150+78.2·DN, Mars −10538+129.9·DN) are preview-grade.
- Sentinel-2 cloudless has polar artifacts, so `earthVisible()` switches to Blue Marble above |60°|.
- The global grid (`public/data/grid.bin` + `grid.json`) is built by `pipeline/`; never hand-edit it. `src/lib/grid.ts` mirrors the Python scoring, keep them in sync.
- Cards use the `.surface` class (spotlight); shared components live in `src/components/ui/kit.tsx`.
