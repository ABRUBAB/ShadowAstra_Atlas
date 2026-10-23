<p align="center">
  <a href="https://shadowastra-atlas.vercel.app">
    <img src="docs/readme/banner.svg" alt="ShadowAstra Atlas: practise for other worlds on this one" width="100%" />
  </a>
</p>

<p align="center">
  <a href="https://shadowastra-atlas.vercel.app"><img alt="Live demo" src="https://img.shields.io/badge/LIVE%20DEMO-shadowastra--atlas.vercel.app-F2C879?style=for-the-badge&labelColor=07080A"></a>
  <a href="https://www.spaceappschallenge.org/2026/challenges/identify-earth-locations-that-analog-the-permanent-moon-base-locations-and-mars/"><img alt="NASA Space Apps 2026" src="https://img.shields.io/badge/NASA%20SPACE%20APPS-2026%20%C2%B7%20DHAKA-8FB4EA?style=for-the-badge&labelColor=07080A"></a>
</p>
<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-EDEAE4?style=flat-square&labelColor=101114&logo=react&logoColor=8FB4EA">
  <img alt="three.js" src="https://img.shields.io/badge/three.js-WebGL-EDEAE4?style=flat-square&labelColor=101114&logo=threedotjs&logoColor=EDEAE4">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-EDEAE4?style=flat-square&labelColor=101114&logo=typescript&logoColor=8FB4EA">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-EDEAE4?style=flat-square&labelColor=101114&logo=vite&logoColor=F2C879">
  <img alt="Open data" src="https://img.shields.io/badge/data-NASA%20%C2%B7%20ESA-EDEAE4?style=flat-square&labelColor=101114">
  <img alt="MIT" src="https://img.shields.io/badge/license-MIT-EDEAE4?style=flat-square&labelColor=101114">
</p>

<p align="center">
  <b>Where on Earth can we practise for a Moon base or a Mars mission?</b><br/>
  ShadowAstra Atlas measures every land area on Earth with open NASA data, compares it with Moon and Mars places<br/>
  at the same scale, ranks the whole planet for the job you pick, and says plainly what Earth can never copy.
</p>

<p align="center">
  <a href="https://shadowastra-atlas.vercel.app"><b>Open the live site</b></a> ·
  <a href="https://shadowastra-atlas.vercel.app/discover"><b>Find new sites</b></a> ·
  <a href="https://shadowastra-atlas.vercel.app/lab"><b>Compare in 3D</b></a> ·
  <a href="pipeline/README.md"><b>Data pipeline</b></a> ·
  <a href="#-team-shadowastra"><b>Team</b></a>
</p>

---

<p align="center">
  <img src="docs/readme/discover.jpg" alt="Find new sites: the whole Earth ranked live for a Mars life-search mission, with a 3D score globe and a ranked list" width="100%" />
</p>

## 🌑 The challenge

> *“Places on Earth that have analogous characteristics to the Moon or Mars allow mission teams to test equipment and methods before they fly; however, such terrestrial analog sites are not entirely well characterized. Your challenge is to use open Earth, Moon, and Mars data from NASA and other space agencies to identify and characterize new terrestrial analogs.”*
> NASA Space Apps Challenge 2026, **Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars**

Famous analogs such as Atacama, Haughton Crater and Death Valley were chosen by reputation and access. A place can **look** like Mars and still be the wrong place to test a rover. So we did the opposite of picking by eye: **we measured all of Earth's land the same way, and let the mission decide.**

## 📊 In numbers

| | |
|---|---|
| **80,206** | land areas measured (every 0.5° cell, about 55 km wide) |
| **24** | measurements per place: slopes, height range, roughness, cold nights, hot days, rain, humidity, plants, snow, bare ground, volcanoes, craters… |
| **18** | Moon and Mars targets measured at full precision (LRO LOLA 118 m, MGS MOLA 463 m) |
| **38 + 28** | known analog sites to teach and test the model, plus 28 published sites kept out of training as an untouched test |
| **top 2.2%** | where hidden known sites rank among all land, as the site shows them (hold-out: each site and its neighbours within 300 km hidden, model retrained) |
| **top 21%** | where the 28 never-seen sites rank (Moon sites: top 5%); a simple rule manages top 40% |
| **78%** | of 78 sites rank higher when scored for the job they were really used for (sign test p < 0.001) |
| **9 of 10** | top places that stay put when every weight shifts by ±25% |

## ✨ What you can do

| | Feature | What it does |
|---|---|---|
| 🌍 | **Find new sites** | A mission builder: pick a Moon or Mars destination, the job (landing, base life, rover drive, ice, lava tubes, life search, craters, low Sun) and your team's needs in plain words (how far from home, near a town, altitude, month). All 80,206 land areas are searched live; you get ten distinct new places with satellite views, reasons and hints about which rule hides better sites. |
| ⚖️ | **Compare up to four** | Pick results and see them side by side: the four factors, measured values, rock type, distance, trip CO₂ and confidence. |
| 🪐 | **Earth twins of any spot** | Tap anywhere on the Moon or Mars. Kaggle-measured LOLA and MOLA ground is compared with every place on Earth. |
| 🎓 | **Learn, in English or Bangla** | Short lessons, a quiz scored with real data, and a printable worksheet for classrooms. |
| 📄 | **Site report** | A printable one-page dossier for any place: the four factors on Earth and the target, field tests, planning, permission and what Earth can't copy. |
| 📍 | **Check your town** | Type any town. See how Moon-like and Mars-like it is, its real climate numbers, and the nearest strong practice site. |
| ⛰️ | **Compare in 3D** | Any Earth place next to its Moon or Mars target: real heights, real imagery, a movable Sun, a shadow map, best months to go and travel CO₂. |
| 🎮 | **Earth or Mars?** | A game with real orbital images of known look-alike pairs, same scale, colour off. |
| 🧑‍🚀 | **Astra** | Our field-test astronaut shivers in the cold, sweats in the heat, cheers good matches and answers questions from the real data. |
| 🏷️ | **Honest labels** | Every value is **Computed**, **Learned** or **Earth can't copy**, and every place has a confidence badge (real measurements and model agreement); thin evidence says **Not enough evidence**. |
| ⌨️ | **Search everything** | `Ctrl K` or `/` searches pages, Moon and Mars places, known sites and any town on Earth. |

## 🔭 Tour

<table>
  <tr>
    <td width="50%"><img src="docs/readme/discover-report.jpg" alt="Place report for Kunlun Mountains"/><br/><sub><b>Place report.</b> Kunlun Mountains scores 0.90 for a Mars life search at Jezero: top 0.1% of all land. Astra shivers: nights reach −26 °C.</sub></td>
    <td width="50%"><img src="docs/readme/town.jpg" alt="Town checker with Dhaka"/><br/><sub><b>Check your town.</b> Dhaka: green and wet, 2,071 mm of rain a year. Astra points to the nearest strong site instead.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/readme/lab-compare.jpg" alt="Compare a new candidate with Jezero crater"/><br/><sub><b>Compare.</b> A new candidate (Tibesti, Chad) next to Jezero crater at the same metres per pixel. Every score row is measured.</sub></td>
    <td><img src="docs/readme/game.jpg" alt="Earth or Mars game"/><br/><sub><b>Earth or Mars?</b> Real Sentinel-2, Viking and LROC images of known look-alike pairs.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/readme/methods.jpg" alt="Model test results"/><br/><sub><b>The model had to prove itself.</b> Hidden known sites land in the top 2.2% of land; 28 sites it never saw land in the top 21%.</sub></td>
    <td><img src="docs/readme/light-mode.jpg" alt="Light mode"/><br/><sub><b>Light mode.</b> A warm paper theme with its own colours. Space scenes stay dark.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/readme/hero.jpg" alt="Home page"/><br/><sub><b>Home.</b> A 3D Earth from NASA Blue Marble and Black Marble.</sub></td>
    <td><img src="docs/readme/astra-moods.jpg" alt="Meet Astra"/><br/><sub><b>Meet Astra.</b> Ten reactions and a field log of badges you earn by exploring.</sub></td>
  </tr>
</table>

## ⚙️ How it works

```mermaid
flowchart LR
  A["🎯 Pick a job<br/>base · rover · ice · caves · life"] --> B["🌕 Pick a target<br/>Moon base region or Mars site"]
  B --> C["⛰️ Measure the target<br/>full-precision LOLA · MOLA<br/>50 km at 1.19 km spacing"]
  E["🌍 Measure all of Earth<br/>NASA POWER · MODIS · SRTM<br/>volcanoes · craters"] --> D
  C --> D["📊 Score 80,206 places<br/>5 measured scores + learned model<br/>in your browser"]
  D --> F["📍 Place report<br/>why · facts · best months"]
  F --> G["⛰️ Compare in 3D<br/>shadow map · travel CO₂"]
```

### The match score

| Part | How it is measured | Data |
|---|---|---|
| **Ground shape** | `0.65 · overlap(slope histograms) + 0.35 · height-range agreement`, same 50 km grid on both worlds | SRTM terrain tiles vs LOLA / MOLA |
| **Rocks & craters** | volcano and impact-crater proximity plus bare rock, depending on the job | Smithsonian GVP, Earth Impact Database, MODIS land cover |
| **Cold & heat** | coldest monthly night and the day-to-night swing (ice jobs add snow and ice) | MODIS land surface temperature, NASA POWER |
| **Sunlight angle** | `1 − W₁(Sun heights) / 25°`, earth-mover distance in Earth's best month | our solar geometry |
| **Bare, dry ground** | little rain and few plants | NASA POWER rain, MODIS NDVI |
| **Learned model** | LightGBM trained on 38 known sites (positive-unlabelled, 8 bags), 60% of the total by default (the share was chosen on the known sites only) | all of the above, plus GLiM rock groups |
| Gravity · Air · Radiation | shown next to every score, never added in | Earth can't copy |

Total = `(1 − m) · Σ wᵢ·vᵢ / Σ wᵢ + m · model`, with weights `wᵢ` from the job. Every slider re-ranks the planet live.

### A fair test

For every known test site we hid it **and every other known site within 300 km**, retrained the model, and checked where the hidden site ranked among all 80,206 places. Then we checked **28 more published sites that were never used for anything** (Austrian Space Forum, ISRO HOPE, Europlanet, NASA teams, Apollo training). `pipeline/s14_validate.py` reruns all of it from the website's own data files.

| | Learned model | What the site shows (60% model) | Mission factors only | Simple rule |
|---|---|---|---|---|
| Hidden known sites, typical rank | top 2.6% | **top 2.2%** | top 19% | top 31 to 35% |
| 28 never-seen sites, typical rank | top 18% | **top 21%** | top 41% | top 40% |
| Never-seen Moon sites | top 1.1% | **top 5.2%** | top 48% | top 36% |

More tests: choosing the job a site was really used for ranks it higher for 78% of 78 sites (p < 0.001); shifting every weight by ±25% keeps 8 to 10 of the top 10 places; taking out *Rocks & craters* hurts most. Honest limits: the mission factors alone find known sites only about as well as a simple rule, because many analog sites were chosen for something smaller than our 55 km cells (an ice cave, a small lake, hot springs). Their job is to explain why a place matches and to tune it to your target and job; the learned model finds them. The How it works page shows where it fails and why.

## 🛰️ Open data

| World | Data | Used for | From |
|---|---|---|---|
| 🌍 Earth | POWER climatology (MERRA-2) | air temperature, coldest and hottest months, rain, humidity, sunshine | NASA LaRC |
| 🌍 Earth | MODIS land surface temperature, NDVI, snow, land cover | night cold, day heat, plants, snow months, bare ground | NASA GIBS |
| 🌍 Earth | SRTM elevation (Terrain Tiles) | slopes, height range, roughness; 3D ground | NASA SRTM via AWS Open Data |
| 🌍 Earth | Holocene volcanoes · impact craters · place names | rocks score, report facts, readable names | Smithsonian GVP · Earth Impact Database · Natural Earth |
| 🌍 Earth | Sentinel-2 cloudless 2020 · Blue Marble · ASTER | imagery, 3D drape, globe, game | ESA Copernicus via EOX · NASA GIBS |
| 🌕 Moon | LRO LOLA global DEM (16-bit, 118 m) · LROC WAC | target terrain at full precision; maps, 3D, game | USGS Astrogeology · NASA Solar System Treks |
| 🔴 Mars | MGS MOLA global DEM (16-bit, 463 m) · Viking MDIM · THEMIS | target terrain at full precision; maps, 3D, game | USGS Astrogeology · NASA Solar System Treks |

**Next:** the official 2026 challenge datasets (released 28 Oct), NASA EMIT minerals, LRO Diviner, NASADEM, MRO HiRISE, JAXA Kaguya, ESA HRSC. The [pipeline](pipeline/README.md) is built so each new source is one script.

<details>
<summary><b>🏆 How we cover every award category</b></summary>

| Award | Where to see it |
|---|---|
| Best Use of Science | Every land area measured the same way as the target, at the same scale; a model tested by hiding known sites |
| Best Use of Data | NASA POWER, MODIS, SRTM, full-precision LOLA and MOLA, volcano and crater records in one open global dataset |
| Best Use of Technology | 80,206 places re-ranked live in the browser, 3D score globe, WebGL terrain from real heights, shadow model |
| Galactic Impact | Tells field teams where and when to practise, and what the practice can't prove |
| Best Mission Concept | Pick a job and a destination; the whole planet answers with places, reasons and best months |
| Most Inspirational | Astra reacts to cold, heat and honest results; anyone can check their own town |
| Best Storytelling | Earth to Moon to Mars, “looks alike is not enough”, light and shadow |
| Global Connection | Check any town on Earth; find the closest strong site from any city |
| Art & Technology | NASA-mosaic globes, a sunlight-and-shadow palette, light and dark themes |
| Local Impact | Dhaka-first workshops and a Bangla classroom mode (next) |

</details>

## 🌱 Sustainability & stewardship

- **Fewer trips.** Screen the whole planet remotely and fly only to the shortlist. Compare shows each trip's distance and rough CO₂.
- **Closest credible site.** The default home city is Dhaka; any team can choose its own.
- **Consent before coordinates.** Antarctic Treaty areas, national parks, sacred and Indigenous land are flagged.

## 🧪 Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build in dist/
```

Requires Node 20+. To rebuild the global data from scratch see [`pipeline/README.md`](pipeline/README.md) (Python 3, no logins needed).

**Handy links:** `?theme=light` · `?splash=0` skips the intro · `/discover?target=shackleton&task=polar` · `/discover?at=23.81,90.41` opens a place report · `/lab?earth=@21.25,17.75&target=jezero` compares any coordinates.

## 🚀 Deploy

Deployed on **Vercel** at [shadowastra-atlas.vercel.app](https://shadowastra-atlas.vercel.app). Vite build, output `dist`, every push to `main` redeploys.

## 🧱 Tech

React 19 · TypeScript · Vite · Tailwind CSS v4 · three.js + React Three Fiber · Leaflet · GSAP · Lenis · Motion · Python (NumPy, SciPy, LightGBM) for the data pipeline

**Performance:** the global dataset is 4.3 MB of typed arrays (1.8 MB gzipped), scored in under 20 ms per change; WebP textures in 1K, 2K and 4K; lazy routes and idle prefetch.

```
pipeline/      Python: download, measure and model all of Earth (s01 to s08)
public/data/   grid.bin + grid.json: the measured planet the website loads
src/
  lib/         grid (load, score, rank, search) · terrain · sun · scoring · astra
  components/  three (score globe, terrain slabs) · map · ui kit · Astra · game · town check
  pages/       Home · Discover · Lab (Compare) · Atlas (Maps) · Methods · About
```

## 🗺️ Roadmap

- [x] Live NASA maps for three worlds, 3D globes, lunar south-pole map
- [x] Compare in 3D: matched scale, terrain, shadow map, best months, travel CO₂
- [x] Every land area on Earth measured; full-precision LOLA and MOLA targets
- [x] Learned model with a spatial hold-out test
- [x] Find new sites, town checker, game, badges, search, Astra's live answers
- [x] Terrain encoder, first test: a self-supervised CNN on 86,000 height patches from all three worlds. On 49 expert pairs it ranks them in the top 44% vs 34% for the formula, so it stays optional
- [x] Mission builder, compare up to four, Earth twins of any Moon or Mars spot, Learn page in English and Bangla
- [x] Independent validation on 28 published sites, model-share curve, job test, robustness and ablations
- [x] Kaggle K1: full-precision LOLA and MOLA measured everywhere; K2: Earth patches; K5: model zoo with Optuna
- [ ] Kaggle K3: a self-supervised terrain transformer for three worlds on 2 × T4
- [ ] Official 2026 challenge datasets, EMIT minerals, Diviner temperatures
- [ ] Field test plan export (PDF) and a Bangla classroom mode

## 👩‍🚀 Team ShadowAstra

<table>
  <tr>
    <td align="center" width="16%"><img src="public/team/rubab.webp" width="110" alt="Abdullah Rubab"/><br/><b>Abdullah Rubab</b><br/><sub>Team lead</sub></td>
    <td align="center" width="16%"><img src="public/team/hossin.webp" width="110" alt="Tanvir Hossin"/><br/><b>Tanvir Hossin</b><br/><sub>Planetary terrain research</sub></td>
    <td align="center" width="16%"><img src="public/team/hasan.webp" width="110" alt="Md. Tanvir Hasan"/><br/><b>Md. Tanvir Hasan</b><br/><sub>Scientific validation</sub></td>
    <td align="center" width="16%"><img src="public/team/saniul.webp" width="110" alt="Mohammad Saniul Alam"/><br/><b>Mohammad Saniul Alam</b><br/><sub>Experience design</sub></td>
    <td align="center" width="16%"><img src="public/team/tasnuva.webp" width="110" alt="Tasnuva Arif"/><br/><b>Tasnuva Arif</b><br/><sub>Development & testing</sub></td>
    <td align="center" width="16%"><img src="public/team/parvez.webp" width="110" alt="Mohammed Mahmud Parvez"/><br/><b>Mohammed Mahmud Parvez</b><br/><sub>Film editing</sub></td>
  </tr>
</table>

<p align="center"><sub>Made in Dhaka, Bangladesh 🇧🇩 for the 2026 NASA Space Apps Challenge.</sub></p>

## 📜 Credits & license

Data: NASA POWER (LaRC); NASA GIBS / ESDIS; NASA Solar System Treks (JPL); USGS Astrogeology; LRO (LROC, LOLA), MGS MOLA, Viking, Mars Odyssey THEMIS, Terra MODIS & ASTER, Suomi NPP VIIRS; SRTM via AWS Terrain Tiles; Smithsonian Global Volcanism Program; Earth Impact Database (PASSC); Natural Earth; Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2020, CC BY-NC-SA 4.0).

NASA does not endorse this project. The 8-bit Trek elevation used for the 3D view is our own calibration (scores use the 16-bit USGS data), CO₂ numbers are rough estimates and site coordinates are approximate. Field visits need permission, local partners and care for the land.

Code is released under the [MIT License](LICENSE).
