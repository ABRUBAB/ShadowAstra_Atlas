"""Render a regional NASA Blue Marble (shaded relief) thumbnail for every Earth site
and every screening region.

    python scripts/build_thumbs.py

Reads site ids/coordinates from src/data/sites.ts and writes public/thumbs/<id>.webp
using the NASA GIBS WMS layer BlueMarble_ShadedRelief (500 m).
"""

from __future__ import annotations

import io
import math
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "thumbs"
OUT.mkdir(parents=True, exist_ok=True)

WMS = (
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap"
    "&VERSION=1.3.0&LAYERS=BlueMarble_ShadedRelief_Bathymetry&STYLES=&CRS=EPSG:4326"
    "&BBOX={s},{w},{n},{e}&WIDTH={W}&HEIGHT={H}&FORMAT=image/jpeg"
)


def sites() -> list[tuple[str, float, float]]:
    text = (ROOT / "src" / "data" / "sites.ts").read_text(encoding="utf-8")
    text = text[text.index("export const EARTH_SITES") :]  # Earth sites + screening regions
    pat = re.compile(r'id: "([^"]+)",.*?lat: (-?[\d.]+),\s*lon: (-?[\d.]+)', re.S)
    return [(m[0], float(m[1]), float(m[2])) for m in pat.findall(text)]


def thumb(site: tuple[str, float, float]) -> str:
    sid, lat, lon = site
    half_h = 1.6  # degrees of latitude either side
    half_w = min(half_h / max(math.cos(math.radians(lat)), 0.2) * 1.4, 12)
    s, n = max(lat - half_h, -90), min(lat + half_h, 90)
    w, e = lon - half_w, lon + half_w
    url = WMS.format(s=s, w=w, n=n, e=e, W=720, H=480)
    req = urllib.request.Request(url, headers={"User-Agent": "ShadowAstra-Atlas/0.1"})
    img = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=90).read())).convert("RGB")
    img = ImageEnhance.Contrast(img).enhance(1.12)
    img.save(OUT / f"{sid}.webp", "WEBP", quality=80, method=6)
    return sid


if __name__ == "__main__":
    with ThreadPoolExecutor(6) as pool:
        for sid in pool.map(thumb, sites()):
            print("  ", sid)
