# Submission texts (ready to paste)

## Space Apps form (updated 2 Nov 2026, v1.0, the final pre-hackathon release)

**Project Description**
> ShadowAstra Atlas helps mission teams find new places on Earth to rehearse a Moon base or a Mars mission. Tell it the destination, the job (a landing test, base life, rover drives, ice, lava tubes, a life search) and your team's limits in plain words, and it searches all 80,206 land areas measured with open NASA data, comparing each with the Moon or Mars spot at the same scale. You get ten new places with satellite views, reasons, a confidence badge, the 10 km piece whose ground is most alike (a hint, not a tested result), and a printable site report, and you can compare up to four side by side. Tap any spot on the Moon or Mars to see its closest Earth twins, and switch on the Caves and lava tubes layer (1,062 Mars cave candidates and 278 lunar pits). The scoring is tested: with each known analog site and its neighbours within 300 km hidden and the model retrained, the typical (median) site still lands in the top 2.4% of all land as the site scores it (the learned model alone: top 1.2%), and the typical one of 28 published sites the model never saw lands in the top 18%. New data only counts in the score if it passes the same test: a terrain AI trained on Kaggle GPUs finds Earth twins of any Moon or Mars spot, while NASA EMIT minerals (where EMIT can see bare, dry ground), LRO Diviner temperatures, Lunar Prospector oxides and Mars Odyssey water are shown as measured facts next to the scores, not scored. Lessons and a quiz work in English, Spanish and Bangla, with Astra, our field-test astronaut.

**Which NASA Data Source Are You Using? (197 characters, limit 200)**
> NASA POWER; GIBS MODIS; SRTM; EMIT L3; LRO LOLA, LROC, Diviner; MGS MOLA; Mars Odyssey GRS; Lunar Prospector GRS; Solar System Treks (Kaguya, Viking); CTX via Esri; USGS MGC3 caves; Smithsonian GVP

**Links:** live https://shadowastra-atlas.vercel.app · code https://github.com/ABRUBAB/ShadowAstra_Atlas · open data https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas

## NASA project page (drafted 13 Nov 2026, hackathon day 1)

Fields as the Bangladesh Participants Guide (section 10) describes them; the real form's names and limits need a login to check.
Fill every `[FILL]` before pressing Submit, and open every link in a private window first.

**High-Level Summary**
> ShadowAstra Atlas finds new places on Earth where teams can rehearse a permanent Moon base or a Mars mission. You choose the target (for example the lunar south pole or Jezero Crater), the job (landing tests, base life, rover drives, ice drilling, lava tubes, a search for life) and your team's limits. Atlas searches all 80,206 land areas of Earth, each about 55 km across and measured with open NASA data, compares each one with the target at the same scale, and returns ten new places: what matches, how strongly, where the analogy breaks down, and which field tests to run there. A learned model trained on 38 known analog sites and a terrain AI trained on Kaggle GPUs help rank and match them, and every test, including the ones that failed, is public. It is for mission planners, field scientists and students. Video: [FILL: Video 2 YouTube link]. Code: https://github.com/ABRUBAB/ShadowAstra_Atlas. Live app: https://shadowastra-atlas.vercel.app. Open data: https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas

**Project Demo:** [FILL: Video 3, the 30-second video, YouTube link]

**Final Project:** https://github.com/ABRUBAB/ShadowAstra_Atlas (code, data pipeline, tests and documentation; method and every test result at https://shadowastra-atlas.vercel.app/methods)

**Project Details, block 1: the why, the what, the how**
> Why: NASA and other agencies rehearse Moon and Mars missions in a few famous places, but these sites are not well characterized, and a place can look like Mars and still be the wrong test. The right place depends on the target and on the job, and no place on Earth copies everything (gravity, vacuum, radiation).
> What: a web app with a mission builder (target, job, limits), a 3D planet that searches every land area, ten new places with honest reports and printable site reports, a 3D compare of any place with its target (matched scale, a movable Sun and a shadow map), Earth twins for any spot on the Moon or Mars, a caves and lava tubes layer, a best 10 km spot inside each place (a hint), a classroom page in English, Spanish and Bangla, and links from every place to the same spot in NASA Worldview and Earthdata Search.
> How: our Python pipeline measured every 0.5° land area of Earth with NASA data and scored it on four challenge factors: ground shape (slopes and height range across 50 km, from SRTM-based terrain against LRO LOLA 118 m or MGS MOLA 463 m), rocks and craters, cold and light, and bare, dry ground. A learned model (tuned XGBoost, LightGBM and logistic regression, picked from nine models with Optuna on Kaggle) adds what 38 known analog sites have in common. A self-supervised vision transformer (DINO ViT-S/8), trained on Kaggle GPUs on heights from Earth, the Moon and Mars, compares ground shape and finds twins. Tests: with each known site and its neighbours within 300 km hidden and the model retrained, the typical site still lands in the top 2.4% of all land (the model alone: top 1.2%); the typical one of 28 published sites the model never saw lands in the top 18%. New data only changes the score if it ranks the known sites better; otherwise it is shown as a measured fact (EMIT minerals, Diviner temperatures and ice, Lunar Prospector oxides, Mars Odyssey water). Every dataset is listed in the NASA data field below.

**Project Details, block 2: community, highlights, benefits**
> We want mission teams to get a ranked shortlist of new practice sites with the gaps written out, and students anywhere to see how these choices are made. Highlights: the mission builder in plain words; reports that say where each analogy breaks down; Earth twins of any Moon or Mars spot; 3D compare with real Sun angles; caves and lava tubes; a printable site report; lessons and a quiz in English, Spanish and Bangla with Astra, our field-test astronaut; every score open on Hugging Face (CC BY 4.0) and every test public on the How it works page. Next: our scientific validation lead reviews the top new sites, and we want planetary scientists to test one on the ground, plus a classroom pilot in Dhaka. Important to know: scores are 55 km averages; field visits need permits, local partners and care for the land; NASA does not endorse this project.

**Project Details, block 3: tools and technologies**
> React 19, TypeScript, Vite, Tailwind CSS v4, three.js with React Three Fiber, Leaflet, GSAP, Lenis and Motion for the app; Python with NumPy, SciPy, scikit-learn, XGBoost, LightGBM and Optuna for the data pipeline and models; PyTorch for the DINO terrain transformer on Kaggle (two T4 GPUs); Vitest, Playwright and axe for tests; GitHub Actions for CI and uptime checks; Vercel for hosting; Hugging Face for the open dataset; ffmpeg and our own Python edit pipeline for Video 2; Premiere Pro and Canva for Video 1. Thanks to NASA, USGS Astrogeology, PDS Geosciences, ESA, EOX, the Smithsonian Global Volcanism Program, PASSC, Natural Earth and every open-source project above.

**Use of AI**
> AI inside the solution: (1) a learned model (XGBoost, LightGBM and logistic regression, tuned with Optuna on Kaggle) trained on 38 known analog sites and our measured features of every land area, to rank places; (2) a self-supervised vision transformer (DINO ViT-S/8) trained on Kaggle GPUs on elevation patches from Earth (SRTM-based terrain), the Moon (LRO LOLA) and Mars (MGS MOLA), to compare ground shape and find Earth twins. Both are tested on sites they never saw, and the results are on our How it works page.
> AI used to build it: Claude (Anthropic), through Claude Code, helped write and test the code, the data pipeline, the documentation, the narration script and the Video 2 edit pipeline. The team set every goal and data choice, checked every number against our tests, and reviewed every change; typical prompts were feature requests, reviews ("act as a judge and find every problem") and fixes. Gemini (Google) made Video 1's logo animation. [FILL: any other AI tool a team member used, with what for.]

**NASA data sources used (with partner data)**
> Earth: NASA POWER climatology (air temperature, coldest and hottest months, rain, humidity, sunshine); Terra MODIS land surface temperature, NDVI, snow and land cover via NASA GIBS (coldest night, hottest day, plants, snow, bare ground); SRTM-based terrain via AWS Terrain Tiles (slopes, height range, roughness, 3D ground); NASA EMIT L3 surface minerals, LP DAAC (clays, sulfates, carbonates, iron oxides; shown as facts); NASA GIBS Blue Marble, Black Marble and ASTER relief (globe and imagery); NASA Worldview and Earthdata Search (linked from every place). Moon: LRO LOLA 118 m DEM, USGS (slopes and height range); LOLA tiles and polar hillshade, NASA Solar System Treks (3D ground, shadow map); LROC WAC mosaic and the LROC lunar pit atlas, NASA/ASU (imagery; 278 pits); LRO Diviner via PDS (ground temperature at all ten Moon targets, stable ice near the south pole); Lunar Prospector GRS via PDS (iron and titanium oxide). Mars: MGS MOLA 463 m DEM, USGS (slopes and height range); Viking MDIM 2.1 (imagery); Mars Odyssey GRS via PDS (water-equivalent hydrogen); USGS Mars Global Cave Candidate Catalog (1,062 cave candidates); CTX mosaic via Esri (imagery). Partner agencies: ESA Copernicus Sentinel-2 (Sentinel-2 cloudless 2020 by EOX; imagery and 3D drape); JAXA Kaguya imagery via NASA Solar System Treks (Moon close-ups). Other: Smithsonian Global Volcanism Program (1,214 Holocene volcanoes), Earth Impact Database (62 confirmed craters), GLiM rock map (main rock type), Natural Earth (place names).

**References**
> Data: NASA POWER (power.larc.nasa.gov); NASA GIBS and Worldview (earthdata.nasa.gov); EMIT L3 ASA v2 (doi:10.5067/EMIT/EMITL3ASA.002); USGS Astrogeology LOLA 118 m and MOLA 463 m DEMs; PDS Geosciences (Diviner, Lunar Prospector, Mars Odyssey); NASA Solar System Treks; LROC (lroc.im-ldi.com); LROC lunar pit atlas (Wagner and Robinson, ASU); USGS Mars Global Cave Candidate Catalog (Cushing); AWS Terrain Tiles (registry.opendata.aws/terrain-tiles); Sentinel-2 cloudless by EOX (s2maps.eu, contains modified Copernicus Sentinel data 2020); Smithsonian GVP (volcano.si.edu); Earth Impact Database (passc.net); GLiM (Hartmann and Moosdorf 2012, doi:10.1594/PANGAEA.788537); Natural Earth. Methods: Caron et al. 2021 (DINO, self-supervised vision transformers); Chen and Guestrin 2016 (XGBoost); Ke et al. 2017 (LightGBM); Akiba et al. 2019 (Optuna); Pedregosa et al. 2011 (scikit-learn). Known analog sites: [FILL: point to the list of the 38 training sites and the 28 published test sites with their sources]. Footage in our videos: NASA (images.nasa.gov), Pexels; full credits in each video's description.

## YouTube

**Title:** ShadowAstra Atlas | Rehearse the Moon & Mars on Earth | NASA Space Apps Challenge 2026, Dhaka

**Description**
```
Where on Earth can we practise for a Moon base or a Mars mission?

We are Team ShadowAstra from Dhaka, Bangladesh, and this is our project for the 2026 NASA Space Apps Challenge: ShadowAstra Atlas.

🌑 THE CHALLENGE
"Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars."
Places like the Atacama Desert, Haughton Crater and Death Valley let mission teams test rovers, tools and plans before they fly. But these analog sites are not well characterized, and new ones are still waiting to be found.

🚀 OUR SOLUTION: SHADOWASTRA ATLAS
A web atlas that finds and characterizes new Earth practice sites for a chosen Moon or Mars mission.
• Find new sites: pick a destination, a job and your limits; all 80,206 land areas on Earth are searched live.
• Matched to the job: a rover test and an ice search need different places, so the ranking changes with the task.
• Earth twins: tap any spot on the Moon or Mars and see the Earth places with the most similar ground, found by our formula or by a terrain AI trained on Kaggle GPUs.
• Minerals from orbit: where NASA's EMIT can see bare, dry ground, each place report shows its clays, sulfates and iron oxides next to the minerals rovers study on Mars. These are facts, not part of the score.
• Compare: any Earth place next to its target at the same scale, in maps and 3D, with a movable Sun and a shadow map.
• Caves and lava tubes: a layer on the Moon and Mars maps with 1,062 Mars cave candidates and 278 lunar pits.
• Tested in the open: the typical hidden known site ranks in the top 2.4% of all land as the site scores it (the learned model alone: top 1.2%); the typical one of 28 sites the model never saw ranks in the top 18%. The best 10 km spot is a hint, not a passed test.
• Honest labels: every number is Computed, Learned or "Earth can't copy", with a confidence badge for each place.
• Learn: lessons and a quiz in English, Spanish and Bangla.
• Astra: our field-test astronaut, who reacts to results and answers questions.

🛰️ OPEN DATA WE USE
NASA POWER, NASA GIBS (MODIS, Blue Marble, Black Marble), SRTM elevation, NASA EMIT minerals, LRO LOLA and Diviner (all ten Moon targets), Lunar Prospector gamma-ray spectrometer, MGS MOLA, Mars Odyssey GRS, NASA Solar System Treks (LROC, Kaguya, Viking), the CTX mosaic (Caltech Murray Lab, served by Esri), USGS Mars cave candidates (MGC3, Cushing), the LROC lunar pit atlas (Wagner and Robinson, ASU), Smithsonian volcano records, the Earth Impact Database, GLiM rock map and ESA Copernicus Sentinel-2.

🔗 LINKS
Live website: https://shadowastra-atlas.vercel.app
Source code: https://github.com/ABRUBAB/ShadowAstra_Atlas
Open dataset: https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas
Challenge: https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/

👩‍🚀 TEAM SHADOWASTRA
• Abdullah Rubab: Team Lead
• Tanvir Hossin: Planetary Terrain Research
• Md. Tanvir Hasan: Scientific Validation
• Mohammad Saniul Alam: Experience Design
• Tasnuva Arif: Development and Testing (narrated Video 1)
• Mohammed Mahmud Parvez: Film and Motion (narrates Video 2)

📍 EVENT
NASA International Space Apps Challenge 2026, Dhaka local event, Bangladesh.
Space Apps is a global hackathon run by NASA's Science Mission Directorate, where teams use NASA's free and open data to solve real challenges on Earth and in space.

⏱️ CHAPTERS
00:00 Meet Team ShadowAstra
00:42 The problem: the "false friend" analog
01:30 Our solution: ShadowAstra Atlas
02:25 Impact & what's next

Imagery and data courtesy of NASA and ESA. NASA does not endorse this project.

#NASASpaceApps #SpaceApps2026 #ShadowAstra
```
Adjust the chapter times to match the final cut. Keep the first at 00:00 and use at least 3 chapters.

**Tags (455 / 500 characters)**
```
NASA Space Apps Challenge 2026,Space Apps 2026,NASA Space Apps Dhaka,Space Apps Bangladesh,ShadowAstra,ShadowAstra Atlas,Moon base,lunar south pole,Artemis,Mars analog,planetary analog,terrestrial analog sites,Mars mission,Moon mission,NASA open data,LRO LOLA,MOLA,Sentinel-2,3D terrain,space hackathon,Bangladesh space,Dhaka hackathon,space exploration,astrobiology,lava tubes,Atacama Desert,Shackleton crater,Gale crater,rover testing,space apps project
```
