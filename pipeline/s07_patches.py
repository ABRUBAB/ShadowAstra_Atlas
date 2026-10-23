"""Step 7 · Height patches for the terrain encoder.

The same 50 km × 50 km footprint at 42 × 42 points (1.19 km) used everywhere else:
- every Earth land cell (AWS Terrain Tiles, already cached by step 3)
- ~2,000 Moon and ~4,000 Mars samples, cut from latitude bands of the full-precision
  LOLA (118 m) and MOLA (463 m) GeoTIFFs. Reading every n-th row of a whole band keeps
  the download small (about 200 MB) instead of one request per row per patch.
- the 18 Moon and Mars targets themselves

Patches are stored as float16 heights minus the patch mean (metres).

    python pipeline/s07_patches.py        (needs steps 1 and 3)
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from scipy.ndimage import gaussian_filter

from common import CACHE, LAT, LON, NROW, load
from s03_terrain import zoom_for
from s05_targets import read_targets
from terrain_lib import EARTH, FOOT_KM, LOLA_FULL, MOLA_FULL, N, RADIUS_KM, GeoTiffRows, local_points, sample, smooth

SPACING = FOOT_KM / N


def finish(h: np.ndarray, sigma: float) -> np.ndarray:
    """Fill holes, smooth like the statistics step, remove the mean."""
    mean = np.nanmean(h, axis=(1, 2), keepdims=True)
    h = np.where(np.isnan(h), mean, h)
    h = smooth(h, sigma)
    return (h - h.mean(axis=(1, 2), keepdims=True)).astype(np.float16)


def earth_patches():
    land = load("land")
    relief = np.load(CACHE / "terr_relief.npy")
    keep = (land >= 0.25) & np.isfinite(relief)
    I, J = np.where(keep)
    out = np.zeros((len(I), N, N), np.float16)
    t0 = time.time()
    rows = np.unique(I)
    for n, i in enumerate(rows):
        sel = np.where(I == i)[0]
        lat, lon = local_points("earth", np.full(len(sel), LAT[i]), LON[J[sel]])
        out[sel] = finish(sample(EARTH, zoom_for(LAT[i]), lat, lon), 0.8)
        if n % 40 == 0:
            print(f"  earth row {n + 1}/{len(rows)}  {(time.time() - t0) / 60:.1f} min", flush=True)
    return I, J, out


def band_patches(src: GeoTiffRows, lat_c: float, spacing_lon_km: float = 60.0):
    """All non-overlapping footprints centred on one latitude, from one band read."""
    R = RADIUS_KM[src.body]
    res_km = 2 * np.pi * R / src.width
    step = max(1, int(round(SPACING / res_km)))
    px_deg = src.width / 360.0
    half_deg = np.degrees((FOOT_KM * 0.75) / R)
    y0 = int((90 - (lat_c + half_deg)) * px_deg)
    y1 = int((90 - (lat_c - half_deg)) * px_deg) + 1
    y0, y1 = max(0, y0), min(src.height, y1)
    rows = list(range(y0, y1, step))
    with ThreadPoolExecutor(12) as pool:
        band = np.stack(list(pool.map(lambda r: src._row(r, 0, src.width), rows)))
    coslat = max(np.cos(np.radians(lat_c)), 0.05)
    # anti-alias along the row (columns are full resolution)
    band = gaussian_filter(band, sigma=(0.4, max(0.3, SPACING / (res_km * coslat) / 2.4)), mode=("nearest", "wrap"))
    n_lon = max(1, int(2 * np.pi * R * coslat / spacing_lon_km))
    lons = -180 + (np.arange(n_lon) + 0.5) * 360 / n_lon
    lat, lon = local_points(src.body, np.full(n_lon, lat_c), lons)
    X = ((lon + 180) * px_deg - 0.5) % src.width
    Y = ((90 - lat) * px_deg - 0.5 - y0) / step
    x0, yy0 = np.floor(X).astype(int), np.floor(Y).astype(int)
    fx, fy = X - x0, Y - yy0

    def at(x, y):
        return band[np.clip(y, 0, band.shape[0] - 1), x % src.width]

    h = (at(x0, yy0) * (1 - fx) + at(x0 + 1, yy0) * fx) * (1 - fy) + (at(x0, yy0 + 1) * (1 - fx) + at(x0 + 1, yy0 + 1) * fx) * fy
    return lat_c, lons, finish(h.astype(np.float32), 1.1)


def world_patches(src: GeoTiffRows, lats):
    out, meta = [], []
    for la in lats:
        t0 = time.time()
        lat_c, lons, p = band_patches(src, la)
        out.append(p)
        meta += [(lat_c, lo) for lo in lons]
        print(f"  {src.body} band {la:+.0f}: {len(lons)} patches  {time.time() - t0:.0f} s", flush=True)
    return np.concatenate(out), np.array(meta, np.float32)


def main() -> None:
    I, J, earth = earth_patches()
    np.savez(CACHE / "patches_earth.npz", I=I, J=J, h=earth)
    print(f"earth: {len(I)} patches")

    moon, moon_ll = world_patches(LOLA_FULL, np.arange(-80, 81, 10))
    mars, mars_ll = world_patches(MOLA_FULL, np.arange(-80, 81, 10))

    targets = read_targets()
    tp = []
    for t in targets:
        src = LOLA_FULL if t["body"] == "moon" else MOLA_FULL
        lat, lon = local_points(t["body"], np.array([t["lat"]]), np.array([t["lon"]]))
        tp.append(finish(src.sample(lat, lon, SPACING), 1.1)[0])
    np.savez(CACHE / "patches_space.npz", moon=moon, moon_ll=moon_ll, mars=mars, mars_ll=mars_ll, targets=np.stack(tp), target_ids=np.array([t["id"] for t in targets]))
    print(f"moon {len(moon)} · mars {len(mars)} · targets {len(tp)}")
    _ = NROW


if __name__ == "__main__":
    main()
