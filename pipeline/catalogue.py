"""Reference lists used by the pipeline.

KNOWN_ANALOGS — published Earth analog field sites (NASA, ESA, CSA and university
campaigns). They are the *positive labels* for the analog model and the hold-out
test set. Coordinates are approximate site centres (fine for a 0.5 degree grid).
world: which body the site has been used to rehearse ("moon", "mars" or both).

IMPACTS — a selection of confirmed impact structures (Earth Impact Database), with
approximate diameters in km.

VALIDATION_SITES — published analog sites that are NOT used anywhere in training. They
are only used by s14_validate.py to test the finished scores. Each has the jobs its
programme was about, so we can also test that choosing a job moves the right places up.

LITHOLOGY / ROCK_FAMILY — GLiM rock classes (Hartmann & Moosdorf 2012) and how close each
is to the main rocks of a Moon or Mars target. The family of each target comes from its
published geology (USGS maps, mission papers); the table is ours and is shown on the site.
"""

KNOWN_ANALOGS = [
    # id, name, lat, lon, worlds
    ("dry-valleys", "McMurdo Dry Valleys", -77.5, 161.8, "moon,mars"),
    ("haughton", "Haughton Crater, Devon Island", 75.38, -89.68, "moon,mars"),
    ("atacama", "Atacama Desert (Yungay)", -24.08, -70.0, "mars"),
    ("mauna-kea", "Mauna Kea slopes", 19.82, -155.47, "moon,mars"),
    ("lava-beds", "Lava Beds National Monument", 41.71, -121.51, "moon,mars"),
    ("lanzarote", "Lanzarote", 29.16, -13.43, "moon,mars"),
    ("rio-tinto", "Río Tinto", 37.69, -6.59, "mars"),
    ("svalbard", "Bockfjord, Svalbard", 79.4, 13.3, "mars"),
    ("mdrs", "Mars Desert Research Station, Utah", 38.41, -110.79, "mars"),
    ("meteor-crater", "Meteor Crater, Arizona", 35.03, -111.02, "moon"),
    ("black-point", "Black Point Lava Flow, Arizona", 35.68, -111.43, "moon"),
    ("askja", "Askja & Holuhraun, Iceland", 65.05, -16.75, "moon,mars"),
    ("pilbara", "Pilbara, Australia", -21.0, 119.4, "mars"),
    ("ries", "Nördlinger Ries, Germany", 48.88, 10.57, "moon"),
    ("sudbury", "Sudbury Basin, Canada", 46.6, -81.18, "moon"),
    ("dallol", "Dallol, Ethiopia", 14.24, 40.3, "mars"),
    ("death-valley", "Death Valley, California", 36.25, -116.83, "mars"),
    ("craters-moon", "Craters of the Moon, Idaho", 43.42, -113.52, "moon,mars"),
    ("cinder-lake", "Cinder Lake crater field, Arizona", 35.3, -111.55, "moon"),
    ("sp-crater", "SP Crater, Arizona", 35.58, -111.63, "moon"),
    ("kilbourne", "Kilbourne Hole, New Mexico", 31.97, -106.97, "moon"),
    ("kilauea", "Kīlauea, Hawaiʻi", 19.41, -155.28, "moon,mars"),
    ("teide", "Teide, Tenerife", 28.27, -16.64, "moon,mars"),
    ("mistastin", "Mistastin Lake crater, Canada", 55.88, -63.3, "moon"),
    ("lonar", "Lonar Crater, India", 19.98, 76.51, "moon,mars"),
    ("axel-heiberg", "Axel Heiberg Island, Canada", 79.4, -90.8, "mars"),
    ("licancabur", "Licancabur & Altiplano lakes", -22.83, -67.88, "mars"),
    ("qaidam", "Qaidam Basin, China", 37.5, 93.0, "mars"),
    ("arkaroola", "Arkaroola, Australia", -30.3, 139.3, "mars"),
    ("erfoud", "Erfoud & Merzouga, Morocco", 31.1, -4.0, "mars"),
    ("gobi", "Gobi Desert, Mongolia", 43.5, 104.0, "mars"),
    ("concordia", "Concordia Station, Antarctica", -75.1, 123.33, "moon,mars"),
    ("undara", "Undara lava tubes, Australia", -18.2, 144.6, "moon,mars"),
    ("jeju", "Jeju lava tubes, South Korea", 33.5, 126.8, "moon"),
    ("mojave", "Mojave Desert (Dumont Dunes)", 35.68, -116.22, "mars"),
    ("namib", "Namib Desert, Namibia", -24.7, 15.3, "mars"),
    ("manicouagan", "Manicouagan crater, Canada", 51.38, -68.7, "moon"),
    ("haleakala", "Haleakalā, Maui", 20.71, -156.25, "mars"),
]

IMPACTS = [
    ("Vredefort", -27.0, 27.5, 300), ("Chicxulub", 21.3, -89.5, 180), ("Sudbury", 46.6, -81.18, 130),
    ("Popigai", 71.65, 111.18, 100), ("Acraman", -32.02, 135.45, 90), ("Manicouagan", 51.38, -68.7, 85),
    ("Morokweng", -26.47, 23.53, 70), ("Kara", 69.1, 64.15, 65), ("Tookoonooka", -27.12, 142.83, 55),
    ("Charlevoix", 47.53, -70.3, 54), ("Siljan", 61.03, 14.87, 52), ("Araguainha", -16.78, -52.98, 40),
    ("Puchezh-Katunki", 57.1, 43.58, 40), ("Saint Martin", 51.78, -98.53, 40), ("Woodleigh", -26.05, 114.67, 40),
    ("Carswell", 58.45, -109.5, 39), ("Clearwater West", 56.22, -74.5, 36), ("Manson", 42.58, -94.55, 35),
    ("Shoemaker", -25.87, 120.88, 30), ("Slate Islands", 48.67, -87.0, 30), ("Mistastin", 55.88, -63.3, 28),
    ("Kamensk", 48.35, 40.5, 25), ("Boltysh", 48.9, 32.25, 24), ("Strangways", -15.2, 133.58, 25),
    ("Ries", 48.88, 10.57, 24), ("Haughton", 75.38, -89.68, 23), ("Lappajärvi", 63.15, 23.7, 23),
    ("Rochechouart", 45.82, 0.78, 23), ("Gosses Bluff", -23.82, 132.31, 22), ("Logancha", 65.52, 95.93, 20),
    ("El'gygytgyn", 67.5, 172.08, 18), ("Oasis", 24.58, 24.4, 18), ("Luizi", -10.17, 28.0, 17),
    ("Gweni-Fada", 17.42, 21.75, 14), ("Zhamanshin", 48.4, 60.97, 14), ("Sierra Madera", 30.6, -102.92, 13),
    ("Spider", -16.73, 126.08, 13), ("Kentland", 40.75, -87.4, 13), ("Aorounga", 19.1, 19.25, 12.6),
    ("Dhala", 25.3, 78.13, 11), ("Bosumtwi", 6.5, -1.42, 10.5), ("Ramgarh", 25.33, 76.62, 10),
    ("Upheaval Dome", 38.43, -109.93, 10), ("Serpent Mound", 39.03, -83.4, 8), ("Tin Bider", 27.6, 5.12, 6),
    ("Goat Paddock", -18.33, 126.67, 5.1), ("Steinheim", 48.68, 10.07, 3.8), ("Flynn Creek", 36.28, -85.62, 3.8),
    ("Ouarkziz", 29.0, -7.55, 3.5), ("Pingualuit", 61.28, -73.67, 3.4), ("Roter Kamm", -27.77, 16.3, 2.5),
    ("BP structure", 25.32, 24.33, 2.0), ("Tenoumer", 22.92, -10.4, 1.9), ("Lonar", 19.98, 76.51, 1.8),
    ("Talemzane", 33.32, 4.03, 1.75), ("Meteor Crater", 35.03, -111.02, 1.2), ("Tswaing", -25.4, 28.08, 1.13),
    ("Wolfe Creek", -19.17, 127.8, 0.88), ("Monturaqui", -23.93, -68.27, 0.46), ("Amguid", 26.08, 4.4, 0.45),
    ("Henbury", -24.57, 133.15, 0.16), ("Wabar", 21.5, 50.47, 0.1),
]


VALIDATION_SITES = [
    # id, name, lat, lon, world, jobs it was used for, programme or source
    ("pavilion-lake", "Pavilion Lake, Canada", 50.87, -121.74, "mars", "astrobio", "NASA and CSA Pavilion Lake Research Project (microbialites)"),
    ("kangerlussuaq", "Kangerlussuaq, Greenland", 67.01, -50.69, "mars", "ice,polar", "Europlanet field site (glacial and permafrost ground)"),
    ("makgadikgadi", "Makgadikgadi Pans, Botswana", -20.58, 25.96, "mars", "astrobio,isru", "Europlanet field site (salt pans)"),
    ("dhofar", "Dhofar desert near Marmul, Oman", 18.14, 55.18, "mars", "base,traverse", "Austrian Space Forum AMADEE-18 (2018)"),
    ("ramon", "Ramon Crater, Israel", 30.60, 34.80, "mars", "base,traverse", "Austrian Space Forum AMADEE-20 (2021) and D-MARS"),
    ("armash", "Armash, Armenia", 39.77, 44.81, "mars", "base,traverse", "Austrian Space Forum AMADEE-24 (2024)"),
    ("kaunertal", "Kaunertal Glacier, Austria", 46.86, 10.73, "mars", "ice,polar", "Austrian Space Forum AMADEE-15 (2015)"),
    ("dachstein", "Dachstein ice caves, Austria", 47.53, 13.70, "mars", "caves,ice", "Austrian Space Forum Dachstein simulation (2012)"),
    ("tso-kar", "Tso Kar, Ladakh, India", 33.30, 78.00, "mars", "base,astrobio", "ISRO HOPE analog mission (2025)"),
    ("kutch", "Mata no Madh, Kutch, India", 23.53, 68.95, "mars", "astrobio,isru", "Jarosite Mars analog (SAC-ISRO; Ray et al. 2025)"),
    ("kobuk", "Great Kobuk Sand Dunes, Alaska", 67.07, -159.20, "mars", "traverse,polar", "Cold-climate Mars dune analog (Dinwiddie et al. 2012)"),
    ("white-sands", "White Sands, New Mexico", 32.80, -106.30, "mars", "traverse,isru", "Gypsum dunes, analog for Mars sulfate dunes"),
    ("barberton", "Barberton Greenstone Belt, South Africa", -25.85, 31.00, "mars", "astrobio", "Early-life rocks used for Mars biosignature studies"),
    ("scablands", "Channeled Scablands, USA", 47.45, -119.00, "mars", "traverse", "Flood-channel analog for Mars outflow channels (Baker 1978)"),
    ("uzon", "Uzon Caldera, Kamchatka", 54.50, 159.97, "mars", "astrobio", "Hot-spring astrobiology analog"),
    ("yellowstone", "Yellowstone, USA", 44.60, -110.60, "mars", "astrobio", "Hot-spring astrobiology analog"),
    ("salda", "Lake Salda, Türkiye", 37.55, 29.68, "mars", "astrobio", "NASA Perseverance team analog for Jezero (2019)"),
    ("cuatro-cienegas", "Cuatro Ciénegas, Mexico", 26.98, -102.07, "mars", "astrobio", "Gypsum pools and microbial mats, NASA astrobiology analog"),
    ("shark-bay", "Shark Bay (Hamelin Pool), Australia", -26.40, 114.20, "mars", "astrobio", "Living stromatolites, Mars biosignature analog"),
    ("samail", "Samail ophiolite, Oman", 22.90, 58.40, "mars", "astrobio,isru", "Rock-water reactions (NASA Rock-Powered Life)"),
    ("untersee", "Lake Untersee, Antarctica", -71.35, 13.45, "mars", "ice,astrobio", "Ice-covered lake analog for early Mars"),
    ("etna", "Mount Etna, Italy", 37.73, 15.00, "moon", "traverse,landing", "DLR and ESA ARCHES Moon-analog demo (2022)"),
    ("pinacate", "Pinacate volcanic field, Mexico", 31.77, -113.50, "moon", "traverse,impact", "Apollo astronaut geology training (1970)"),
    ("rio-grande-gorge", "Rio Grande Gorge, New Mexico", 36.48, -105.73, "moon", "traverse", "Apollo 15 training for Hadley Rille"),
    ("orocopia", "Orocopia Mountains, California", 33.55, -115.75, "moon", "traverse", "Apollo astronaut geology training"),
    ("katmai", "Valley of Ten Thousand Smokes, Alaska", 58.33, -155.30, "moon", "traverse", "Apollo astronaut training (1965 and 1966)"),
    ("west-clearwater", "West Clearwater Lake crater, Canada", 56.22, -74.50, "moon", "impact", "Impact-structure field studies (lunar analog)"),
    ("lofoten", "Lofoten anorthosites, Norway", 68.15, 13.50, "moon", "isru,traverse", "ESA PANGAEA training: lunar highland rocks"),
]

# GLiM classes in file order (value 1..16); index 0 = no data.
LITHOLOGY = [
    ("nd", "Unknown"),
    ("su", "Loose sediments"), ("vb", "Basalt and dark lavas"), ("ss", "Sandstone and shale"),
    ("pb", "Gabbro and anorthosite"), ("sm", "Mixed sedimentary rock"), ("sc", "Limestone and carbonates"),
    ("va", "Light-coloured lavas"), ("mt", "Metamorphic rock"), ("pa", "Granite"),
    ("vi", "Andesite lavas"), ("wb", "Water"), ("py", "Volcanic ash and cinders"),
    ("pi", "Diorite"), ("ev", "Salt and gypsum"), ("nd", "Unknown"), ("ig", "Ice and glaciers"),
]

# How close each Earth rock class is to a target's main rocks (0 to 1).
ROCK_FAMILY = {
    "highland": {"label": "Anorthosite highlands and impact breccia",
                 "aff": {"pb": 1.0, "pi": 0.7, "mt": 0.6, "pa": 0.45, "vb": 0.3, "py": 0.2, "ig": 0.2}},
    "mare": {"label": "Mare basalt",
             "aff": {"vb": 1.0, "py": 0.8, "vi": 0.55, "pb": 0.4, "va": 0.25}},
    "mare-highland": {"label": "Mare basalt next to highland rock",
                      "aff": {"vb": 1.0, "py": 0.7, "pb": 0.65, "vi": 0.5, "pi": 0.4, "mt": 0.35}},
    "lake": {"label": "Lake and river sediments over basalt",
             "aff": {"ss": 1.0, "sm": 0.95, "sc": 0.8, "ev": 0.8, "su": 0.6, "vb": 0.5, "py": 0.3}},
    "salts": {"label": "Salty sandstones over basalt",
              "aff": {"ev": 1.0, "ss": 0.9, "sm": 0.75, "su": 0.6, "sc": 0.5, "vb": 0.45}},
    "clays": {"label": "Clay-rich layered rock",
              "aff": {"sm": 0.95, "ss": 0.85, "mt": 0.5, "vb": 0.6, "su": 0.55, "ev": 0.5, "sc": 0.4}},
    "icy-plains": {"label": "Icy lowland plains",
                   "aff": {"su": 1.0, "ig": 0.9, "vb": 0.6, "sm": 0.5, "ss": 0.5, "py": 0.4}},
    "volcanic": {"label": "Basalt volcano",
                 "aff": {"vb": 1.0, "py": 0.85, "vi": 0.6, "va": 0.35}},
}

TARGET_ROCK = {
    "shackleton": "highland", "malapert": "highland", "haworth": "highland", "mons-mouton": "highland",
    "nobile": "highland", "de-gerlache": "highland", "cabeus": "highland",
    "marius-pit": "mare", "tranquillitatis-pit": "mare", "hadley": "mare-highland",
    "jezero": "lake", "gale": "lake", "meridiani": "salts", "mawrth": "clays",
    "arcadia": "icy-plains", "deuteronilus": "icy-plains", "utopia": "icy-plains", "arsia": "volcanic",
}


# What each known site has mostly been used for, from the published campaign descriptions
# (our short summary). Used only to test the scores job by job.
KNOWN_JOBS = {
    "dry-valleys": "astrobio,ice,polar", "haughton": "impact,ice,base", "atacama": "astrobio,traverse",
    "mauna-kea": "isru,traverse", "lava-beds": "caves", "lanzarote": "caves,traverse", "rio-tinto": "astrobio",
    "svalbard": "astrobio,ice", "mdrs": "base,traverse", "meteor-crater": "impact", "black-point": "traverse",
    "askja": "traverse,astrobio", "pilbara": "astrobio", "ries": "impact", "sudbury": "impact", "dallol": "astrobio",
    "death-valley": "traverse", "craters-moon": "caves,traverse", "cinder-lake": "landing,traverse", "sp-crater": "traverse",
    "kilbourne": "impact,traverse", "kilauea": "caves,isru", "teide": "traverse", "mistastin": "impact", "lonar": "impact",
    "axel-heiberg": "ice,astrobio", "licancabur": "astrobio", "qaidam": "astrobio,traverse", "arkaroola": "astrobio",
    "erfoud": "base,traverse", "gobi": "traverse", "concordia": "base,polar", "undara": "caves", "jeju": "caves",
    "mojave": "traverse", "namib": "traverse", "manicouagan": "impact", "haleakala": "traverse",
}
