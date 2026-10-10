"""Build the globe textures used by ShadowAstra Atlas from public NASA services.

Every texture is derived from a NASA product; nothing is painted or AI-generated.

    python scripts/build_textures.py

Outputs go to public/textures/. Sources:
  Earth day   NASA GIBS WMS  BlueMarble_ShadedRelief_Bathymetry  (NASA Blue Marble)
  Earth night NASA GIBS WMS  VIIRS_Black_Marble (2016)            (NASA Black Marble)
  Moon        NASA Trek WMTS LRO_WAC_Mosaic_Global_303ppd_v02      (LRO LROC WAC)
  Mars        NASA Trek WMTS Mars_Viking_MDIM21_ClrMosaic_global_232m (Viking MDIM 2.1)
  Moon S.Pole NASA Trek WMTS LRO_LOLA_Shade_Global_256ppd_v06      (LRO LOLA hillshade),
              reprojected here to polar stereographic, 80°S to the pole.
"""

from __future__ import annotations

import io
import math
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "textures"
OUT.mkdir(parents=True, exist_ok=True)

GIBS_WMS = (
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap"
    "&VERSION=1.3.0&LAYERS={layer}&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180"
    "&WIDTH={w}&HEIGHT={h}&FORMAT={fmt}{time}"
)
TREK = "https://trek.nasa.gov/tiles/{body}/EQ/{layer}/1.0.0/default/default028mm/{z}/{y}/{x}.{ext}"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "ShadowAstra-Atlas/0.1 (NASA Space Apps 2026)"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as exc:  # noqa: BLE001 - retry any network hiccup
            if attempt == 3:
                raise RuntimeError(f"failed: {url}") from exc
    raise AssertionError


def gibs(layer: str, w: int, h: int, fmt: str = "image/jpeg", time: str = "") -> Image.Image:
    url = GIBS_WMS.format(layer=layer, w=w, h=h, fmt=fmt, time=f"&TIME={time}" if time else "")
    return Image.open(io.BytesIO(fetch(url))).convert("RGB")


def trek_global(body: str, layer: str, z: int, ext: str) -> Image.Image:
    """Stitch a full equirectangular mosaic. Trek level z is 2^(z+1) x 2^z tiles of 256 px."""
    cols, rows = 2 ** (z + 1), 2**z
    canvas = Image.new("RGB", (cols * 256, rows * 256))
    jobs = [(x, y) for y in range(rows) for x in range(cols)]

    def get(xy):
        x, y = xy
        tile = Image.open(io.BytesIO(fetch(TREK.format(body=body, layer=layer, z=z, y=y, x=x, ext=ext))))
        return x, y, tile.convert("RGB")

    with ThreadPoolExecutor(12) as pool:
        for x, y, tile in pool.map(get, jobs):
            canvas.paste(tile, (x * 256, y * 256))
    return canvas


def moon_south_pole(z: int = 5, size: int = 1400, edge_lat: float = -80.0) -> Image.Image:
    """Polar stereographic view of the lunar south pole from LOLA hillshade tiles."""
    layer, ext = "LRO_LOLA_Shade_Global_256ppd_v06", "png"
    cols, rows = 2 ** (z + 1), 2**z
    deg_per_row = 180 / rows
    first_row = int((90 - edge_lat) // deg_per_row)  # rows counted from the north
    band_rows = list(range(first_row, rows))
    band = Image.new("L", (cols * 256, len(band_rows) * 256))

    def get(xy):
        x, y = xy
        tile = Image.open(io.BytesIO(fetch(TREK.format(body="Moon", layer=layer, z=z, y=y, x=x, ext=ext))))
        return x, y, tile.convert("L")

    with ThreadPoolExecutor(12) as pool:
        for x, y, tile in pool.map(get, [(x, y) for y in band_rows for x in range(cols)]):
            band.paste(tile, (x * 256, (y - first_row) * 256))

    src = np.asarray(band, dtype=np.float32)
    band_top_lat = 90 - first_row * deg_per_row
    px_per_deg = 256 * rows / 180

    # Output grid: centred on the pole, 0°E pointing up (towards the near side).
    r_edge = math.tan(math.radians((90 + edge_lat) / 2))  # stereographic radius of edge
    u = np.linspace(-1, 1, size, dtype=np.float32)
    xx, yy = np.meshgrid(u, -u)
    rho = np.hypot(xx, yy) * r_edge
    lat = -(90 - 2 * np.degrees(np.arctan(rho)))
    lon = np.degrees(np.arctan2(xx, yy))  # 0°E up, east clockwise when viewed from below
    col = ((lon + 180) % 360) * px_per_deg
    row = (band_top_lat - lat) * px_per_deg
    col = np.clip(col, 0, src.shape[1] - 1).astype(np.int32)
    row = np.clip(row, 0, src.shape[0] - 1).astype(np.int32)
    out = src[row, col]
    mask = np.hypot(xx, yy) <= 1.0
    out = np.where(mask, out, 6)
    return Image.fromarray(out.astype(np.uint8), "L")


def save(img: Image.Image, name: str, quality: int = 82) -> None:
    """Write WebP levels of detail: <stem>_4k/_2k/_1k.webp (the app streams 1K first)."""
    stem = name.rsplit("_4k", 1)[0].rsplit(".", 1)[0]
    if img.size[0] != 2 * img.size[1]:  # non-equirectangular (polar view): single file
        path = OUT / f"{stem}.webp"
        img.save(path, "WEBP", quality=quality, method=6)
        print(f"  {path.name:28s} {img.size[0]}x{img.size[1]}  {path.stat().st_size / 1e6:.2f} MB")
        return
    for tag, w in (("4k", 4096), ("2k", 2048), ("1k", 1024)):
        level = img if img.size[0] == w else img.resize((w, w // 2), Image.LANCZOS)
        path = OUT / f"{stem}_{tag}.webp"
        level.save(path, "WEBP", quality=quality, method=6)
        print(f"  {path.name:28s} {w}x{w // 2}  {path.stat().st_size / 1e6:.2f} MB")


def main() -> None:
    which = set(sys.argv[1:]) or {"earth", "night", "moon", "mars", "pole"}
    if "earth" in which:
        save(gibs("BlueMarble_ShadedRelief_Bathymetry", 4096, 2048), "earth_day_4k.jpg")
    if "night" in which:
        save(gibs("VIIRS_Black_Marble", 4096, 2048, "image/png", "2016-01-01"), "earth_night_4k.jpg", 80)
    if "moon" in which:
        save(trek_global("Moon", "LRO_WAC_Mosaic_Global_303ppd_v02", 3, "jpg"), "moon_lroc_4k.jpg")
    if "mars" in which:
        save(trek_global("Mars", "Mars_Viking_MDIM21_ClrMosaic_global_232m", 3, "jpg"), "mars_viking_4k.jpg")
    if "pole" in which:
        save(moon_south_pole(), "moon_south_pole_lola.jpg", 84)


if __name__ == "__main__":
    main()
