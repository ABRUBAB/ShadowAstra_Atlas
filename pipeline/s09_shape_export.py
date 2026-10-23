"""Step 9 · Export the terrain-encoder similarity for the website.

public/data/shape.bin   18 targets × 80,206 cells, uint8 percentile rank (0 to 254)
public/data/shape.json  target order, cell count and the honest pair test from step 8

The website loads these only when someone picks "Neural net" or "Both" for ground shape.

    python pipeline/s09_shape_export.py        (needs step 8)
"""

from __future__ import annotations

import json

import numpy as np

from common import CACHE, OUT


def main() -> None:
    rank = np.load(CACHE / "shape_rank.npy")
    ev = json.loads((CACHE / "shape_eval.json").read_text(encoding="utf-8"))
    grid = json.loads((OUT / "grid.json").read_text(encoding="utf-8"))
    assert rank.shape[1] == grid["count"], "cell order must match grid.json"
    order = [t["id"] for t in grid["targets"]]
    rows = np.stack([rank[ev["target_ids"].index(t)] for t in order])
    (OUT / "shape.bin").write_bytes(rows.astype(np.uint8).tobytes())
    keep = {k: ev[k] for k in ("pairs", "learned_median_top_pct", "formula_median_top_pct", "both_median_top_pct", "learned_top20_pct", "formula_top20_pct", "epochs")}
    (OUT / "shape.json").write_text(json.dumps({"targets": order, "count": grid["count"], "eval": keep}, separators=(",", ":")), encoding="utf-8")
    print(f"shape.bin {rows.nbytes / 1e6:.2f} MB", keep)


if __name__ == "__main__":
    main()
