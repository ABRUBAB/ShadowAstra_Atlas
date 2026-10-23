"""Step 12 · Mars human landing Exploration Zones (EZs) from the USGS CTX EZ mosaics.

NASA's 2015 First Landing Site / Exploration Zone workshop proposed ~47 zones. USGS
published CTX image mosaics for each; their GeoTIFF headers give each zone's extent.
We read only the header bytes (HTTP range) and keep the centre and size.

    python pipeline/s12_mars_ez.py
"""

from __future__ import annotations

import io
import json
import re
import struct
import urllib.request

from common import CACHE, fetch

BASE = "https://asc-pds-services.s3.us-west-2.amazonaws.com/"
LIST = BASE + "?list-type=2&prefix=mosaic/Mars/CTX_EZs/&max-keys=1000"


def ranged(url: str, a: int, b: int) -> bytes:
    req = urllib.request.Request(url, headers={"Range": f"bytes={a}-{b}", "User-Agent": "ShadowAstra-Atlas"})
    return urllib.request.urlopen(req, timeout=60).read()


def geotiff_extent(url: str):
    head = ranged(url, 0, 16)
    bo = "<" if head[:2] == b"II" else ">"
    magic = struct.unpack(bo + "H", head[2:4])[0]
    if magic == 43:  # BigTIFF
        ifd = struct.unpack(bo + "Q", head[8:16])[0]
        blob = ranged(url, ifd, ifd + 65535)
        n = struct.unpack(bo + "Q", blob[:8])[0]
        entries, esize, off0, cnt_fmt, val_fmt, vlen = blob[8:], 20, ifd, "Q", "Q", 8
    else:
        ifd = struct.unpack(bo + "I", head[4:8])[0]
        blob = ranged(url, ifd, ifd + 65535)
        n = struct.unpack(bo + "H", blob[:2])[0]
        entries, esize, off0, cnt_fmt, val_fmt, vlen = blob[2:], 12, ifd, "I", "I", 4
    tags = {}
    sizes = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8}
    for i in range(n):
        e = entries[i * esize : (i + 1) * esize]
        tag, typ = struct.unpack(bo + "HH", e[:4])
        cnt = struct.unpack(bo + cnt_fmt, e[4 : 4 + vlen])[0]
        raw = e[4 + vlen :]
        nbytes = sizes.get(typ, 1) * cnt
        if nbytes <= vlen:
            data = raw[:nbytes]
        else:
            off = struct.unpack(bo + val_fmt, raw[:vlen])[0]
            data = ranged(url, off, off + nbytes - 1)
        if typ == 3:
            val = struct.unpack(bo + "H" * cnt, data)
        elif typ == 4:
            val = struct.unpack(bo + "I" * cnt, data)
        elif typ == 16:
            val = struct.unpack(bo + "Q" * cnt, data)
        elif typ == 12:
            val = struct.unpack(bo + "d" * cnt, data)
        else:
            val = data
        tags[tag] = val
    w, h = tags[256][0], tags[257][0]
    sx, sy = tags[33550][0], tags[33550][1]
    tie = tags[33922]
    x0, y0 = tie[3], tie[4]
    return {"west": x0, "north": y0, "east": x0 + w * sx, "south": y0 - h * sy, "px_deg": sx, "w": w, "h": h}


def main() -> None:
    xml = fetch(LIST, cache=False).decode("utf-8")
    keys = re.findall(r"<Key>(mosaic/Mars/CTX_EZs/[^<]+_dd\.tif)</Key>", xml)
    out = []
    for k in keys:
        name = k.split("/")[-1].replace("_CTX_BlockAdj_dd.tif", "")
        try:
            e = geotiff_extent(BASE + k)
        except Exception as exc:  # noqa: BLE001
            print("  skip", name, exc)
            continue
        lat = (e["north"] + e["south"]) / 2
        lon = (e["west"] + e["east"]) / 2
        if lon > 180:
            lon -= 360
        out.append({"id": name.lower(), "name": name.replace("_", " "), "lat": round(lat, 3), "lon": round(lon, 3), **{k2: round(v, 4) for k2, v in e.items() if k2 in ("west", "east", "south", "north")}})
        print(f"  {name:28s} {lat:7.2f} {lon:8.2f}  {e['east'] - e['west']:.2f}° × {e['north'] - e['south']:.2f}°", flush=True)
    (CACHE / "mars_ez.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"{len(out)} exploration zones")
    _ = io


if __name__ == "__main__":
    main()
