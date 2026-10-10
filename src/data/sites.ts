/**
 * Site catalogue for the preliminary-round prototype.
 *
 * Earth sites here are KNOWN, published analog / field-test locations used as references —
 * they are not discoveries made by our model. Moon and Mars targets are named regions from
 * NASA mission planning and landing history. Coordinates are approximate region centres,
 * good for mapping, not for navigation or landing.
 *
 * "fit" ratings are the team's literature-informed prototype judgement, shown in the UI as
 * such. They are placeholders for the evidence-backed ranking produced in Phase 2.
 */

export type Body = "earth" | "moon" | "mars";
export type World = "moon" | "mars";
export type Fit = "strong" | "partial" | "weak" | "unknown";

export type TaskId =
  | "base"
  | "traverse"
  | "isru"
  | "ice"
  | "caves"
  | "astrobio"
  | "impact"
  | "polar";

export interface MissionTask {
  id: TaskId;
  label: string;
  short: string;
  question: string;
  evidence: string[];
}

export const TASKS: MissionTask[] = [
  {
    id: "base",
    label: "Base operations & habitat",
    short: "Base ops",
    question: "Where can a crew rehearse living and working at a remote, resource-poor outpost?",
    evidence: ["Isolation & logistics", "Terrain trafficability", "Thermal extremes", "Comms constraints"],
  },
  {
    id: "traverse",
    label: "Rover / EVA traverse",
    short: "Traverse",
    question: "Where does the terrain challenge mobility the way the target route will?",
    evidence: ["Slope distribution", "Roughness at wheel scale", "Rock abundance", "Loose regolith"],
  },
  {
    id: "isru",
    label: "Regolith & ISRU",
    short: "ISRU",
    question: "Where can we test excavation, sintering and oxygen extraction on similar material?",
    evidence: ["Basaltic / anorthositic material", "Grain size", "Bulk chemistry", "Access permits"],
  },
  {
    id: "ice",
    label: "Ice & volatiles prospecting",
    short: "Ice",
    question: "Where can instruments practise finding buried or cold-trapped water ice?",
    evidence: ["Ground ice / permafrost", "Cold traps", "Subsurface radar contrast", "Sublimation"],
  },
  {
    id: "caves",
    label: "Caves & lava tubes",
    short: "Lava tubes",
    question: "Where can we rehearse exploring and mapping volcanic caves for shelter?",
    evidence: ["Lava tube geometry", "Skylights", "Basaltic flows", "Darkness ops"],
  },
  {
    id: "astrobio",
    label: "Astrobiology sampling",
    short: "Astrobio",
    question: "Where can we practise life-detection and sample selection at the limits of life?",
    evidence: ["Hyper-aridity", "Ancient sediments", "Mineral biosignatures", "Contamination control"],
  },
  {
    id: "impact",
    label: "Impact geology",
    short: "Impact",
    question: "Where can crews learn to read crater structures and impact rocks?",
    evidence: ["Crater morphology", "Shocked rocks / breccia", "Ejecta", "Central uplift"],
  },
  {
    id: "polar",
    label: "Polar light & cold",
    short: "Polar",
    question: "Where do low Sun angles, long shadows and deep cold resemble the lunar south pole?",
    evidence: ["Low solar elevation", "Long shadows", "Extreme cold", "Seasonal darkness"],
  },
];

export interface TargetSite {
  id: string;
  body: World;
  name: string;
  region: string;
  lat: number;
  lon: number;
  kind: string;
  why: string;
  tasks: TaskId[];
  source: string;
}

export const TARGETS: TargetSite[] = [
  // Moon — Artemis south-polar candidate regions and classic targets
  {
    id: "shackleton",
    body: "moon",
    name: "Shackleton crater rim",
    region: "Lunar south pole",
    lat: -89.67,
    lon: 129.78,
    kind: "Permanent base region",
    why: "Rim segments see near-continuous sunlight while the crater floor is permanently shadowed — power and ice side by side.",
    tasks: ["base", "polar", "ice", "traverse"],
    source: "LRO LOLA illumination studies; NASA Artemis planning",
  },
  {
    id: "malapert",
    body: "moon",
    name: "Malapert Massif",
    region: "Lunar south pole",
    lat: -86.0,
    lon: -2.9,
    kind: "Artemis III candidate region",
    why: "High massif with long sunlit periods and direct line-of-sight to Earth for communications.",
    tasks: ["base", "traverse", "polar"],
    source: "NASA Artemis III candidate regions (2022, refined 2024)",
  },
  {
    id: "haworth",
    body: "moon",
    name: "Haworth",
    region: "Lunar south pole",
    lat: -87.4,
    lon: -5.0,
    kind: "Artemis III candidate region",
    why: "Large permanently shadowed crater beside illuminated ridges — volatiles within traverse range.",
    tasks: ["ice", "polar", "traverse"],
    source: "NASA Artemis III candidate regions",
  },
  {
    id: "mons-mouton",
    body: "moon",
    name: "Mons Mouton",
    region: "Lunar south pole",
    lat: -84.6,
    lon: 31.0,
    kind: "Artemis III candidate region",
    why: "Flat-topped mesa with gentle slopes; also the VIPER rover's planned region.",
    tasks: ["base", "traverse", "ice", "isru"],
    source: "NASA Artemis III candidate regions; VIPER site selection",
  },
  {
    id: "nobile",
    body: "moon",
    name: "Nobile Rim",
    region: "Lunar south pole",
    lat: -85.2,
    lon: 53.5,
    kind: "Artemis III candidate region",
    why: "Degraded crater rim adjacent to shadowed terrain; mixed illumination and slopes.",
    tasks: ["traverse", "ice", "impact"],
    source: "NASA Artemis III candidate regions",
  },
  {
    id: "de-gerlache",
    body: "moon",
    name: "de Gerlache Rim",
    region: "Lunar south pole",
    lat: -88.5,
    lon: -87.1,
    kind: "Artemis III candidate region",
    why: "Rim connected to Shackleton by a long ridge of persistent illumination.",
    tasks: ["base", "polar", "traverse"],
    source: "NASA Artemis III candidate regions",
  },
  {
    id: "cabeus",
    body: "moon",
    name: "Cabeus (LCROSS impact)",
    region: "Lunar south pole",
    lat: -84.68,
    lon: -48.7,
    kind: "Confirmed water-ice site",
    why: "LCROSS impact in 2009 excavated water ice from this permanently shadowed floor.",
    tasks: ["ice", "isru", "polar"],
    source: "LCROSS mission results (Colaprete et al., 2010)",
  },
  {
    id: "marius-pit",
    body: "moon",
    name: "Marius Hills pit",
    region: "Oceanus Procellarum",
    lat: 14.1,
    lon: -56.8,
    kind: "Lava-tube skylight",
    why: "Collapse pit that may open into a lava tube — natural radiation and thermal shelter.",
    tasks: ["caves", "base"],
    source: "SELENE/Kaguya & LROC NAC observations",
  },
  {
    id: "tranquillitatis-pit",
    body: "moon",
    name: "Mare Tranquillitatis pit",
    region: "Mare Tranquillitatis",
    lat: 8.33,
    lon: 33.22,
    kind: "Lava-tube skylight",
    why: "Pit with an overhang; Diviner data show a stable ~17 °C interior environment.",
    tasks: ["caves", "base"],
    source: "LRO Diviner (Horvath et al., 2022)",
  },
  {
    id: "hadley",
    body: "moon",
    name: "Hadley Rille (Apollo 15)",
    region: "Mare Imbrium edge",
    lat: 26.13,
    lon: 3.63,
    kind: "Historic landing site",
    why: "Sinuous volcanic rille next to mountains; first lunar rover traverse.",
    tasks: ["traverse", "caves", "isru"],
    source: "Apollo 15 mission records",
  },

  // Mars
  {
    id: "jezero",
    body: "mars",
    name: "Jezero crater",
    region: "Isidis rim",
    lat: 18.38,
    lon: 77.58,
    kind: "Active rover site",
    why: "Ancient lake delta explored by Perseverance; sample caching for return.",
    tasks: ["astrobio", "traverse", "impact"],
    source: "Mars 2020 / Perseverance",
  },
  {
    id: "gale",
    body: "mars",
    name: "Gale crater",
    region: "Aeolis",
    lat: -5.4,
    lon: 137.8,
    kind: "Active rover site",
    why: "Layered sediments of Mount Sharp record a once-habitable lake environment.",
    tasks: ["astrobio", "traverse", "impact"],
    source: "Mars Science Laboratory / Curiosity",
  },
  {
    id: "arcadia",
    body: "mars",
    name: "Arcadia Planitia",
    region: "Northern plains",
    lat: 46.7,
    lon: -176.0,
    kind: "Human landing interest",
    why: "Shallow, mid-latitude ground ice mapped by subsurface water ice studies — a water source for crews.",
    tasks: ["ice", "base", "isru"],
    source: "SWIM project (Morgan et al., 2021)",
  },
  {
    id: "deuteronilus",
    body: "mars",
    name: "Deuteronilus Mensae",
    region: "Dichotomy boundary",
    lat: 43.9,
    lon: 22.0,
    kind: "Exploration zone candidate",
    why: "Debris-covered glaciers and mesas; proposed in NASA's human landing-site workshop.",
    tasks: ["ice", "base", "traverse"],
    source: "NASA First Landing Site/Exploration Zone Workshop (2015)",
  },
  {
    id: "arsia",
    body: "mars",
    name: "Arsia Mons skylights",
    region: "Tharsis",
    lat: -8.3,
    lon: -120.1,
    kind: "Cave candidates",
    why: "Pit craters on the volcano's flanks interpreted as cave entrances.",
    tasks: ["caves", "base"],
    source: "Cushing et al., 2007 (THEMIS)",
  },
  {
    id: "meridiani",
    body: "mars",
    name: "Meridiani Planum",
    region: "Terra Meridiani",
    lat: -1.95,
    lon: -5.53,
    kind: "Historic rover site",
    why: "Hematite spherules and sulfate rocks formed in acidic water; Opportunity's home.",
    tasks: ["astrobio", "traverse", "isru"],
    source: "MER Opportunity",
  },
  {
    id: "utopia",
    body: "mars",
    name: "Utopia Planitia",
    region: "Northern plains",
    lat: 25.07,
    lon: 109.93,
    kind: "Rover landing site",
    why: "Zhurong's landing plain; periglacial landforms and buried ice indications.",
    tasks: ["ice", "traverse", "base"],
    source: "Tianwen-1 / Zhurong",
  },
  {
    id: "mawrth",
    body: "mars",
    name: "Mawrth Vallis",
    region: "Arabia Terra edge",
    lat: 22.6,
    lon: -16.5,
    kind: "Clay-rich terrain",
    why: "Thick, layered clay minerals — a long-studied astrobiology landing candidate.",
    tasks: ["astrobio", "isru"],
    source: "CRISM / OMEGA mineral maps",
  },
];

export interface EarthSite {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  worlds: World[];
  tasks: TaskId[];
  summary: string;
  heritage: string;
  pairs: string[]; // TargetSite ids
  fit: { topography: Fit; geology: Fit; environment: Fit; resources: Fit; access: Fit };
  gaps: string[];
}

export const EARTH_SITES: EarthSite[] = [
  {
    id: "death-valley",
    name: "Death Valley",
    country: "California, USA",
    lat: 36.25,
    lon: -116.83,
    worlds: ["mars"],
    tasks: ["traverse", "astrobio", "isru"],
    summary: "Hot, hyper-arid basin with salt flats, alluvial fans and volcanic craters (Ubehebe) — named in the 2026 challenge.",
    heritage: "NASA rover & instrument field tests; Mars 2020 and MSL team training.",
    pairs: ["gale", "jezero", "meridiani"],
    fit: { topography: "strong", geology: "partial", environment: "partial", resources: "partial", access: "strong" },
    gaps: ["Extreme summer heat, not cold", "National Park permits", "Earth atmosphere & gravity"],
  },
  {
    id: "dry-valleys",
    name: "McMurdo Dry Valleys",
    country: "Antarctica",
    lat: -77.5,
    lon: 161.8,
    worlds: ["moon", "mars"],
    tasks: ["polar", "ice", "astrobio", "base"],
    summary: "The coldest, driest ice-free valleys on Earth, with ground ice, permafrost and months of low-angle sunlight.",
    heritage: "Long-running NASA & NSF Mars-analog research; Viking-era life-detection tests.",
    pairs: ["shackleton", "haworth", "arcadia", "deuteronilus"],
    fit: { topography: "partial", geology: "partial", environment: "strong", resources: "strong", access: "strong" },
    gaps: ["Earth gravity & atmosphere", "No permanently shadowed regions colder than ~-60 °C", "Treaty-protected: strict permits"],
  },
  {
    id: "haughton",
    name: "Haughton Crater, Devon Island",
    country: "Canada",
    lat: 75.38,
    lon: -89.68,
    worlds: ["mars", "moon"],
    tasks: ["impact", "base", "traverse", "polar"],
    summary: "A 23 km impact crater in a polar desert — home of the Haughton-Mars Project field station.",
    heritage: "Haughton-Mars Project (NASA/SETI) since 1997; rover & EVA studies.",
    pairs: ["jezero", "gale", "nobile", "malapert"],
    fit: { topography: "strong", geology: "strong", environment: "partial", resources: "partial", access: "strong" },
    gaps: ["Sedimentary target rocks, not basalt", "Liquid water seasonally present", "Vegetation patches"],
  },
  {
    id: "atacama",
    name: "Atacama Desert (Yungay)",
    country: "Chile",
    lat: -24.08,
    lon: -70.0,
    worlds: ["mars"],
    tasks: ["astrobio", "traverse", "isru"],
    summary: "Among the driest places on Earth; soils that oxidise organics much like Martian regolith.",
    heritage: "NASA ARADS & life-in-the-Atacama rover field campaigns.",
    pairs: ["meridiani", "gale", "jezero", "mawrth"],
    fit: { topography: "partial", geology: "partial", environment: "strong", resources: "partial", access: "strong" },
    gaps: ["Thick atmosphere filters UV", "Microbial life still present", "Earth gravity"],
  },
  {
    id: "mauna-kea",
    name: "Mauna Kea slopes",
    country: "Hawaiʻi, USA",
    lat: 19.82,
    lon: -155.47,
    worlds: ["moon", "mars"],
    tasks: ["isru", "traverse", "base"],
    summary: "Basaltic volcanic tephra used as lunar regolith analog in NASA ISRU field demonstrations.",
    heritage: "NASA/PISCES ISRU field tests (2008, 2010); regolith simulant sources.",
    pairs: ["mons-mouton", "cabeus", "hadley"],
    fit: { topography: "partial", geology: "strong", environment: "weak", resources: "strong", access: "partial" },
    gaps: ["Weathered, not space-weathered, grains", "Sacred cultural landscape — access with consent", "Mild climate"],
  },
  {
    id: "lava-beds",
    name: "Lava Beds National Monument",
    country: "California, USA",
    lat: 41.71,
    lon: -121.51,
    worlds: ["moon", "mars"],
    tasks: ["caves"],
    summary: "Hundreds of accessible basaltic lava tubes — a test bed for cave robotics and life detection.",
    heritage: "NASA BRAILLE project (2019–2021) for robotic cave exploration.",
    pairs: ["marius-pit", "tranquillitatis-pit", "arsia"],
    fit: { topography: "strong", geology: "strong", environment: "weak", resources: "weak", access: "strong" },
    gaps: ["Lunar/Martian tubes are likely far larger", "Biological activity inside", "Earth gravity"],
  },
  {
    id: "lanzarote",
    name: "Lanzarote & La Corona tube",
    country: "Spain",
    lat: 29.16,
    lon: -13.43,
    worlds: ["moon", "mars"],
    tasks: ["caves", "traverse", "impact"],
    summary: "Young basaltic landscapes and one of the longest submarine lava tubes on Earth.",
    heritage: "ESA PANGAEA astronaut geology training; ESA CAVES.",
    pairs: ["marius-pit", "arsia", "hadley"],
    fit: { topography: "strong", geology: "strong", environment: "partial", resources: "partial", access: "strong" },
    gaps: ["Vegetation and soils present", "Marine influence", "Tourism access limits"],
  },
  {
    id: "rio-tinto",
    name: "Río Tinto",
    country: "Spain",
    lat: 37.69,
    lon: -6.59,
    worlds: ["mars"],
    tasks: ["astrobio", "isru"],
    summary: "Acidic, iron-rich river with jarosite and hematite — the minerals found at Meridiani Planum.",
    heritage: "NASA MARTE drilling experiment (2003–2006).",
    pairs: ["meridiani", "mawrth"],
    fit: { topography: "weak", geology: "strong", environment: "weak", resources: "strong", access: "strong" },
    gaps: ["Active water and life", "Mining-altered landscape", "Vegetated surroundings"],
  },
  {
    id: "svalbard",
    name: "Bockfjord, Svalbard",
    country: "Norway",
    lat: 79.4,
    lon: 13.3,
    worlds: ["mars", "moon"],
    tasks: ["ice", "astrobio", "polar"],
    summary: "Volcanic centres and carbonate deposits inside permafrost — an Arctic Mars analog.",
    heritage: "AMASE expeditions (NASA/ESA) for Mars Science Laboratory and ExoMars instruments.",
    pairs: ["arcadia", "utopia", "shackleton"],
    fit: { topography: "partial", geology: "strong", environment: "strong", resources: "strong", access: "partial" },
    gaps: ["Glacial meltwater", "Arctic ecosystems", "Polar-bear safety logistics"],
  },
  {
    id: "mdrs",
    name: "Mars Desert Research Station",
    country: "Utah, USA",
    lat: 38.41,
    lon: -110.79,
    worlds: ["mars"],
    tasks: ["base", "traverse", "astrobio"],
    summary: "Red Jurassic sediments and a working habitat for simulated crew rotations.",
    heritage: "Mars Society crew rotations since 2001; NASA-funded studies.",
    pairs: ["gale", "jezero", "meridiani"],
    fit: { topography: "strong", geology: "partial", environment: "partial", resources: "weak", access: "strong" },
    gaps: ["Warm summers", "Earth atmosphere & gravity", "Simulated, not real, isolation"],
  },
  {
    id: "meteor-crater",
    name: "Meteor Crater",
    country: "Arizona, USA",
    lat: 35.03,
    lon: -111.02,
    worlds: ["moon"],
    tasks: ["impact", "traverse"],
    summary: "A well-preserved 1.2 km simple crater where Apollo crews learned impact geology.",
    heritage: "Apollo astronaut geology training (1960s); Desert RATS nearby.",
    pairs: ["nobile", "shackleton", "jezero"],
    fit: { topography: "strong", geology: "partial", environment: "weak", resources: "weak", access: "strong" },
    gaps: ["Sedimentary target, not lunar highlands", "Erosion & vegetation", "Private land"],
  },
  {
    id: "black-point",
    name: "Black Point Lava Flow",
    country: "Arizona, USA",
    lat: 35.68,
    lon: -111.43,
    worlds: ["moon", "mars"],
    tasks: ["traverse", "base", "isru"],
    summary: "Basalt flows where NASA Desert RATS rehearsed pressurised rover and EVA operations.",
    heritage: "NASA Desert RATS (1997–2011).",
    pairs: ["malapert", "mons-mouton", "de-gerlache"],
    fit: { topography: "strong", geology: "partial", environment: "weak", resources: "partial", access: "strong" },
    gaps: ["Mid-latitude Sun angles", "Warm climate", "Vegetation"],
  },
  {
    id: "askja",
    name: "Askja & Holuhraun",
    country: "Iceland",
    lat: 65.05,
    lon: -16.75,
    worlds: ["moon", "mars"],
    tasks: ["traverse", "caves", "isru", "impact"],
    summary: "Barren basaltic highlands where Apollo crews trained in 1965 and 1967.",
    heritage: "Apollo geology training; modern rover tests (e.g. ESA/DLR, Mars 2020 team).",
    pairs: ["hadley", "jezero", "arsia"],
    fit: { topography: "strong", geology: "strong", environment: "partial", resources: "partial", access: "partial" },
    gaps: ["Active volcanism & glacial rivers", "Seasonal access only", "Earth atmosphere"],
  },
  {
    id: "pilbara",
    name: "Pilbara (Dresser Formation)",
    country: "Australia",
    lat: -21.0,
    lon: 119.4,
    worlds: ["mars"],
    tasks: ["astrobio"],
    summary: "Some of Earth's oldest evidence of life (~3.5 billion years) — a guide for Mars biosignatures.",
    heritage: "Mars 2020 science team field training; astrobiology studies.",
    pairs: ["jezero", "gale"],
    fit: { topography: "partial", geology: "strong", environment: "partial", resources: "weak", access: "partial" },
    gaps: ["Different early atmosphere", "Plate tectonic overprint", "Traditional Owner consent"],
  },
  {
    id: "ries",
    name: "Nördlinger Ries",
    country: "Germany",
    lat: 48.88,
    lon: 10.57,
    worlds: ["moon"],
    tasks: ["impact"],
    summary: "24 km impact basin with suevite breccia; Apollo 14 crew studied here in 1970.",
    heritage: "Apollo 14 training; ESA & NASA geology field schools.",
    pairs: ["nobile", "shackleton"],
    fit: { topography: "weak", geology: "strong", environment: "weak", resources: "weak", access: "strong" },
    gaps: ["Farmland and town inside the crater", "Heavily eroded rim", "Temperate climate"],
  },
  {
    id: "sudbury",
    name: "Sudbury Basin",
    country: "Canada",
    lat: 46.6,
    lon: -81.18,
    worlds: ["moon"],
    tasks: ["impact", "isru"],
    summary: "One of Earth's largest, oldest impact structures; Apollo 16 and 17 crews trained here.",
    heritage: "Apollo geology training; CSA lunar analog campaigns.",
    pairs: ["nobile", "hadley"],
    fit: { topography: "weak", geology: "strong", environment: "partial", resources: "partial", access: "strong" },
    gaps: ["Deformed and eroded", "Forest cover", "Mining infrastructure"],
  },
  {
    id: "dallol",
    name: "Dallol, Danakil Depression",
    country: "Ethiopia",
    lat: 14.24,
    lon: 40.3,
    worlds: ["mars"],
    tasks: ["astrobio"],
    summary: "Hyper-acidic, hyper-saline hydrothermal pools — testing where life stops.",
    heritage: "Europlanet & astrobiology field studies.",
    pairs: ["meridiani", "mawrth"],
    fit: { topography: "weak", geology: "partial", environment: "weak", resources: "partial", access: "weak" },
    gaps: ["Extreme heat (+45 °C)", "Toxic gases", "Remote, permits required"],
  },
];

export const TARGET_BY_ID = Object.fromEntries(TARGETS.map((t) => [t.id, t])) as Record<string, TargetSite>;
export const EARTH_BY_ID = Object.fromEntries(EARTH_SITES.map((s) => [s.id, s])) as Record<string, EarthSite>;

export const FIT_LABEL: Record<Fit, string> = {
  strong: "Strong",
  partial: "Partial",
  weak: "Weak",
  unknown: "Unknown",
};

export const FIT_KEYS: { key: keyof EarthSite["fit"]; label: string }[] = [
  { key: "topography", label: "Topography" },
  { key: "geology", label: "Geology" },
  { key: "environment", label: "Environment" },
  { key: "resources", label: "Resources" },
  { key: "access", label: "Field access" },
];

/** Universal reality gaps — no Earth site can reproduce these. */
export const REALITY_GAPS: Record<World, string[]> = {
  moon: ["1/6 g gravity", "Hard vacuum", "Unfiltered radiation", "Electrostatic, jagged dust", "~-230 °C cold traps"],
  mars: ["3/8 g gravity", "~0.6 kPa CO₂ atmosphere", "Surface radiation", "Perchlorate-rich soil", "Global dust storms"],
};

/**
 * Regions queued for NEW-analog screening (the core ask of the 2026 challenge).
 * Nothing here has been screened yet: they are search areas, chosen because they hold
 * desert, polar, volcanic, arid or cave terrain AND have open DEM + multispectral coverage.
 */
export interface ScreeningRegion {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  terrain: string;
  hypothesis: string;
  worlds: World[];
}

export const SCREENING_REGIONS: ScreeningRegion[] = [
  { id: "lut", name: "Dasht-e Lut", country: "Iran", lat: 30.4, lon: 59.3, terrain: "Hyper-arid yardangs", hypothesis: "Wind-eroded ridges resemble Martian yardang fields (Medusae Fossae).", worlds: ["mars"] },
  { id: "khaybar", name: "Harrat Khaybar", country: "Saudi Arabia", lat: 25.7, lon: 39.9, terrain: "Basaltic lava field", hypothesis: "Young flows, cones and possible lava tubes for lunar mare traverses.", worlds: ["moon", "mars"] },
  { id: "namib", name: "Namib sand sea", country: "Namibia", lat: -24.7, lon: 15.3, terrain: "Coastal dune desert", hypothesis: "Dune fields for rover mobility on loose sand, like Gale's Bagnold dunes.", worlds: ["mars"] },
  { id: "uyuni", name: "Altiplano salars", country: "Bolivia", lat: -20.1, lon: -67.6, terrain: "High-altitude salt flats", hypothesis: "High UV, low pressure and evaporites — chloride deposits on Mars.", worlds: ["mars"] },
  { id: "tolbachik", name: "Tolbachik lava fields", country: "Russia", lat: 55.8, lon: 160.3, terrain: "Recent basalt & cold", hypothesis: "Fresh basalt in a cold climate for regolith and ISRU tests.", worlds: ["moon"] },
  { id: "blue-ice", name: "Antarctic blue-ice plateau", country: "Antarctica", lat: -72.0, lon: 25.0, terrain: "Polar ice & nunataks", hypothesis: "Low Sun, extreme cold and long shadows near the lunar south pole's illumination regime.", worlds: ["moon"] },
  { id: "taklamakan", name: "Taklamakan rim", country: "China", lat: 38.9, lon: 83.5, terrain: "Cold desert & alluvial fans", hypothesis: "Cold-arid fans and dunes for Mars traverse planning.", worlds: ["mars"] },
  { id: "craters-moon", name: "Craters of the Moon", country: "Idaho, USA", lat: 43.42, lon: -113.52, terrain: "Basalt flows & tubes", hypothesis: "Lava tubes and spatter cones; already used by NASA FINESSE — a calibration control.", worlds: ["moon", "mars"] },
];
