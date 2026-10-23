# ShadowAstra Atlas · K2 · Earth terrain patches, cut exactly like the Moon and Mars ones (K1)
#
# Source: AWS Terrain Tiles (SRTM-based, Terrarium PNG) at zoom 9, the same source as the
# website's Earth terrain statistics. Every patch is a 50 km square, north up, resampled on
# an azimuthal equidistant grid on Earth's own radius, smoothed to its pixel spacing.
#   1. earth_cells128.npy  one 128 px patch for each of the 80,206 land cells (0.5° grid)
#   2. earth_train96.npy   96 px patches at random land places for self-supervised learning
# The land-cell list comes from the public website data (grid.json + grid.bin on GitHub).

import io
import json
import math
import os
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates

T0 = time.time()
OUT = Path("/kaggle/working")
LOG = []
REPO = "https://raw.githubusercontent.com/ABRUBAB/ShadowAstra_Atlas/main/public/data/"
TILE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/9/{x}/{y}.png"
Z = 9
NT = 2**Z
R = 6371.0
FOOT_KM = 50.0
N_TRAIN = int(os.environ.get("SA_TRAIN_PATCHES", 150_000))
UA = {"User-Agent": "ShadowAstra-Atlas (NASA Space Apps 2026)"}


def log(*a):
    msg = f"[{(time.time() - T0) / 60:6.1f} min] " + " ".join(str(x) for x in a)
    print(msg, flush=True)
    LOG.append(msg)


def get(url, timeout=120):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()


# ------------------------------------------------------------------ land cells
def land_cells():
    meta = json.loads(get(REPO + "grid.json"))
    buf = get(REPO + "grid.bin", timeout=600)
    mask = np.unpackbits(np.frombuffer(buf, np.uint8, count=meta["mask_bytes"]))[: meta["rows"] * meta["cols"]].astype(bool)
    p = np.nonzero(mask)[0][: meta["count"]]
    row, col = p // meta["cols"], p % meta["cols"]
    return 90 - (row + 0.5) * meta["res"], -180 + (col + 0.5) * meta["res"], meta["res"]


# ------------------------------------------------------------------ geometry (same as K1 and pipeline/terrain_lib.py)
def local_points(lat0, lon0, n):
    step = FOOT_KM / n
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


def merc(lat, lon):
    n = 256 * NT
    la = np.radians(np.clip(lat, -85.05, 85.05))
    return (lon + 180) / 360 * n, (1 - np.log(np.tan(la) + 1 / np.cos(la)) / np.pi) / 2 * n


# ------------------------------------------------------------------ tiles
class Tiles:
    def __init__(self, workers=48, cap=14000):
        self.cache, self.order = {}, []
        self.pool = ThreadPoolExecutor(workers)
        self.cap = cap
        self.fetched = self.failed = self.empty = 0

    def _get(self, key):
        x, y = key
        for k in range(6):
            try:
                raw = get(TILE.format(x=x, y=y), timeout=60)
                a = np.asarray(Image.open(io.BytesIO(raw)).convert("RGB"), dtype=np.float32)
                return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
            except urllib.error.HTTPError as e:
                if e.code in (403, 404):
                    return "empty"
                time.sleep(1 + 2 * k)
            except Exception:  # noqa: BLE001
                time.sleep(1 + 2 * k)
        return None

    def ensure(self, keys):
        miss = [k for k in keys if k not in self.cache]
        for k, a in zip(miss, self.pool.map(self._get, miss)):
            if isinstance(a, str):
                self.empty += 1
                a = None
            elif a is None:
                self.failed += 1
            self.cache[k] = a
            self.order.append(k)
            self.fetched += 1
        while len(self.order) > self.cap:
            self.cache.pop(self.order.pop(0), None)


def patches(lat0, lon0, size, tiles):
    """Heights (m) of 50 km patches around each centre, smoothed to the pixel spacing."""
    lat, lon = local_points(lat0, lon0, size)
    X, Y = merc(lat, lon)
    X, Y = X - 0.5, Y - 0.5
    W = 256 * NT
    m = len(lat0)
    boxes = []
    keys = set()
    for i in range(m):
        xi = X[i]
        if xi.max() - xi.min() > W / 2:  # crosses the antimeridian
            xi = np.where(xi < W / 2, xi + W, xi)
            X[i] = xi
        tx0, tx1 = int(np.floor(xi.min() / 256)), int(np.floor(xi.max() / 256)) + 1
        ty0, ty1 = int(np.floor(Y[i].min() / 256)), int(np.floor(Y[i].max() / 256)) + 1
        ty0, ty1 = max(0, ty0), min(NT - 1, ty1)
        boxes.append((tx0, tx1, ty0, ty1))
        for tx in range(tx0, tx1 + 1):
            for ty in range(ty0, ty1 + 1):
                keys.add((tx % NT, ty))
    tiles.ensure(sorted(keys, key=lambda k: (k[1], k[0])))
    out = np.full((m, size, size), np.nan, np.float32)
    for i, (tx0, tx1, ty0, ty1) in enumerate(boxes):
        mos = np.full(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256), np.nan, np.float32)
        for a, ty in enumerate(range(ty0, ty1 + 1)):
            for b, tx in enumerate(range(tx0, tx1 + 1)):
                t = tiles.cache.get((tx % NT, ty))
                if t is not None:
                    mos[a * 256 : (a + 1) * 256, b * 256 : (b + 1) * 256] = t
        ok = np.isfinite(mos)
        if not ok.any():
            continue
        if not ok.all():
            mos = np.where(ok, mos, np.nanmean(mos))
        pix_km = 40075.016686 * max(math.cos(math.radians(lat0[i])), 0.05) / W
        sig = (FOOT_KM / size / pix_km) / 2.4
        if sig > 0.3:
            mos = gaussian_filter(mos, sig, mode="nearest")
        coords = np.stack([Y[i] - ty0 * 256, X[i] - tx0 * 256])
        out[i] = map_coordinates(mos, coords, order=1, mode="nearest")
    return out


def build(name, lat0, lon0, size, tiles, batch=768):
    keep = np.abs(lat0) < 84.0
    lat0, lon0 = lat0[keep], lon0[keep]
    _, Y = merc(lat0, lon0)
    X, _ = merc(lat0, lon0)
    order = np.lexsort((np.floor(X / 256), np.floor(Y / 256)))
    arr = np.lib.format.open_memmap(OUT / f"earth_{name}.npy", mode="w+", dtype=np.float16, shape=(len(lat0), size, size))
    bad = 0
    for s in range(0, len(order), batch):
        idx = order[s : s + batch]
        h = patches(lat0[idx], lon0[idx], size, tiles)
        miss = ~np.isfinite(h).all(axis=(1, 2))
        bad += int(miss.sum())
        h = np.nan_to_num(h - np.nanmean(h, axis=(1, 2), keepdims=True))
        arr[idx] = h.astype(np.float16)
        if (s // batch) % 20 == 0:
            log(f"  {name}: {s + len(idx)}/{len(order)} · tiles {tiles.fetched} (empty {tiles.empty}, failed {tiles.failed})")
    arr.flush()
    np.save(OUT / f"earth_{name}_ll.npy", np.stack([lat0, lon0], 1).astype(np.float32))
    log(f"{name}: {len(lat0)} patches of {size}px, {bad} incomplete")


def main():
    lat, lon, res = land_cells()
    log(f"{len(lat)} land cells from the website grid")
    tiles = Tiles()
    build("cells128", lat, lon, 128, tiles)
    # random places on land, area-weighted, jittered inside their cell
    rng = np.random.default_rng(9)
    w = np.cos(np.radians(lat))
    pick = rng.choice(len(lat), size=N_TRAIN, p=w / w.sum())
    rl = lat[pick] + rng.uniform(-res / 2, res / 2, N_TRAIN)
    ro = lon[pick] + rng.uniform(-res / 2, res / 2, N_TRAIN)
    build("train96", rl, ro, 96, tiles)
    (OUT / "k2_log.json").write_text(json.dumps({"log": LOG, "minutes": (time.time() - T0) / 60, "tiles": tiles.fetched, "failed": tiles.failed}, indent=1))
    log("K2 done")


main()
