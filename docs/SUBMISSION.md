# Submission texts (ready to paste)

## Space Apps form (updated 2 Nov 2026, v1.0, the final pre-hackathon release)

**Project Description**
> ShadowAstra Atlas helps mission teams find new places on Earth to rehearse a Moon base or a Mars mission. Tell it the destination, the job (a landing test, base life, rover drives, ice, lava tubes, a life search) and your team's limits in plain words, and it searches all 80,206 land areas measured with open NASA data, comparing each with the Moon or Mars spot at the same scale. You get ten new places with satellite views, reasons, a confidence badge, the 10 km piece whose ground is most alike (a hint, not a tested result), and a printable site report, and you can compare up to four side by side. Tap any spot on the Moon or Mars to see its closest Earth twins, and switch on the Caves and lava tubes layer (1,062 Mars cave candidates and 278 lunar pits). The scoring is tested: with each known analog site and its neighbours within 300 km hidden and the model retrained, the typical (median) site still lands in the top 2.4% of all land as the site scores it (the learned model alone: top 1.2%), and the typical one of 28 published sites the model never saw lands in the top 18%. New data only counts in the score if it passes the same test: a terrain AI trained on Kaggle GPUs finds Earth twins of any Moon or Mars spot, while NASA EMIT minerals (where EMIT can see bare, dry ground), LRO Diviner temperatures, Lunar Prospector oxides and Mars Odyssey water are shown as measured facts next to the scores, not scored. Lessons and a quiz work in English, Spanish and Bangla, with Astra, our field-test astronaut.

**Which NASA Data Source Are You Using? (197 characters, limit 200)**
> NASA POWER; GIBS MODIS; SRTM; EMIT L3; LRO LOLA, LROC, Diviner; MGS MOLA; Mars Odyssey GRS; Lunar Prospector GRS; Solar System Treks (Kaguya, Viking); CTX via Esri; USGS MGC3 caves; Smithsonian GVP

**Links:** live https://shadowastra-atlas.vercel.app · code https://github.com/ABRUBAB/ShadowAstra_Atlas · open data https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas

## NASA project page (global form, filled and saved 14 Nov 2026 13:50; not submitted)

Team page: https://www.spaceappschallenge.org/2026/find-a-team/shadowastra/?tab=project
Global deadline: Sunday 15 November, 11:59 PM Dhaka time ("Submit for Judging"). Only the last submission counts.
The form saves only with both boxes ticked ("Agree to Terms and Conditions", "Confirm All Work is Original"); they were ticked on the owner's yes.

**Project Name**
> ShadowAstra Atlas: Finding Earth Analogs for the Moon and Mars

**Summary** (1,195 of 1,500 characters, 198 words)
> ShadowAstra Atlas is a free web app that finds new places on Earth where teams can rehearse a permanent Moon base or a Mars mission. You pick the target (for example the lunar south pole or Jezero Crater), the job (landing tests, base life, rover drives, ice drilling, lava tubes or a search for life) and your team's limits. Atlas searches all 80,206 land areas of Earth, each about 55 km across and measured with open NASA data, compares every one with the target at the same scale, and returns ten new places: what matches, how strongly, where the analogy breaks down and which field tests to run. A model trained on 38 known analog sites and a terrain AI we trained on Kaggle GPUs help rank and match places. This matters because today's analog sites are few and not well characterized, and a place can look like Mars and still be the wrong test. We tested it in the open: 28 published analog sites the model never saw typically land in the top 18% of all land, and every test, including the ones that failed, is public. Live app: https://shadowastra-atlas.vercel.app · Code: https://github.com/ABRUBAB/ShadowAstra_Atlas · Open data: https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas

**Project Demonstration:** the 30-second demo (YouTube link, added after upload). It must be 30 seconds or less.

**Project:** https://shadowastra-atlas.vercel.app

**Project Details** (rich text, with these headings)

What it does
> ShadowAstra Atlas answers one question for a mission team: where on Earth should we rehearse this Moon or Mars mission? NASA's challenge asks for new Earth analogs for permanent Moon base locations and for Mars, characterized with open data and going beyond simply looking alike. Teams already train in a few famous places, such as the Atacama Desert, Haughton Crater and Death Valley, but the right place depends on the target and on the job, and no place on Earth copies everything (low gravity, vacuum, radiation).
>
> In the app you build a mission in plain words: a target on the Moon or Mars (for example Shackleton crater at the lunar south pole, or Jezero Crater), a job (landing tests, base life, rover drives, ice drilling, lava tubes or a search for life) and your team's limits. A 3D globe searches every land area live and returns ten new places, away from the famous sites.

How it works
> 1. **Every land area measured.** Our Python pipeline measured all 80,206 land areas of Earth (0.5 degrees, about 55 km) with NASA POWER climate, Terra MODIS ground temperature, plants and snow (via NASA GIBS), SRTM-based terrain, NASA EMIT minerals, volcanoes and impact craters. Each Moon and Mars target is measured the same way from LRO LOLA (118 m) and MGS MOLA (463 m) heights, with LRO Diviner temperatures and ice, and Lunar Prospector and Mars Odyssey chemistry and water.
> 2. **Four challenge factors, weighted by the job.** Ground shape (slopes and height range across 50 km), rocks and craters, cold and light, and bare, dry ground. A rover test and an ice search need different places, so the ranking changes with the job.
> 3. **Two AI models of our own.** A learned model (tuned XGBoost, LightGBM and logistic regression, picked from nine models with Optuna on Kaggle) adds what 38 known analog sites have in common. A self-supervised vision transformer (DINO ViT-S/8), trained on two Kaggle T4 GPUs with heights from Earth, the Moon and Mars, compares ground shape and finds Earth twins of any Moon or Mars spot.
> 4. **Honest results.** Each of the ten places shows what matches, how strongly, where the analogy breaks down, field tests to run, the nearest town, a confidence badge, the best 10 km spot inside it (a hint, not a tested result), a printable site report, and links to the same spot in NASA Worldview and Earthdata Search. Every number is labelled Computed, Learned or "Earth can't copy".
> 5. **It all runs in your browser.** The measured planet is about 5 MB of data, so scoring all 80,206 places takes about 16 ms on a laptop, with no server and no sign-in.

How we know it works
> With each known analog site and its neighbours within 300 km hidden and the model retrained, the typical known site still lands in the top 2.4% of all land (the learned model alone: top 1.2%). The typical one of 28 published analog sites the model never saw lands in the top 18%. New data only changes the score if it ranks the known sites better; otherwise it is shown as a measured fact (EMIT minerals, Diviner temperatures and ice, Lunar Prospector oxides, Mars Odyssey water). Every test, including the ones that failed, is on our How it works page: https://shadowastra-atlas.vercel.app/methods

Also in the app (bullets)
> A 3D compare of any place with its target at the same scale, with a movable Sun and a shadow map. · Earth twins: tap any spot on the Moon or Mars to see the Earth places with the most similar ground. · A caves and lava tubes layer with 1,062 Mars cave candidates and 278 lunar pits. · Three globes with live NASA layers. · A classroom page with lessons and a quiz in English, Spanish and Bangla, with Astra, our field-test astronaut. · Every score is open on Hugging Face (CC BY 4.0) and all the code is on GitHub.

Benefits and intended impact
> Mission teams get a ranked shortlist of new practice sites for their exact target and job, with the gaps written out, instead of reusing the same few famous places. Field scientists get a quick way to check any place against the Moon or Mars with open data. Students anywhere, including in Bangladesh, can see how these choices are made, in their own language.
>
> Next: our scientific validation lead reviews the top new sites; we want planetary scientists to test one of them on the ground; we will add LRO LEND and Mini-RF signs of ice from NASA's 2026 challenge resources and finer slopes from MRO HiRISE; and we plan a classroom pilot in Dhaka.

What makes it creative
> Analog sites are usually picked by reputation. Atlas turns the question around: start from the mission, measure the whole planet the same way as the target, and let the job decide what "alike" means. It is honest by design: it says where each analogy breaks down, labels what Earth cannot copy, and publishes the failed tests too. And it brings the Moon and Mars to a classroom in Dhaka, in Bangla.

Factors we considered (bullets)
> **Scale.** Scores are averages over 55 km areas, so the best 10 km spot is only a hint. · **Honesty.** No place on Earth copies low gravity, vacuum or radiation, and the app says so for every place. · **Validity.** The model is tested on sites it never saw, and new data must earn its place in the score. · **Field ethics.** Visits need permits, local partners and care for the land. · **Access.** It runs in any modern browser with no sign-in, switches to a lighter mode on slow computers, has light and dark themes, and teaches in three languages.

Tools and technologies
> App: React 19, TypeScript, Vite, Tailwind CSS v4, three.js with React Three Fiber, Leaflet, GSAP, Lenis and Motion. Data pipeline and models: Python with NumPy, SciPy, scikit-learn, XGBoost, LightGBM and Optuna, and PyTorch for the terrain transformer on Kaggle (two T4 GPUs). Quality: Vitest, Playwright and axe tests, with GitHub Actions for CI and uptime checks. Hosting: Vercel for the app and Hugging Face for the open dataset. Video: ffmpeg and our own Python edit pipeline.

How we used SI tools
> Claude (Anthropic), through Claude Code, helped us write and test the code (including Astra, our mascot, who is drawn in code), the data pipeline, the documentation and the video edit. The team set every goal and data choice, checked every number against our tests and reviewed every change. The two models described above are our own machine learning, trained by the team. Our demo video uses NASA footage, screen recordings of our app and the real voice of team member Mohammed Mahmud Parvez.

Team ShadowAstra, Dhaka, Bangladesh
> Abdullah Rubab (team lead), Tanvir Hossin (planetary terrain), Mohammad Saniul Alam (experience design), Tasnuva Arif (development and testing), Md. Tanvir Hasan (scientific validation), Mohammed Mahmud Parvez (film editing).

Links (bullets)
> Live app · Code · Open data · "Method and every test: https://shadowastra-atlas.vercel.app/methods". Last line: "NASA does not endorse this project."

**Use of Super Intelligence (SI)** (for data collection only; the judges do not see it). Ticked: Ideation or Brainstorming; Research or Information Gathering; Data Analysis and Interpretation; Building SI/ML Into the Project; Coding, Debugging, or Troubleshooting; Writing, Editing, or Translation; Visual Design or Image Creation; Presentation, Video, or Audio.

**NASA Data** (19 links)

| Link Text | Link Url |
|---|---|
| NASA POWER climatology (air temperature, rain, humidity, sunshine) | https://power.larc.nasa.gov/ |
| Terra MODIS land surface temperature, NDVI, snow and land cover, via NASA GIBS | https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api |
| NASA GIBS Blue Marble, Black Marble and ASTER relief imagery | (the same GIBS page) |
| SRTM elevation, used through AWS Terrain Tiles (slopes, height range, 3D ground) | https://registry.opendata.aws/terrain-tiles/ |
| NASA EMIT L3 surface mineral abundance (EMITL3ASA v002), LP DAAC | https://www.earthdata.nasa.gov/data/catalog/lpcloud-emitl3asa-002 |
| LRO LOLA global elevation model, 118 m (USGS Astrogeology) | https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m |
| LRO LOLA tiles and polar hillshade, NASA Moon Trek | https://trek.nasa.gov/moon/ |
| LRO LROC WAC global mosaic (Moon imagery) | https://astrogeology.usgs.gov/search/map/moon_lro_lroc_wac_global_morphology_mosaic_100m |
| LROC lunar pit locations, 278 pits (Wagner and Robinson, ASU) | https://lroc.im-ldi.com/atlases/pits |
| LRO Diviner Lunar Radiometer (ground temperature, stable ice), PDS Geosciences | https://pds-geosciences.wustl.edu/missions/lro/diviner.htm |
| Lunar Prospector gamma-ray spectrometer (iron and titanium oxide), PDS Geosciences | https://pds-geosciences.wustl.edu/missions/lunarp/ |
| MGS MOLA global elevation model, 463 m (USGS Astrogeology) | https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m |
| Mars Trek elevation and imagery tiles, NASA Solar System Treks | https://trek.nasa.gov/mars/ |
| Viking MDIM 2.1 colour mosaic of Mars (USGS Astrogeology) | https://astrogeology.usgs.gov/search/map/mars_viking_mdim21_clrmosaic_global_232m |
| Mars Odyssey gamma ray spectrometer (water-equivalent hydrogen), PDS Geosciences | https://pds-geosciences.wustl.edu/missions/odyssey/grs.html |
| MRO CTX global mosaic of Mars (Caltech Murray Lab) | https://murray-lab.caltech.edu/CTX/ |
| NASA Worldview (every place links to the same spot) | https://worldview.earthdata.nasa.gov/ |
| NASA Earthdata Search (every place links to the same spot) | https://search.earthdata.nasa.gov/ |
| NASA Image and Video Library (footage in our demo video) | https://images.nasa.gov/ |

**Space Agency Partner & Other Data** (17 links)

| Link Text | Link Url |
|---|---|
| ESA Copernicus Sentinel-2: Sentinel-2 cloudless 2020 by EOX (contains modified Copernicus Sentinel data) | https://s2maps.eu/ |
| JAXA SELENE (Kaguya) Moon imagery, via NASA Moon Trek | https://trek.nasa.gov/moon/ |
| USGS Mars Global Cave Candidate Catalog (Cushing), 1,062 cave candidates | https://astrogeology.usgs.gov/search/map/mars_global_cave_candidate_catalog_v1_cushing |
| Smithsonian Global Volcanism Program (Holocene volcanoes) | https://volcano.si.edu/ |
| Earth Impact Database, PASSC (confirmed impact craters) | https://www.passc.net/EarthImpactDatabase/ |
| GLiM global rock map (Hartmann and Moosdorf 2012) | https://doi.org/10.1594/PANGAEA.788537 |
| Natural Earth (place names) | https://www.naturalearthdata.com/ |
| Esri World Imagery (Maxar, Airbus and others), for close-up viewing | https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9 |
| Published analog-site studies: 38 training sites and 28 test sites (sources on our How it works page) | https://shadowastra-atlas.vercel.app/methods |
| Our open dataset on Hugging Face (CC BY 4.0) | https://huggingface.co/datasets/ABRUBAB/shadowastra-atlas |
| Our code on GitHub (MIT License) | https://github.com/ABRUBAB/ShadowAstra_Atlas |
| Open-source app libraries: React, three.js, React Three Fiber, Leaflet, GSAP, Tailwind CSS and more (package.json) | https://github.com/ABRUBAB/ShadowAstra_Atlas/blob/main/package.json |
| Open-source Python libraries: NumPy, SciPy, scikit-learn, XGBoost, LightGBM and more (requirements.txt) | https://github.com/ABRUBAB/ShadowAstra_Atlas/blob/main/pipeline/requirements.txt |
| PyTorch, for the terrain transformer | https://pytorch.org/ |
| Kaggle notebooks with two T4 GPUs (model training) | https://www.kaggle.com/ |
| Vercel (hosting the app) | https://vercel.com/ |
| Claude Code by Anthropic (SI coding assistant) | https://claude.com/product/claude-code |

All links checked on 14 Nov from Dhaka. volcano.si.edu and naturalearthdata.com refuse scripted checks but open in a browser.

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
