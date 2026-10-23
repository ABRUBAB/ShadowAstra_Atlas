"""Step 2 · NASA POWER climatology (MERRA-2 based) on the 0.5 degree grid.

POWER's regional endpoint returns monthly climate normals on 0.5 degree nodes for a
10 x 10 degree box, one parameter per request. We only ask for boxes that contain land.

    python pipeline/s02_power.py        (needs s01 land mask)
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import numpy as np

from common import NCOL, NROW, fetch_json, load, save

PARAMS = {
    "T2M": "ANN",  # mean air temperature at 2 m (°C)
    "T2M_MIN": "MIN",  # coldest monthly mean of daily minimum (°C)
    "T2M_MAX": "MAX",  # hottest monthly mean of daily maximum (°C)
    "PRECTOTCORR": "ANN",  # precipitation (mm/day)
    "RH2M": "ANN",  # relative humidity (%)
    "ALLSKY_SFC_SW_DWN": "ANN",  # sunlight at the surface (kWh/m²/day)
}
MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def boxes() -> list[tuple[int, int]]:
    land = load("land")
    out = []
    for la in range(-90, 90, 10):
        for lo in range(-180, 180, 10):
            r0, r1 = int((90 - (la + 10)) / 0.5), int((90 - la) / 0.5)
            c0, c1 = int((lo + 180) / 0.5), int((lo + 190) / 0.5)
            if land[r0:r1, c0:c1].max() > 0.02:
                out.append((la, lo))
    return out


def fetch_box(param: str, la: int, lo: int):
    url = (
        "https://power.larc.nasa.gov/api/temporal/climatology/regional?"
        f"parameters={param}&community=RE&latitude-min={la}&latitude-max={la + 10}"
        f"&longitude-min={lo}&longitude-max={lo + 10}&format=JSON"
    )
    try:
        return fetch_json(url, timeout=180, tries=7).get("features", [])
    except Exception as exc:  # noqa: BLE001
        print("  skip", param, la, lo, exc)
        return []


def main() -> None:
    bx = boxes()
    print(f"{len(bx)} land boxes × {len(PARAMS)} parameters")
    elev_nodes = np.full((NROW + 1, NCOL + 1), np.nan, np.float32)
    for param, agg in PARAMS.items():
        nodes = np.full((NROW + 1, NCOL + 1), np.nan, np.float32)
        with ThreadPoolExecutor(2) as pool:
            for feats in pool.map(lambda b: fetch_box(param, *b), bx):
                for f in feats:
                    lon, lat, elev = f["geometry"]["coordinates"]
                    v = f["properties"]["parameter"][param]
                    vals = [v[m] for m in MONTHS if v.get(m, -999) > -900]
                    if agg == "ANN":
                        x = v.get("ANN", np.nan)
                    elif agg == "MIN":
                        x = min(vals) if vals else np.nan
                    else:
                        x = max(vals) if vals else np.nan
                    if x is None or x <= -900:
                        continue
                    i, j = int(round((90 - lat) / 0.5)), int(round((lon + 180) / 0.5))
                    nodes[i, j] = x
                    elev_nodes[i, j] = elev
        # cell value = mean of its four corner nodes
        with np.errstate(all="ignore"):
            cells = np.nanmean(np.stack([nodes[:-1, :-1], nodes[1:, :-1], nodes[:-1, 1:], nodes[1:, 1:]]), 0)
        save("power_" + param.lower(), cells)
        print(f"  {param}: {np.isfinite(cells).mean():.0%} of cells")
    print("done.")


if __name__ == "__main__":
    main()
