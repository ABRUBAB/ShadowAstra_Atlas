"""Step 1 · NASA GIBS (MODIS) surface features on the 0.5 degree grid.

GIBS serves colourised images; each layer publishes its exact colour table, so we
turn colours back into physical values (NDVI, land surface temperature in K, snow %,
IGBP land-cover class) and aggregate 0.1 degree pixels into 0.5 degree cells.

    python pipeline/s01_gibs.py
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import numpy as np

from common import NROW, NCOL, block, decode, gibs_colormap, gibs_wms, save

YEAR = 2024
MONTHS = [f"{YEAR}-{m:02d}-01" for m in range(1, 13)]
CMAP = "https://gibs.earthdata.nasa.gov/colormaps/v1.3/"

LAYERS = {
    "ndvi": ("MODIS_Terra_L3_NDVI_Monthly", "MODIS_L3_NDVI.xml"),
    "lstd": ("MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day", "MODIS_Land_Surface_Temp.xml"),
    "lstn": ("MODIS_Terra_L3_Land_Surface_Temp_Monthly_Night", "MODIS_Land_Surface_Temp.xml"),
    "snow": ("MODIS_Terra_L3_Snow_Cover_Monthly_Average_Pct", "MODIS_NDSI_Snow_Cover.xml"),
}
F = 5  # 0.1 deg pixels per 0.5 deg cell


def monthly(key: str) -> np.ndarray:
    layer, cmap = LAYERS[key]
    table = gibs_colormap(CMAP + cmap)

    def one(t: str) -> np.ndarray:
        return block(decode(gibs_wms(layer, t), table), F, "mean")

    with ThreadPoolExecutor(4) as pool:
        stack = np.stack(list(pool.map(one, MONTHS)))
    print(f"  {key}: {np.isfinite(stack).mean():.0%} finite")
    return stack  # (12, 360, 720)


def land_cover() -> None:
    table = gibs_colormap(CMAP + "MODIS_IGBP_Land_Cover_Type.xml")
    cls = decode(gibs_wms("MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual", "2023-01-01"), table)
    h, w = cls.shape
    groups = {
        "lc_forest": [1, 2, 3, 4, 5],
        "lc_shrub": [6, 7],
        "lc_savanna_grass": [8, 9, 10],
        "lc_wetland": [11],
        "lc_crop": [12, 14],
        "lc_urban": [13],
        "lc_snowice": [15],
        "lc_barren": [16],
        "lc_water": [17],
    }
    valid = np.isfinite(cls)
    for name, ids in groups.items():
        frac = np.where(valid, np.isin(cls, ids), np.nan).astype(np.float32)
        save(name, block(frac, F, "mean"))
    land = np.where(valid, (cls >= 1) & (cls <= 16), np.nan).astype(np.float32)
    save("land", np.nan_to_num(block(land, F, "mean"), nan=0.0))
    print("  land cover: done")


def main() -> None:
    print("GIBS land cover…")
    land_cover()
    print("GIBS monthly layers…")
    ndvi = monthly("ndvi")
    save("ndvi_mean", np.nanmean(ndvi, 0))
    save("ndvi_max", np.nanmax(ndvi, 0))

    lstd = monthly("lstd") - 273.15
    lstn = monthly("lstn") - 273.15
    save("lst_day_mean", np.nanmean(lstd, 0))
    save("lst_day_max", np.nanmax(lstd, 0))
    save("lst_night_mean", np.nanmean(lstn, 0))
    save("lst_night_min", np.nanmin(lstn, 0))
    save("lst_range", np.nanmax(lstd, 0) - np.nanmin(lstn, 0))

    snow = monthly("snow")
    save("snow_mean", np.nanmean(snow, 0))
    save("snow_months", np.nansum(snow > 50, 0).astype(np.float32))
    assert ndvi.shape[1:] == (NROW, NCOL)
    print("done.")


if __name__ == "__main__":
    main()
