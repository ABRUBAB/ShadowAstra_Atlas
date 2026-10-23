# ShadowAstra Atlas · K1 · Moon and Mars at full precision
#
# Downloads the complete USGS Astrogeology global DEMs (LRO LOLA 118 m, 8.5 GB; MGS MOLA
# 463 m, 2.1 GB), then builds, with exactly the same method used for Earth:
#   1. global 0.5° grids of 50 km terrain statistics (slope histogram, relief, roughness…)
#   2. 128 px "cell patches" (50 km, 1° spacing) for retrieval and foundation models
#   3. 96 px "training patches" at random places for self-supervised learning
# Everything is written to /kaggle/working for the next notebooks.

import json
import math
import os
import struct
import subprocess
import time
import urllib.request
from pathlib import Path

import numpy as np
from scipy.ndimage import gaussian_filter

T0 = time.time()
OUT = Path("/kaggle/working")
TMP = Path("/kaggle/tmp") if Path("/kaggle/tmp").exists() else Path("/tmp/sa")
TMP.mkdir(parents=True, exist_ok=True)
N_TRAIN = int(os.environ.get("SA_TRAIN_PATCHES", 150_000))
LOG = []


def log(*a):
    msg = f"[{(time.time() - T0) / 60:6.1f} min] " + " ".join(str(x) for x in a)
    print(msg, flush=True)
    LOG.append(msg)


BASE = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/"
DEMS = {
    "moon": {"file": "Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif", "scale": 0.5, "R": 1737.4},
    "mars": {"file": "Mars_MGS_MOLA_DEM_mosaic_global_463m.tif", "scale": 1.0, "R": 3389.5},
}
FOOT_KM = 50.0
N = 42
SLOPE_BINS = np.array([0, 1, 2, 4, 6, 10, 15, 25, 90], np.float32)


# ------------------------------------------------------------------ TIFF layout
def tiff_strips(path):
    """Width, height, first strip offset and whether strips are contiguous (BigTIFF aware)."""
    with open(path, "rb") as f:
        head = f.read(16)
        bo = "<" if head[:2] == b"II" else ">"
        big = struct.unpack(bo + "H", head[2:4])[0] == 43
        f.seek(struct.unpack(bo + ("Q" if big else "I"), head[8:16] if big else head[4:8])[0])
        n = struct.unpack(bo + ("Q" if big else "H"), f.read(8 if big else 2))[0]
        esize, vlen = (20, 8) if big else (12, 4)
        raw = f.read(n * esize)
        tags = {}
        sizes = {3: 2, 4: 4, 16: 8, 12: 8}
        for i in range(n):
            e = raw[i * esize : (i + 1) * esize]
            tag, typ = struct.unpack(bo + "HH", e[:4])
            cnt = struct.unpack(bo + ("Q" if big else "I"), e[4 : 4 + vlen])[0]
            nb = sizes.get(typ, 1) * cnt
            if nb <= vlen:
                data = e[4 + vlen : 4 + vlen + nb]
            else:
                off = struct.unpack(bo + ("Q" if big else "I"), e[4 + vlen : 4 + 2 * vlen])[0]
                pos = f.tell()
                f.seek(off)
                data = f.read(nb)
                f.seek(pos)
            fmt = {3: "H", 4: "I", 16: "Q", 12: "d"}.get(typ)
            tags[tag] = struct.unpack(bo + fmt * cnt, data) if fmt else data
    w, h = tags[256][0], tags[257][0]
    offs = np.array(tags[273], np.int64)
    contiguous = len(offs) == 1 or np.all(np.diff(offs) == np.diff(offs)[0])
    return w, h, int(offs[0]), bool(contiguous), tags.get(339, (2,))[0], tags.get(258, (16,))[0], bo


def open_dem(body):
    d = DEMS[body]
    path = TMP / d["file"]
    if not path.exists():
        log("downloading", d["file"])
        subprocess.run(["curl", "-sL", "--retry", "8", "-C", "-", "-o", str(path), BASE + d["file"]], check=True)
    w, h, off, contiguous, fmt, bits, bo = tiff_strips(path)
    assert contiguous and bits == 16 and fmt == 2, (contiguous, bits, fmt)
    log(f"{body}: {w}×{h}, offset {off}, {path.stat().st_size / 1e9:.2f} GB")
    return np.memmap(path, dtype=bo + "i2", mode="r", offset=off, shape=(h, w)), d


# ------------------------------------------------------------------ geometry
def local_points(R, lat0, lon0, foot_km, n):
    step = foot_km / n
    u = (np.arange(n) + 0.5 - n / 2) * step
    x = np.broadcast_to(u[None, None, :], (1, n, n))
    y = np.broadcast_to(-u[None, :, None], (1, n, n))
    rho = np.hypot(x, y)
    c = rho / R
    p0 = np.radians(lat0)[:, None, None]
    with np.errstate(invalid="ignore", divide="ignore"):
        lat = np.arcsin(np.cos(c) * np.sin(p0) + np.where(rho > 0, y * np.sin(c) * np.cos(p0) / rho, 0))
        lon = np.radians(lon0)[:, None, None] + np.arctan2(x * np.sin(c), rho * np.cos(p0) * np.cos(c) - y * np.sin(p0) * np.sin(c))
    return np.degrees(lat), (np.degrees(lon) + 180) % 360 - 180


class Band:
    """A smoothed, decimated latitude band of the DEM for fast bilinear sampling."""

    def __init__(self, dem, d, lat_lo, lat_hi, target_km):
        H, W = dem.shape
        self.W0 = W
        px_deg = W / 360.0
        res_km = 2 * math.pi * d["R"] / W
        self.dec = max(1, int(target_km / res_km / 2))  # keep ≥2 samples per output spacing
        y0 = max(0, int((90 - lat_hi) * px_deg) - 4)
        y1 = min(H, int((90 - lat_lo) * px_deg) + 5)
        a = dem[y0:y1:self.dec, :: self.dec].astype(np.float32) * d["scale"]
        coslat = max(math.cos(math.radians((lat_lo + lat_hi) / 2)), 0.02)
        rk = res_km * self.dec
        sy = (target_km / rk) / 2.4
        sx = min((target_km / (rk * coslat)) / 2.4, 400)
        if sy > 0.3 or sx > 0.3:
            a = gaussian_filter(a, sigma=(max(sy, 0), max(sx, 0)), mode=("nearest", "wrap"))
        self.a, self.y0, self.px_deg = a, y0, px_deg / self.dec

    def sample(self, lat, lon):
        X = ((lon + 180) * self.px_deg - 0.5) % self.a.shape[1]
        Y = (90 - lat) * self.px_deg - 0.5 - self.y0 / self.dec
        x0, y0 = np.floor(X).astype(np.int64), np.floor(Y).astype(np.int64)
        fx, fy = X - x0, Y - y0
        w = self.a.shape[1]
        hgt = self.a.shape[0]

        def at(x, y):
            return self.a[np.clip(y, 0, hgt - 1), x % w]

        return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy


def stats(h, spacing_km):
    """Identical to pipeline/terrain_lib.stats (body ≠ earth → smoothing 1.1)."""
    h = gaussian_filter(h, sigma=(0, 1.1, 1.1), mode="nearest")
    d = spacing_km * 1000 * 2
    gx = (h[:, 1:-1, 2:] - h[:, 1:-1, :-2]) / d
    gy = (h[:, 2:, 1:-1] - h[:, :-2, 1:-1]) / d
    slope = np.degrees(np.arctan(np.hypot(gx, gy))).reshape(len(h), -1)
    hist = np.stack([((slope >= SLOPE_BINS[b]) & (slope < SLOPE_BINS[b + 1])).mean(1) for b in range(8)], 1)
    flat = h.reshape(len(h), -1)
    rough = np.sqrt(((h - gaussian_filter(h, sigma=(0, 4, 4), mode="nearest")) ** 2).reshape(len(h), -1).mean(1))
    return {
        "hist": hist.astype(np.float32),
        "mean_slope": slope.mean(1).astype(np.float32),
        "p90_slope": np.percentile(slope, 90, axis=1).astype(np.float32),
        "relief": (np.percentile(flat, 98, axis=1) - np.percentile(flat, 2, axis=1)).astype(np.float32),
        "rough": rough.astype(np.float32),
        "elev": flat.mean(1).astype(np.float32),
    }


def margin_deg(R, km):
    return math.degrees(km / R)


# ------------------------------------------------------------------ products
def build_grid(body, dem, d):
    res = 0.5
    lats = 90 - (np.arange(int(180 / res)) + 0.5) * res
    lons = -180 + (np.arange(int(360 / res)) + 0.5) * res
    keys = ("mean_slope", "p90_slope", "relief", "rough", "elev")
    out = {k: np.full((len(lats), len(lons)), np.nan, np.float32) for k in keys}
    hist = np.zeros((len(lats), len(lons), 8), np.float32)
    m = margin_deg(d["R"], FOOT_KM * 0.75)
    for i, la in enumerate(lats):
        band = Band(dem, d, max(-90, la - m), min(90, la + m), FOOT_KM / N)
        lat, lon = local_points(d["R"], np.full(len(lons), la), lons, FOOT_KM, N)
        s = stats(band.sample(lat, lon), FOOT_KM / N)
        for k in keys:
            out[k][i] = s[k]
        hist[i] = s["hist"]
        if i % 30 == 0:
            log(f"  {body} grid row {i}/{len(lats)} lat {la:+.2f}")
    np.savez_compressed(OUT / f"{body}_grid_terrain.npz", hist=hist, lat=lats, lon=lons, **out)
    log(f"{body} grid saved")


def build_patches(body, dem, d, centres, size, name):
    """Heights minus mean (metres, float16) on a 50 km square, north up."""
    order = np.argsort(-centres[:, 0])
    arr = np.lib.format.open_memmap(OUT / f"{body}_{name}.npy", mode="w+", dtype=np.float16, shape=(len(centres), size, size))
    m = margin_deg(d["R"], FOOT_KM * 0.75)
    step = 0.5
    edges = np.arange(90, -90 - step, -step)
    for b0, b1 in zip(edges[:-1], edges[1:]):
        sel = order[(centres[order, 0] <= b0) & (centres[order, 0] > b1)]
        if not len(sel):
            continue
        band = Band(dem, d, max(-90, b1 - m), min(90, b0 + m), FOOT_KM / size)
        for s in range(0, len(sel), 2048):
            idx = sel[s : s + 2048]
            lat, lon = local_points(d["R"], centres[idx, 0], centres[idx, 1], FOOT_KM, size)
            h = band.sample(lat, lon)
            arr[idx] = (h - h.mean(axis=(1, 2), keepdims=True)).astype(np.float16)
    arr.flush()
    np.save(OUT / f"{body}_{name}_ll.npy", centres.astype(np.float32))
    log(f"{body} {name}: {len(centres)} patches of {size}px")


def main():
    rng = np.random.default_rng(7)
    for body in ("mars", "moon"):
        dem, d = open_dem(body)
        build_grid(body, dem, d)
        la = np.arange(89.5, -90, -1.0)
        lo = np.arange(-179.5, 180, 1.0)
        cells = np.stack(np.meshgrid(la, lo, indexing="ij"), -1).reshape(-1, 2)
        build_patches(body, dem, d, cells, 128, "cells128")
        # area-uniform random centres for self-supervised training
        u = rng.uniform(-1, 1, N_TRAIN)
        rand = np.stack([np.degrees(np.arcsin(u)), rng.uniform(-180, 180, N_TRAIN)], 1)
        build_patches(body, dem, d, rand, 96, "train96")
        del dem
        os.remove(TMP / d["file"])
    (OUT / "k1_log.json").write_text(json.dumps({"log": LOG, "minutes": (time.time() - T0) / 60}, indent=1))
    log("K1 done")


main()
