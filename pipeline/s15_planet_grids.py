"""Step 15 · Moon and Mars ground everywhere, for the twin finder.

Kaggle K1 measured every 0.5° cell of the Moon (LRO LOLA 118 m) and Mars (MGS MOLA 463 m)
with exactly the Earth method: 50 km square, slope histogram, height range. This writes them
in 5° latitude bands so the website downloads only the band you click (about 80 KB):

  public/data/terrain/{moon,mars}/b00.bin … b35.bin   rows 10 × cols 720, row 0 = north
      hist  uint8[7200 × 8]   slope histogram × 254 (bins 0,1,2,4,6,10,15,25,90°)
      relief uint16[7200]     2nd to 98th percentile height range, metres
      slope uint8[7200]       mean slope × 8 (degrees)
  public/data/terrain/manifest.json

    python pipeline/s15_planet_grids.py      (after downloading K1 with kaggle/run.py fetch k1_worlds)
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "kaggle" / "_out" / "k1_worlds"
OUT = ROOT / "public" / "data" / "terrain"
ROWS = 10


def main() -> None:
    manifest = {"res": 0.5, "rows_per_band": ROWS, "cols": 720, "bands": 36, "fields": ["hist:uint8:8:254", "relief:uint16:1:1", "slope:uint8:1:8"],
                "source": {"moon": "LRO LOLA LDEM 118 m (USGS Astrogeology), measured on Kaggle (K1)", "mars": "MGS MOLA DEM 463 m (USGS Astrogeology), measured on Kaggle (K1)"}}
    for body in ("moon", "mars"):
        z = np.load(SRC / f"{body}_grid_terrain.npz")
        hist = np.clip(np.round(np.nan_to_num(z["hist"]) * 254), 0, 254).astype(np.uint8)
        relief = np.clip(np.round(np.nan_to_num(z["relief"])), 0, 65534).astype("<u2")
        slope = np.clip(np.round(np.nan_to_num(z["mean_slope"]) * 8), 0, 254).astype(np.uint8)
        d = OUT / body
        d.mkdir(parents=True, exist_ok=True)
        for b in range(36):
            r = slice(b * ROWS, (b + 1) * ROWS)
            blob = hist[r].reshape(-1, 8).tobytes() + relief[r].reshape(-1).tobytes() + slope[r].reshape(-1).tobytes()
            (d / f"b{b:02d}.bin").write_bytes(blob)
        print(body, "bands written,", f"relief median {np.median(relief):.0f} m")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
