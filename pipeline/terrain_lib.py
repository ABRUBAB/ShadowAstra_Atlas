"""Terrain sampling and statistics, a NumPy twin of src/lib/terrain.ts.

Every footprint (Earth cell or Moon/Mars target) is resampled onto the same local grid:
a square of FOOT_KM x FOOT_KM centred on the point, N x N samples (~1.2 km apart),
north up, via an inverse azimuthal-equidistant projection. Statistics use the same
smoothing, slope baseline and histogram bins as the web app, so numbers match.
"""

from __future__ import annotations

import io
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

from common import fetch

FOOT_KM = 50.0
N = 42  # samples per side -> 1.19 km spacing
SLOPE_BINS = np.array([0, 1, 2, 4, 6, 10, 15, 25, 90], dtype=np.float32)
RADIUS_KM = {"earth": 6371.0, "moon": 1737.4, "mars": 3389.5}


@dataclass
class Source:
    body: str
    grid: str  # "mercator" | "equirect"
    url: str  # with {z}{x}{y}
    decode: str  # "terrarium" | "moon8" | "mars8"

    def tile(self, z: int, x: int, y: int) -> np.ndarray | None:
        return _decoded(self.url.format(z=z, x=x, y=y), self.decode)


@lru_cache(maxsize=1500)
def _decoded(url: str, kind: str) -> np.ndarray | None:
    try:
        raw = fetch(url, timeout=60)
    except RuntimeError:
        return None
    im = Image.open(io.BytesIO(raw))
    if kind == "terrarium":
        a = np.asarray(im.convert("RGB"), dtype=np.float32)
        return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    a = np.asarray(im.convert("LA"), dtype=np.float32)
    dn, alpha = a[..., 0], a[..., 1]
    v = -9150 + 78.2 * dn if kind == "moon8" else -10538 + 129.9 * dn
    return np.where(alpha < 8, np.nan, v).astype(np.float32)


EARTH = Source("earth", "mercator", "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png", "terrarium")
MOON = Source(
    "moon",
    "equirect",
    "https://trek.nasa.gov/tiles/Moon/EQ/LRO_LOLA_DEM_Global_128ppd_v04/1.0.0/default/default028mm/{z}/{y}/{x}.png",
    "moon8",
)
MARS = Source(
    "mars",
    "equirect",
    "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_DEM_mosaic_global_463m_8/1.0.0/default/default028mm/{z}/{y}/{x}.png",
    "mars8",
)


def local_points(body: str, lat0: np.ndarray, lon0: np.ndarray, foot_km: float = FOOT_KM, n: int = N):
    """(m, n, n) lat/lon of an n x n grid around each of m centres (inverse azimuthal equidistant)."""
    R = RADIUS_KM[body]
    step = foot_km / n
    u = (np.arange(n) + 0.5 - n / 2) * step
    x = np.broadcast_to(u[None, None, :], (1, n, n))
    y = np.broadcast_to(-u[None, :, None], (1, n, n))  # row 0 = north
    rho = np.hypot(x, y)
    c = rho / R
    p0 = np.radians(lat0)[:, None, None]
    with np.errstate(invalid="ignore", divide="ignore"):
        lat = np.arcsin(np.cos(c) * np.sin(p0) + np.where(rho > 0, y * np.sin(c) * np.cos(p0) / rho, 0))
        lon = np.radians(lon0)[:, None, None] + np.arctan2(x * np.sin(c), rho * np.cos(p0) * np.cos(c) - y * np.sin(p0) * np.sin(c))
    lon = (np.degrees(lon) + 180) % 360 - 180
    return np.degrees(lat), lon


def world_px(src: Source, z: int, lat: np.ndarray, lon: np.ndarray):
    if src.grid == "mercator":
        n = 256 * 2**z
        la = np.radians(np.clip(lat, -85.05, 85.05))
        return (lon + 180) / 360 * n, (1 - np.log(np.tan(la) + 1 / np.cos(la)) / np.pi) / 2 * n, n
    w = 512 * 2**z
    return (lon + 180) / 360 * w, (90 - lat) / 180 * (w / 2), w


def sample(src: Source, z: int, lat: np.ndarray, lon: np.ndarray, threads: int = 16) -> np.ndarray:
    """Bilinear elevation (m) at arbitrary lat/lon arrays."""
    X, Y, W = world_px(src, z, lat, lon)
    X, Y = X - 0.5, Y - 0.5
    x0, y0 = np.floor(X).astype(np.int64), np.floor(Y).astype(np.int64)
    fx, fy = (X - x0).astype(np.float32), (Y - y0).astype(np.float32)
    cols = W // 256
    rows = cols if src.grid == "mercator" else cols // 2
    need = set()
    for dx in (0, 1):
        for dy in (0, 1):
            tx = ((x0 + dx) // 256) % cols
            ty = (y0 + dy) // 256
            need.update(zip(tx.ravel().tolist(), ty.ravel().tolist()))
    need = {t for t in need if 0 <= t[1] < rows}
    with ThreadPoolExecutor(threads) as pool:
        tiles = dict(zip(need, pool.map(lambda t: src.tile(z, t[0], t[1]), need)))

    def at(xx, yy):
        tx = (xx // 256) % cols
        ty = yy // 256
        out = np.full(xx.shape, np.nan, np.float32)
        for key in set(zip(tx.ravel().tolist(), ty.ravel().tolist())):
            t = tiles.get(key)
            if t is None:
                continue
            m = (tx == key[0]) & (ty == key[1])
            out[m] = t[np.clip(yy[m] - key[1] * 256, 0, 255), np.clip(xx[m] % 256, 0, 255)]
        return out

    a, b = at(x0, y0), at(x0 + 1, y0)
    c, d = at(x0, y0 + 1), at(x0 + 1, y0 + 1)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def smooth(h: np.ndarray, sigma: float) -> np.ndarray:
    return gaussian_filter(h, sigma=(0, sigma, sigma), mode="nearest")


def stats(h: np.ndarray, spacing_km: float, body: str = "earth") -> dict[str, np.ndarray]:
    """Batch terrain statistics for heights h of shape (m, n, n) in metres."""
    h = h.copy()
    # fill holes with the footprint mean so geometry stays continuous
    mean = np.nanmean(h, axis=(1, 2), keepdims=True)
    miss = np.isnan(h).mean(axis=(1, 2))
    h = np.where(np.isnan(h), mean, h)
    h = smooth(h, 0.8 if body == "earth" else 1.1)
    d = spacing_km * 1000 * 2
    gx = (h[:, 1:-1, 2:] - h[:, 1:-1, :-2]) / d
    gy = (h[:, 2:, 1:-1] - h[:, :-2, 1:-1]) / d
    slope = np.degrees(np.arctan(np.hypot(gx, gy))).reshape(len(h), -1)
    hist = np.stack([((slope >= SLOPE_BINS[b]) & (slope < SLOPE_BINS[b + 1])).mean(1) for b in range(len(SLOPE_BINS) - 1)], 1)
    flat = h.reshape(len(h), -1)
    rough = np.sqrt(((h - smooth(h, 4)) ** 2).reshape(len(h), -1).mean(1))
    return {
        "hist": hist.astype(np.float32),
        "mean_slope": slope.mean(1),
        "p90_slope": np.percentile(slope, 90, axis=1),
        "relief": np.percentile(flat, 98, axis=1) - np.percentile(flat, 2, axis=1),
        "rough": rough,
        "elev": flat.mean(1),
        "missing": miss,
    }


def topo_similarity(hist_a, relief_a, hist_b, relief_b):
    """Same formula as the app: 0.65 · slope-histogram overlap + 0.35 · relief agreement."""
    overlap = np.minimum(hist_a, hist_b).sum(-1)
    ratio = np.maximum(relief_a, 1) / np.maximum(relief_b, 1)
    rel = np.clip(1 - np.abs(np.log10(ratio)), 0, 1)
    return 0.65 * overlap + 0.35 * rel


# ------------------------------------------------------------------ full precision
import hashlib as _hashlib
import urllib.request as _urlreq

from common import CACHE as _CACHE


@dataclass
class GeoTiffRows:
    """A global, uncompressed, one-row-per-strip int16 GeoTIFF read by HTTP range requests.

    USGS Astrogeology mirrors of the NASA MOLA (Mars, 463 m) and LRO LOLA (Moon, 118 m)
    global DEMs. Only the rows and columns a footprint needs are downloaded (and cached).
    """

    body: str
    url: str
    width: int
    height: int
    first_offset: int
    scale: float  # metres per DN

    def _row(self, r: int, c0: int, c1: int) -> np.ndarray:
        a = self.first_offset + r * self.width * 2 + c0 * 2
        b = self.first_offset + r * self.width * 2 + c1 * 2 - 1
        key = _CACHE / ("rng_" + _hashlib.sha1(f"{self.url}|{a}|{b}".encode()).hexdigest())
        if key.exists():
            raw = key.read_bytes()
        else:
            req = _urlreq.Request(self.url, headers={"Range": f"bytes={a}-{b}", "User-Agent": "ShadowAstra-Atlas"})
            for attempt in range(5):
                try:
                    raw = _urlreq.urlopen(req, timeout=90).read()
                    break
                except Exception:  # noqa: BLE001
                    if attempt == 4:
                        raise
            key.write_bytes(raw)
        return np.frombuffer(raw, "<i2").astype(np.float32) * self.scale

    def sample(self, lat: np.ndarray, lon: np.ndarray, target_km: float) -> np.ndarray:
        px_deg = self.width / 360.0
        X = (lon + 180) * px_deg - 0.5
        Y = (90 - lat) * px_deg - 0.5
        r0, r1 = int(np.floor(Y.min())) - 8, int(np.ceil(Y.max())) + 9
        r0, r1 = max(r0, 0), min(r1, self.height)
        span = X.max() - X.min()
        full = span > self.width * 0.5  # footprint wraps the pole: read whole rows
        c0, c1 = (0, self.width) if full else (max(int(np.floor(X.min())) - 8, 0), min(int(np.ceil(X.max())) + 9, self.width))
        with ThreadPoolExecutor(16) as pool:
            rows = list(pool.map(lambda r: self._row(r, c0, c1), range(r0, r1)))
        win = np.stack(rows)
        res_km = 2 * np.pi * RADIUS_KM[self.body] / self.width
        sigma = max(0.0, (target_km / res_km) / 2.4)
        if sigma > 0.3:
            win = gaussian_filter(win, sigma=sigma, mode="nearest")
        xx, yy = X - c0, Y - r0
        x0, y0 = np.floor(xx).astype(int), np.floor(yy).astype(int)
        fx, fy = xx - x0, yy - y0
        w = win.shape[1]

        def at(x, y):
            x = np.mod(x, w) if full else np.clip(x, 0, w - 1)
            return win[np.clip(y, 0, win.shape[0] - 1), x]

        return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy


MOLA_FULL = GeoTiffRows(
    "mars", "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif",
    46080, 23040, 184973, 1.0,
)
LOLA_FULL = GeoTiffRows(
    "moon", "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif",
    92160, 46080, 738233, 0.5,
)
