"""Caves and pits for the Maps page: every Mars cave candidate and every lunar pit, as small JSON.

Sources (downloaded by s13 into .cache):
  - Mars Global Cave Candidate Catalog, MGC3 (Cushing 2015, USGS / PDS):    dl_caves/data/Mars_Cave_Catalog.csv
  - LROC lunar pit locations (Wagner and Robinson, Arizona State University): dl_pits/LUNAR_PIT_LOCATIONS_360.DBF

Writes public/data/caves.json: {"mars": [[lat, lon, type, priority, diameter_m, depth_m], ...],
                                "moon": [[lat, lon, name, terrain, diameter_m, depth_m, overhang], ...]}
Run: python pipeline/s25_caves.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

from s13_planet_context import read_dbf

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / ".cache"
OUT = ROOT.parent / "public" / "data" / "caves.json"

# MGC3 type codes and targeting priority, from the archive description (document/*.pdf, sections C-4 and C-5)
MARS_TYPES = {
    "sky": "Skylight into a lava tube", "APC": "Atypical pit crater", "srp": "Small rimless collapse pit",
    "pit": "Collapse pit", "crk": "Deep crack or fracture", "pin": "Pinhole", "flr": "On a channel or trough floor",
    "rim": "On the rim of a pit or trough", "lat": "Side entrance in a cliff", "end": "At the end of a channel or trough",
    "irr": "Irregular opening", "pol": "In polar ice", "kst": "In karst-like ground",
}
MARS_PRIORITY = {1: "Best candidate: void or overhang seen, or an APC", 2: "Looks like an entrance, probably not a cave",
                 3: "Ambiguous, most are not caves", 0: "Not rated"}


def num(s: str) -> float | None:
    try:
        return round(float(s), 1)
    except (TypeError, ValueError):
        return None


def wrap(lon: float) -> float:
    return round((lon + 180) % 360 - 180, 4)


def mars() -> list:
    rows = list(csv.reader(open(CACHE / "dl_caves" / "data" / "Mars_Cave_Catalog.csv", encoding="latin-1")))
    out = []
    for r in rows[1:]:
        _label, lon, lat, code, pri, dia, depth = r[:7]  # the data rows put the label first, unlike the header
        out.append([round(float(lat), 4), wrap(float(lon)), code.strip(), int(float(pri)) if pri.strip().replace(".", "").isdigit() else None, num(dia), num(depth)])
    return out


def moon() -> list:
    out = []
    for r in read_dbf(CACHE / "dl_pits" / "LUNAR_PIT_LOCATIONS_360.DBF"):
        out.append([round(float(r["Latitude"]), 4), wrap(float(r["Longitude"])), r["Name"], r["Terrain"], num(r["InMaxDiam"]), num(r["Depth_Num"]), r["Overhang"] == "Y"])
    return out


def main() -> None:
    data = {"mars": mars(), "moon": moon(), "types": MARS_TYPES, "priority": MARS_PRIORITY,
            "sources": {"mars": "Mars Global Cave Candidate Catalog (MGC3), Cushing 2015, USGS",
                        "moon": "LROC lunar pit locations, Wagner and Robinson, Arizona State University"}}
    OUT.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    codes = sorted({c[2] for c in data["mars"]})
    print(f"{len(data['mars'])} Mars cave candidates ({', '.join(codes)}), {len(data['moon'])} lunar pits -> {OUT} ({OUT.stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
