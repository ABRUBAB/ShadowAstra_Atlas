"""Step 22 · Expected values for the TypeScript/Python parity test (tests/unit/parity.test.ts).

The website scores in the browser (src/lib/grid.ts); every published test runs the NumPy twin in
s14_validate.py. If the two ever drift apart, the published numbers no longer describe the site.
This writes what Python computes for a fixed sample of places, targets, jobs and options; the
unit test recomputes them in TypeScript from the same data files and compares.

    python pipeline/s22_parity_fixture.py      → tests/fixtures/parity.json
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np

import s14_validate as v
from catalogue import KNOWN_ANALOGS

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "tests" / "fixtures" / "parity.json"
EXTRA = [("jezero", "traverse"), ("shackleton", "base"), ("arsia", "caves"), ("gale", "isru"), ("meridiani", "ice"),
         ("hadley", "landing"), ("cabeus", "polar"), ("mawrth", "impact"), ("utopia", "astrobio")]


def main_jobs() -> dict[str, str]:
    src = (ROOT / "src" / "data" / "sites.ts").read_text(encoding="utf-8")
    block = src[src.index("export const TARGETS") : src.index("export interface EarthSite")]
    return {m[0]: re.findall(r'"([^"]+)"', m[1])[0] for m in re.findall(r'id: "([^"]+)",.*?tasks: \[([^\]]*)\]', block, re.S)}


def main() -> None:
    g = v.Grid()
    rng = np.random.default_rng(2026)
    cells = set(rng.choice(g.n, 260, replace=False).tolist())
    cells |= {g.cell_at(a[2], a[3]) for a in KNOWN_ANALOGS}
    cells |= {0, g.n - 1, int(np.argmin(g.lat)), int(np.argmax(g.lat)), int(np.argmin(g.lon)), int(np.argmax(g.lon))}
    cells |= set(np.nonzero(g.a["f_relief"] == g.f["f_relief"]["nodata"])[0][:5].tolist())  # missing relief
    cells = sorted(int(c) for c in cells)
    jobs = main_jobs()
    combos = [(t["id"], jobs[t["id"]], "formula", None) for t in g.meta["targets"]] + [(t, j, "formula", None) for t, j in EXTRA]
    combos += [("jezero", "astrobio", "both", None), ("shackleton", "polar", "learned", None)]
    combos += [("gale", "traverse", "formula", dict(topography=0.0, geology=1.0, temperature=0.5, lighting=0.0, regolith=2.0))]
    out = []
    for tid, job, shape, weights in combos:
        t = g.targets[tid]
        w = weights or v.TASK_WEIGHTS[job]
        D = v.dims(g, t, job, use_min=v.USE_MINERALS, shape=shape)
        mission = sum(D[d] * w[d] for d in v.DIMS) / (sum(w.values()) or 1)
        total = (1 - v.MIX) * mission + v.MIX * g.model[t["body"]]
        out.append({
            "target": tid, "job": job, "shape": shape, "weights": weights,
            "values": {str(k): [round(float(x), 6) for x in (total[k], mission[k], *(D[d][k] for d in v.DIMS))] for k in cells},
        })
    mpct = {f: {str(k): (None if not np.isfinite(g.mpct[f][k]) else round(float(g.mpct[f][k]), 6)) for k in cells} for f in g.mpct}
    conf = json.loads((ROOT / "public" / "data" / "grid.json").read_text(encoding="utf-8"))["confidence"]
    cover = g.a["q_cover"] / 254.0
    levels = {}
    for w in ("moon", "mars"):
        spread = g.a[f"u_{w}"] / 254.0
        lv = np.where((cover < conf["cover_low"]) | (spread > conf["spread_low"]), "low",
                      np.where((cover < conf["cover_medium"]) | (spread > conf["spread_medium"]), "medium", "high"))
        levels[w] = {str(k): str(lv[k]) for k in cells}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"mix": v.MIX, "use_minerals": v.USE_MINERALS, "dims": v.DIMS, "cells": cells, "combos": out,
                               "mineral_pct": mpct, "confidence": levels}, separators=(",", ":")), encoding="utf-8")
    print(f"{len(combos)} combos x {len(cells)} cells -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
