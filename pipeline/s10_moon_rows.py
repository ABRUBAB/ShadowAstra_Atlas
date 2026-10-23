"""Step 10 · Download every 10th row of the full-precision LRO LOLA global DEM.

LOLA 118 m has 46,080 rows of 92,160 samples. Every 10th row (1.18 km apart) is all a
50 km footprint at 1.19 km spacing needs, and it keeps the download to ~850 MB instead
of 8.5 GB. Rows are cached one file each (HTTP range requests), so this can be resumed.

    python pipeline/s10_moon_rows.py
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from common import CACHE
from terrain_lib import LOLA_FULL

STEP = 10


def main() -> None:
    rows = list(range(0, LOLA_FULL.height, STEP))
    t0 = time.time()
    done = 0

    def get(r: int) -> int:
        LOLA_FULL._row(r, 0, LOLA_FULL.width)
        return r

    with ThreadPoolExecutor(16) as pool:
        for _ in pool.map(get, rows):
            done += 1
            if done % 200 == 0:
                print(f"  {done}/{len(rows)} rows  {(time.time() - t0) / 60:.1f} min", flush=True)
    # stack into one memory-mapped array for fast access later
    out = np.lib.format.open_memmap(CACHE / "lola_rows10.npy", mode="w+", dtype=np.int16, shape=(len(rows), LOLA_FULL.width))
    for k, r in enumerate(rows):
        out[k] = np.round(LOLA_FULL._row(r, 0, LOLA_FULL.width) / LOLA_FULL.scale).astype(np.int16)
    out.flush()
    print(f"done: {len(rows)} rows in {(time.time() - t0) / 60:.1f} min")


if __name__ == "__main__":
    main()
