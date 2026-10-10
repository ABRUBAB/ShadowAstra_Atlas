---
name: ShadowAstra Atlas
direction: observatory — light & shadow
dials: {home: {variance: 7, motion: 7, density: 3}, atlas: {variance: 3, motion: 3, density: 7}}
colors:
  void: "#07080A"        # warm black canvas (never pure #000)
  ink: "#0B0C0F"         # alternate band
  panel: "#101114"       # cards
  line: "#212226"        # hairlines
  platinum: "#EDEAE4"    # bone-white text
  chrome: "#A8A59E"      # secondary text
  dim: "#6C6A65"         # tertiary text
  flare: "#F2C879"       # the ONE accent: low-angle sunlight — light/shadow + key moments
  worlds:
    earth: "#8FB4EA"
    moon: "#C9C5BC"
    mars: "#E08A5F"
  states:
    strong: "#7CC8A0"
    partial: "#E3B35E"
    weak: "#E47A63"
    demo: "chrome + dashed border"
    gap: "weak tint — reality gap, never scored"
typography:
  sans: Geist
  mono: Geist Mono       # coordinates, resolutions, labels
  serif: Instrument Serif # italic accent phrases only
  wide: Michroma         # wordmark only
motion:
  ease: cubic-bezier(.22,1,.36,1) (quint-out) / GSAP expo.out
  ui: 180-350ms (Motion springs for segmented controls)
  home-sections: 1.1-1.4s masked word reveals, 80ms stagger, hairline rules draw in
  mascot: Astra — calm CSS loops (float 4.2s, blink 5s); only the selected pin breathes
  reduced-motion: no auto-rotate, no parallax, instant states
---

# Design system

**Feeling:** an observatory at dusk. Warm blacks, bone-white type and one sunlight accent. Calm, precise and cinematic; no neon, no glow.

## Rules
- **Colour is reserved for meaning.** Surfaces are warm near-black. Blue, regolith-grey and oxide identify Earth, Moon and Mars. Sunlight (flare) marks light/shadow and the single key action. Green, ochre and terracotta show evidence, always with a word.
- **Film grain** over everything to avoid the flat digital-black look. Pins are still; only the selected one breathes.
- **Astra** expresses results (happy, thinking, sad) on a visor HUD, never as a cartoon face.
- **Every visual carries data.** Globe pins are real coordinates, every map is a NASA layer, and every 3D texture is a NASA mosaic. If an element could be replaced by a random glowing sphere, delete it.
- **3D first, 2D where it helps.** Globes give context. 2D tile maps carry detail, scale bars and layer switching.
- **Honesty is visible.** Illustrative graphics, prototype ratings and unscreened regions are labelled in the UI.
- Hairlines instead of shadows. Large type on the home page; dense, quiet panels in the Atlas.

## Don'ts
- No "92% match" style scores without a pipeline behind them.
- No neon gradients on content, and no glassmorphism under body text.
- No unlabelled AI imagery.
