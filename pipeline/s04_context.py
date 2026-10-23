"""Step 4 · Geological context and place names for every land cell.

- distance to the nearest Holocene volcano (Smithsonian GVP) → volcanic score
- distance to confirmed impact structures, scaled by crater size → impact score
- country, named physical region (desert, range, plateau…) and nearest town
  from Natural Earth (public domain), so new candidates get readable names.

    python pipeline/s04_context.py        (needs s01 land mask)
"""

from __future__ import annotations

import json

import numpy as np
from matplotlib.path import Path as MPath

from catalogue import IMPACTS
from common import CACHE, LAT, LON, fetch, fetch_json, load

NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"


def hav(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dp, dl = p2 - p1, np.radians(lon2 - lon1)
    a = np.sin(dp / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
    return 2 * 6371 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def nearest(clat, clon, plat, plon, chunk=4000):
    best = np.full(len(clat), np.inf)
    arg = np.zeros(len(clat), np.int64)
    for s in range(0, len(clat), chunk):
        d = hav(clat[s : s + chunk, None], clon[s : s + chunk, None], plat[None], plon[None])
        arg[s : s + chunk] = d.argmin(1)
        best[s : s + chunk] = d.min(1)
    return best, arg


def rings(geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return [np.asarray(p[0]) for p in polys]  # outer rings only


def assign(features, clat, clon, key="NAME", prefer_small=False):
    """Index of the containing polygon per cell (-1 if none)."""
    out = np.full(len(clat), -1, np.int32)
    area = np.full(len(clat), np.inf)
    pts = np.column_stack([clon, clat])
    for fi, f in enumerate(features):
        if not f.get("geometry"):
            continue
        for ring in rings(f["geometry"]):
            x0, y0 = ring.min(0)
            x1, y1 = ring.max(0)
            m = (clon >= x0) & (clon <= x1) & (clat >= y0) & (clat <= y1)
            if not m.any():
                continue
            inside = MPath(ring).contains_points(pts[m])
            idx = np.where(m)[0][inside]
            a = (x1 - x0) * (y1 - y0)
            take = idx[(area[idx] > a)] if prefer_small else idx[out[idx] < 0]
            out[take] = fi
            if prefer_small:
                area[take] = a
    return out


def main() -> None:
    land = load("land")
    I, J = np.where(land > 0.02)
    clat, clon = LAT[I], LON[J]
    print(f"{len(I)} land cells")

    gvp = fetch_json(
        "https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature"
        "&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application%2Fjson"
    )
    vlon = np.array([f["geometry"]["coordinates"][0] for f in gvp["features"]])
    vlat = np.array([f["geometry"]["coordinates"][1] for f in gvp["features"]])
    vname = [f["properties"]["Volcano_Name"] for f in gvp["features"]]
    dv, av = nearest(clat, clon, vlat, vlon)
    print(f"  volcanoes: {len(vlat)}")

    ilat = np.array([x[1] for x in IMPACTS])
    ilon = np.array([x[2] for x in IMPACTS])
    idia = np.array([x[3] for x in IMPACTS])
    di = np.full(len(clat), np.inf)
    ai = np.zeros(len(clat), np.int64)
    best = np.zeros(len(clat))
    for k in range(len(IMPACTS)):
        d = hav(clat, clon, ilat[k], ilon[k])
        score = np.exp(-np.maximum(d - idia[k] / 2, 0) / 40)  # 1 inside the rim, fades over ~40 km
        better = score > best
        best[better], ai[better], di[better] = score[better], k, d[better]

    countries = fetch_json(NE + "ne_50m_admin_0_countries.geojson")["features"]
    regions = [f for f in fetch_json(NE + "ne_10m_geography_regions_polys.geojson")["features"] if f.get("properties", {}).get("NAME")]
    places = fetch_json(NE + "ne_10m_populated_places_simple.geojson")["features"]
    c_idx = assign(countries, clat, clon)
    r_idx = assign(regions, clat, clon, prefer_small=True)
    plat = np.array([p["geometry"]["coordinates"][1] for p in places])
    plon = np.array([p["geometry"]["coordinates"][0] for p in places])
    dp, ap = nearest(clat, clon, plat, plon)
    print("  names: done")

    np.savez(
        CACHE / "context.npz",
        I=I, J=J, dvolc=dv, avolc=av, impact=best, aimp=ai, dimp=di,
        country=c_idx, region=r_idx, place=ap, dplace=dp,
    )
    names = {
        "volcanoes": vname,
        "impacts": [x[0] for x in IMPACTS],
        "countries": [f["properties"].get("NAME_LONG") or f["properties"].get("NAME") for f in countries],
        "regions": [f["properties"]["NAME"].title() if f["properties"]["NAME"].isupper() else f["properties"]["NAME"] for f in regions],
        "region_kind": [f["properties"].get("FEATURECLA", "") for f in regions],
        "places": [p["properties"]["name"] for p in places],
    }
    (CACHE / "names.json").write_text(json.dumps(names, ensure_ascii=False), encoding="utf-8")
    print("done.")


if __name__ == "__main__":
    _ = fetch  # keep import for cache warmup tooling
    main()
