"""Step 13 · Moon and Mars context layers on 0.5° grids (small downloads only).

Mars
  - Global Geologic Map of Mars (Tanaka et al. 2014, USGS SIM 3292): unit polygons → unit class
  - Robbins & Hynek 2012 crater database (USGS): craters ≥ 1 km per 10,000 km², largest crater nearby
  - TES minerals, dust, albedo, thermal inertia (step 11) → 0.5° means
  - Mars Global Cave Candidate Catalog (MGC³, Cushing): candidates within 100 km
Moon
  - LROC lunar pit catalogue (Wagner & Robinson): pits within 100 km
  - LRO LOLA normal albedo (10 ppd, USGS): dark mare vs bright highlands

    python pipeline/s13_planet_context.py      (needs step 11)
"""

from __future__ import annotations

import io
import json
import struct

import numpy as np
from matplotlib.path import Path as MPath

from common import CACHE, fetch, fetch_json

RES = 0.5
LAT = 90 - (np.arange(int(180 / RES)) + 0.5) * RES
LON = -180 + (np.arange(int(360 / RES)) + 0.5) * RES
GLAT, GLON = np.meshgrid(LAT, LON, indexing="ij")
R = {"moon": 1737.4, "mars": 3389.5}
API = "https://astrogeology.usgs.gov/pygeoapi/collections/"


def paged(collection: str, limit: int = 10000):
    feats, off = [], 0
    while True:
        d = fetch_json(f"{API}{collection}/items?f=json&limit={limit}&offset={off}", timeout=300)
        got = d.get("features", [])
        feats += got
        if len(got) < limit:
            return feats
        off += limit


def hav(lat1, lon1, lat2, lon2, r):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(lon2 - lon1) / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def count_within(plat, plon, km, body, weights=None):
    """Number (or weighted sum) of points within km of every cell centre."""
    out = np.zeros(GLAT.shape, np.float32)
    deg = np.degrees(km / R[body])
    w = np.ones(len(plat)) if weights is None else weights
    for la, lo, ww in zip(plat, plon, w):
        r0 = max(0, int((90 - (la + deg)) / RES) - 1)
        r1 = min(len(LAT), int((90 - (la - deg)) / RES) + 2)
        d = hav(GLAT[r0:r1], GLON[r0:r1], la, lo, R[body])
        out[r0:r1] += (d <= km) * ww
    return out


def block_mean(a: np.ndarray, out_rows: int) -> np.ndarray:
    f = a.shape[0] // out_rows
    return np.nanmean(a.reshape(out_rows, f, a.shape[1] // f, f), axis=(1, 3))


UNIT_CLASS = {
    # Tanaka 2014 unit-name suffixes → plain classes
    "v": "volcanic", "pc": "polar", "pd": "polar", "pu": "polar", "pl": "polar", "p": "polar",
    "h": "highland", "hu": "highland", "e": "highland", "m": "highland", "b": "lowland",
    "l": "lowland", "t": "transition", "a": "apron", "i": "impact", "c": "impact",
}
CLASSES = ["volcanic", "highland", "lowland", "polar", "impact", "transition", "apron", "other"]


def unit_class(unit: str, desc: str) -> str:
    d = desc.lower()
    for key in ("volcanic", "polar", "impact", "highland", "lowland", "transition", "apron", "basin"):
        if key in d:
            return "lowland" if key == "basin" else key
    return "other"


def mars_geology():
    feats = paged("mars/sim3292_global_geologic_map/units", 100)
    print(f"  geology polygons: {len(feats)}")
    cls = np.full(GLAT.shape, -1, np.int8)
    units: list[str] = []
    unit_idx = np.full(GLAT.shape, -1, np.int16)
    pts = np.column_stack([GLON.ravel(), GLAT.ravel()])
    area = np.full(GLAT.size, np.inf)
    for f in feats:
        g = f.get("geometry")
        if not g:
            continue
        p = f["properties"]
        c = CLASSES.index(unit_class(p.get("unit", ""), p.get("unitdesc", "")))
        if p.get("unitdesc") not in units:
            units.append(p.get("unitdesc"))
        ui = units.index(p.get("unitdesc"))
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            ring = np.asarray(poly[0])
            if ring.ndim != 2:
                continue
            ring[:, 0] = (ring[:, 0] + 180) % 360 - 180 if ring[:, 0].max() > 180 else ring[:, 0]
            x0, y0 = ring.min(0)
            x1, y1 = ring.max(0)
            m = (pts[:, 0] >= x0) & (pts[:, 0] <= x1) & (pts[:, 1] >= y0) & (pts[:, 1] <= y1)
            if not m.any():
                continue
            idx = np.where(m)[0][MPath(ring).contains_points(pts[m])]
            a = (x1 - x0) * (y1 - y0)
            idx = idx[area[idx] > a]  # smallest containing polygon wins
            area[idx] = a
            cls.ravel()[idx] = c
            unit_idx.ravel()[idx] = ui
    np.save(CACHE / "mars_geo_class.npy", cls)
    np.save(CACHE / "mars_geo_unit.npy", unit_idx)
    (CACHE / "mars_geo_units.json").write_text(json.dumps({"classes": CLASSES, "units": units}, indent=1), encoding="utf-8")
    vals, cnt = np.unique(cls, return_counts=True)
    print("  classes:", {CLASSES[v] if v >= 0 else "none": int(c) for v, c in zip(vals, cnt)})


def mars_craters():
    feats = paged("mars/robbinsv1", 10000)
    lat = np.array([f["properties"]["lat"] for f in feats], np.float32)
    lon = np.array([(f["properties"]["lon_e"] + 180) % 360 - 180 for f in feats], np.float32)
    dia = np.array([f["properties"]["diamkm"] for f in feats], np.float32)
    print(f"  craters: {len(dia)}")
    np.savez_compressed(CACHE / "mars_craters.npz", lat=lat, lon=lon, dia=dia)
    # density of craters ≥ 1 km per 10^4 km² in 0.5° cells, then a 2-cell smooth
    cell_area = (np.radians(RES) * R["mars"]) ** 2 * np.cos(np.radians(GLAT))
    i = np.clip(((90 - lat) / RES).astype(int), 0, len(LAT) - 1)
    j = np.clip(((lon + 180) / RES).astype(int), 0, len(LON) - 1)
    counts = np.zeros(GLAT.shape, np.float32)
    np.add.at(counts, (i[dia >= 1], j[dia >= 1]), 1)
    big = np.zeros(GLAT.shape, np.float32)
    np.maximum.at(big, (i, j), dia)
    np.save(CACHE / "mars_crater_density.npy", counts / np.maximum(cell_area, 1) * 1e4)
    np.save(CACHE / "mars_crater_max.npy", big)


def mars_tes():
    for name in ("hematite", "olivine", "plagioclase", "clinopyroxene", "orthopyroxene", "quartz", "feldspar", "amphibole", "glass_clay", "dust", "albedo", "thermal_inertia"):
        a = np.load(CACHE / f"mars_tes_{name}.npy")
        np.save(CACHE / f"mars_{name}.npy", block_mean(a, len(LAT)).astype(np.float32))
    print("  TES layers on the 0.5° grid")


def mars_caves():
    import csv

    rows = list(csv.reader(open(CACHE / "dl_caves" / "data" / "Mars_Cave_Catalog.csv", encoding="latin-1")))
    head, body = rows[0], rows[1:]
    lat = np.array([float(r[2]) for r in body])
    lon = np.array([(float(r[1]) + 180) % 360 - 180 for r in body])
    pri = np.array([float(r[5]) if r[5].replace(".", "").isdigit() else 3 for r in body])
    np.savez_compressed(CACHE / "mars_caves.npz", lat=lat, lon=lon, priority=pri)
    np.save(CACHE / "mars_caves_100km.npy", count_within(lat, lon, 100, "mars"))
    print(f"  caves: {len(lat)}")


def read_dbf(path):
    raw = open(path, "rb").read()
    n = struct.unpack("<I", raw[4:8])[0]
    hlen, rlen = struct.unpack("<HH", raw[8:12])
    fields, pos = [], 32
    while raw[pos] != 0x0D:
        name = raw[pos : pos + 11].split(b"\0")[0].decode()
        fields.append((name, raw[pos + 16]))
        pos += 32
    out = []
    for k in range(n):
        rec = raw[hlen + k * rlen + 1 : hlen + (k + 1) * rlen]
        off, row = 0, {}
        for name, ln in fields:
            row[name] = rec[off : off + ln].decode("latin-1").strip()
            off += ln
        out.append(row)
    return out


def moon_pits():
    rows = read_dbf(CACHE / "dl_pits" / "LUNAR_PIT_LOCATIONS_360.DBF")
    keys = list(rows[0].keys())
    la_k = next(k for k in keys if k.lower().startswith("lat"))
    lo_k = next(k for k in keys if k.lower().startswith("lon"))
    lat = np.array([float(r[la_k]) for r in rows])
    lon = np.array([(float(r[lo_k]) + 180) % 360 - 180 for r in rows])
    np.savez_compressed(CACHE / "moon_pits.npz", lat=lat, lon=lon)
    np.save(CACHE / "moon_pits_100km.npy", count_within(lat, lon, 100, "moon"))
    print(f"  lunar pits: {len(lat)}  fields: {keys[:12]}")


def moon_albedo():
    import tifffile

    raw = fetch("https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Lunar_LRO_LOLA_Albedo_Global_10ppd.tif", timeout=600)
    a = tifffile.imread(io.BytesIO(raw)).astype(np.float32)
    if a.ndim == 3:
        a = a[..., 0]
    a[(a <= 0) | ~np.isfinite(a) | (a > 1e10)] = np.nan
    print(f"  LOLA albedo {a.shape} median {np.nanmedian(a):.3f}")
    f = a.shape[0] // len(LAT)
    np.save(CACHE / "moon_albedo.npy", np.nanmean(a[: f * len(LAT), : f * len(LON)].reshape(len(LAT), f, len(LON), f), axis=(1, 3)).astype(np.float32))


def main() -> None:
    for fn in (mars_tes, mars_caves, moon_pits, moon_albedo, mars_craters, mars_geology):
        print("==", fn.__name__, flush=True)
        try:
            fn()
        except Exception as exc:  # noqa: BLE001
            import traceback

            traceback.print_exc()
            print("  failed:", exc)
    print("done.")


if __name__ == "__main__":
    main()
