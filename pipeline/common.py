"""Shared helpers for the ShadowAstra discovery pipeline.

Grid: a global 0.5 degree grid, 360 rows (north to south) x 720 columns (west to east).
Row i covers latitudes 90 - 0.5*i  ..  90 - 0.5*(i+1); column j covers longitudes
-180 + 0.5*j .. -180 + 0.5*(j+1).

Everything downloaded is cached under pipeline/.cache so reruns are cheap and offline.
"""

from __future__ import annotations

import hashlib
import io
import json
import re
import time
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path(__file__).resolve().parent / ".cache"
CACHE.mkdir(exist_ok=True)
OUT = ROOT / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)

RES = 0.5
NROW, NCOL = int(180 / RES), int(360 / RES)
LAT = 90 - (np.arange(NROW) + 0.5) * RES  # cell-centre latitudes, north first
LON = -180 + (np.arange(NCOL) + 0.5) * RES

UA = {"User-Agent": "ShadowAstra-Atlas/0.4 (NASA Space Apps 2026; github.com/ABRUBAB/ShadowAstra_Atlas)"}


def fetch(url: str, cache: bool = True, tries: int = 5, timeout: int = 120) -> bytes:
    """GET with retries and an on-disk cache keyed by URL."""
    key = CACHE / ("http_" + hashlib.sha1(url.encode()).hexdigest())
    if cache and key.exists():
        return key.read_bytes()
    last: Exception | None = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                data = r.read()
            if cache:
                key.write_bytes(data)
            return data
        except Exception as exc:  # noqa: BLE001 - network hiccups are retried
            last = exc
            busy = getattr(exc, "code", None) in (429, 503)  # rate limited: back off properly
            time.sleep((15 if busy else 1.5) * (attempt + 1))
    raise RuntimeError(f"failed after {tries} tries: {url}") from last


def fetch_json(url: str, **kw):
    return json.loads(fetch(url, **kw).decode("utf-8"))


# --------------------------------------------------------------------- GIBS


def gibs_colormap(layer_cmap_url: str) -> dict[int, float]:
    """Packed RGB -> data value (interval midpoint) from a GIBS v1.3 colormap."""
    xml = fetch(layer_cmap_url).decode("utf-8")
    table: dict[int, float] = {}
    for m in re.finditer(r"<ColorMapEntry ([^>]*)/>", xml):
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        if attrs.get("nodata") == "true" or attrs.get("transparent") == "true":
            continue
        r, g, b = (int(v) for v in attrs["rgb"].split(","))
        raw = attrs.get("value") or attrs.get("sourceValue")
        nums = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", raw)]
        if "[" not in raw:  # categorical list such as "0,17" (both mean water)
            val = nums[-1]
        else:  # interval "[a,b)": use its midpoint
            val = nums[0] if len(nums) == 1 else (nums[0] + nums[1]) / 2
        table[(r << 16) | (g << 8) | b] = val
    return table


def gibs_wms(layer: str, time_: str | None, width: int = 3600, height: int = 1800) -> Image.Image:
    url = (
        "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0"
        f"&LAYERS={layer}&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH={width}&HEIGHT={height}"
        "&FORMAT=image/png&TRANSPARENT=TRUE" + (f"&TIME={time_}" if time_ else "")
    )
    return Image.open(io.BytesIO(fetch(url, timeout=300))).convert("RGBA")


def decode(img: Image.Image, table: dict[int, float]) -> np.ndarray:
    """Map an RGBA GIBS image to values with its colormap; unknown/transparent -> NaN."""
    a = np.asarray(img, dtype=np.uint32)
    packed = (a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2]
    keys = np.fromiter(table.keys(), dtype=np.uint32)
    vals = np.fromiter(table.values(), dtype=np.float32)
    order = np.argsort(keys)
    keys, vals = keys[order], vals[order]
    idx = np.clip(np.searchsorted(keys, packed), 0, len(keys) - 1)
    hit = (keys[idx] == packed) & (a[..., 3] > 0)
    out = np.where(hit, vals[idx], np.nan).astype(np.float32)
    return out


def block(a: np.ndarray, f: int, how: str = "mean") -> np.ndarray:
    """Aggregate a fine grid to the 0.5 degree grid by f x f blocks, ignoring NaN."""
    h, w = a.shape
    b = a[: h - h % f, : w - w % f].reshape(h // f, f, w // f, f)
    with np.errstate(all="ignore"):
        if how == "mean":
            return np.nanmean(b, axis=(1, 3))
        if how == "max":
            return np.nanmax(b, axis=(1, 3))
        if how == "min":
            return np.nanmin(b, axis=(1, 3))
    raise ValueError(how)


def save(name: str, arr: np.ndarray) -> None:
    np.save(CACHE / f"{name}.npy", arr.astype(np.float32))


def load(name: str) -> np.ndarray:
    return np.load(CACHE / f"{name}.npy")
