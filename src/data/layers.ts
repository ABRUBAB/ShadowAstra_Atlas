import type { Body } from "./sites";

/**
 * Map layer catalogue. Every layer is a live NASA tile service:
 *  - Earth: NASA GIBS (Global Imagery Browse Services), Web Mercator (EPSG:3857)
 *  - Moon / Mars: NASA Solar System Treks, equirectangular (EPSG:4326 tile grid)
 */

export type Projection = "mercator" | "equirect" | "polar-south";

export interface MapLayer {
  id: string;
  body: Body;
  name: string;
  instrument: string;
  measures: string;
  resolution: string;
  projection: Projection;
  url: string;
  maxNativeZoom: number;
  provider: "NASA GIBS" | "NASA Trek" | "NASA Trek · reprojected";
  link: string;
  /** Rendered on top of the body's base layer instead of replacing it. */
  overlay?: boolean;
}

const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const TREK = "https://trek.nasa.gov/tiles";

/** A recent date with full MODIS coverage; the daily layers need an explicit date. */
export const MODIS_DATE = "2026-09-01";

export const LAYERS: MapLayer[] = [
  {
    id: "earth-bluemarble",
    body: "earth",
    name: "Blue Marble · shaded relief",
    instrument: "Terra/Aqua MODIS composite + SRTM",
    measures: "True colour with topographic shading and bathymetry",
    resolution: "500 m",
    projection: "mercator",
    url: `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`,
    maxNativeZoom: 8,
    provider: "NASA GIBS",
    link: "https://earthobservatory.nasa.gov/features/BlueMarble",
  },
  {
    id: "earth-modis",
    body: "earth",
    name: "MODIS Terra · true colour",
    instrument: "Terra MODIS corrected reflectance",
    measures: `Daily true-colour image (${MODIS_DATE})`,
    resolution: "250 m",
    projection: "mercator",
    url: `${GIBS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/${MODIS_DATE}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    maxNativeZoom: 9,
    provider: "NASA GIBS",
    link: "https://modis.gsfc.nasa.gov/",
  },
  {
    id: "earth-aster",
    body: "earth",
    name: "ASTER GDEM · hillshade",
    instrument: "Terra ASTER global DEM",
    measures: "Terrain relief — the key input for slope & roughness",
    resolution: "30 m",
    projection: "mercator",
    url: `${GIBS}/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg`,
    maxNativeZoom: 12,
    provider: "NASA GIBS",
    link: "https://asterweb.jpl.nasa.gov/gdem.asp",
  },
  {
    id: "earth-lst",
    body: "earth",
    name: "Land surface temperature · day",
    instrument: "Terra MODIS LST",
    measures: `Daytime skin temperature (${MODIS_DATE})`,
    resolution: "1 km",
    projection: "mercator",
    url: `${GIBS}/MODIS_Terra_Land_Surface_Temp_Day/default/${MODIS_DATE}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`,
    maxNativeZoom: 7,
    provider: "NASA GIBS",
    link: "https://modis.gsfc.nasa.gov/data/dataprod/mod11.php",
    overlay: true,
  },
  {
    id: "earth-night",
    body: "earth",
    name: "Black Marble · night lights",
    instrument: "Suomi NPP VIIRS day/night band",
    measures: "Human light at night — a proxy for remoteness",
    resolution: "500 m",
    projection: "mercator",
    url: `${GIBS}/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
    maxNativeZoom: 8,
    provider: "NASA GIBS",
    link: "https://blackmarble.gsfc.nasa.gov/",
  },

  {
    id: "moon-wac",
    body: "moon",
    name: "LROC WAC global mosaic",
    instrument: "LRO Camera · Wide Angle Camera",
    measures: "Visible reflectance mosaic",
    resolution: "100 m (303 px/°)",
    projection: "equirect",
    url: `${TREK}/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
    maxNativeZoom: 7,
    provider: "NASA Trek",
    link: "https://trek.nasa.gov/moon/",
  },
  {
    id: "moon-lola-color",
    body: "moon",
    name: "LOLA colour elevation",
    instrument: "LRO Lunar Orbiter Laser Altimeter",
    measures: "Elevation, colour-coded with hillshade",
    resolution: "237 m (128 px/°)",
    projection: "equirect",
    url: `${TREK}/Moon/EQ/LRO_LOLA_ClrShade_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{y}/{x}.png`,
    maxNativeZoom: 5,
    provider: "NASA Trek",
    link: "https://science.nasa.gov/mission/lro/lola/",
  },
  {
    id: "moon-lola-shade",
    body: "moon",
    name: "LOLA hillshade",
    instrument: "LRO Lunar Orbiter Laser Altimeter",
    measures: "Terrain relief, independent of sunlight",
    resolution: "118 m (256 px/°)",
    projection: "equirect",
    url: `${TREK}/Moon/EQ/LRO_LOLA_Shade_Global_256ppd_v06/1.0.0/default/default028mm/{z}/{y}/{x}.png`,
    maxNativeZoom: 6,
    provider: "NASA Trek",
    link: "https://science.nasa.gov/mission/lro/lola/",
  },
  {
    id: "moon-south-pole",
    body: "moon",
    name: "South pole · polar view",
    instrument: "LRO LOLA hillshade, reprojected",
    measures: "80°S to the pole, polar stereographic — where the Moon base will be",
    resolution: "~0.5 km",
    projection: "polar-south",
    url: "/textures/moon_south_pole_lola.jpg",
    maxNativeZoom: 0,
    provider: "NASA Trek · reprojected",
    link: "https://science.nasa.gov/mission/lro/lola/",
  },

  {
    id: "mars-viking",
    body: "mars",
    name: "Viking MDIM 2.1 colour",
    instrument: "Viking Orbiter cameras",
    measures: "Global colour mosaic",
    resolution: "232 m",
    projection: "equirect",
    url: `${TREK}/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
    maxNativeZoom: 7,
    provider: "NASA Trek",
    link: "https://trek.nasa.gov/mars/",
  },
  {
    id: "mars-mola",
    body: "mars",
    name: "MOLA colour elevation",
    instrument: "MGS Mars Orbiter Laser Altimeter",
    measures: "Elevation, colour-coded with hillshade",
    resolution: "463 m",
    projection: "equirect",
    url: `${TREK}/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
    maxNativeZoom: 6,
    provider: "NASA Trek",
    link: "https://attic.gsfc.nasa.gov/mola/",
  },
  {
    id: "mars-themis",
    body: "mars",
    name: "THEMIS day infrared",
    instrument: "Mars Odyssey THEMIS",
    measures: "Daytime thermal infrared — rock vs. dust texture",
    resolution: "100 m",
    projection: "equirect",
    url: `${TREK}/Mars/EQ/THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018/1.0.0/default/default028mm/{z}/{y}/{x}.png`,
    maxNativeZoom: 8,
    provider: "NASA Trek",
    link: "https://themis.mars.asu.edu/",
  },
];

export const LAYERS_BY_BODY: Record<Body, MapLayer[]> = {
  earth: LAYERS.filter((l) => l.body === "earth"),
  moon: LAYERS.filter((l) => l.body === "moon"),
  mars: LAYERS.filter((l) => l.body === "mars"),
};

export const DEFAULT_LAYER: Record<Body, string> = {
  earth: "earth-bluemarble",
  moon: "moon-wac",
  mars: "mars-viking",
};
