"""Reference lists used by the pipeline.

KNOWN_ANALOGS — published Earth analog field sites (NASA, ESA, CSA and university
campaigns). They are the *positive labels* for the analog model and the hold-out
test set. Coordinates are approximate site centres (fine for a 0.5 degree grid).
world: which body the site has been used to rehearse ("moon", "mars" or both).

IMPACTS — a selection of confirmed impact structures (Earth Impact Database), with
approximate diameters in km.
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
