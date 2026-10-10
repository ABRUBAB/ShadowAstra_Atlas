---
name: ShadowAstra Atlas
direction: obsidian-cinematic
dials: {home: {variance: 7, motion: 7, density: 3}, atlas: {variance: 3, motion: 3, density: 7}}
colors:
  void: "#020306"        # canvas
  ink: "#06080D"         # alternate section band
  panel: "#0A0D14"       # panels
  line: "#1B2130"        # hairlines
  platinum: "#F3F5F7"    # primary text
  chrome: "#AFB9C7"      # secondary text
  dim: "#6F7A8C"         # tertiary text
  worlds:                # colour = which body we are talking about
    earth: "#75BBFF"
    moon: "#D6DBE4"
    mars: "#E08A5F"
  states:
    strong: "#4ADE9B"
    partial: "#F5B84A"
    weak: "#FF6B6B"
    unknown: "chrome + dashed border + ? glyph"
    queued: "#9B86D9 dashed"   # screening regions, never scored
typography:
  sans: Geist
  mono: Geist Mono       # coordinates, resolutions, labels
  serif: Instrument Serif # italic accent phrases only
  wide: Michroma         # wordmark only
motion:
  ui: 150-220ms ease-out (Motion)
  home-sections: 600-900ms (GSAP ScrollTrigger + SplitText, Lenis)
  reduced-motion: no auto-rotate, no parallax, instant states
---

# Design system

**Feeling:** a mission-control briefing at night. Calm, precise and cinematic. It should not look like a sci-fi game.

## Rules
- **Colour is reserved for meaning.** Surfaces are near-black. Blue, silver and copper identify Earth, Moon and Mars. Green, amber and red show evidence strength, always with a glyph and a word.
- **Every visual carries data.** Globe pins are real coordinates, every map is a NASA layer, and every 3D texture is a NASA mosaic. If an element could be replaced by a random glowing sphere, delete it.
- **3D first, 2D where it helps.** Globes give context. 2D tile maps carry detail, scale bars and layer switching.
- **Honesty is visible.** Illustrative graphics, prototype ratings and unscreened regions are labelled in the UI.
- Hairlines instead of shadows. Large type on the home page; dense, quiet panels in the Atlas.

## Don'ts
- No "92% match" style scores without a pipeline behind them.
- No neon gradients on content, and no glassmorphism under body text.
- No unlabelled AI imagery.
