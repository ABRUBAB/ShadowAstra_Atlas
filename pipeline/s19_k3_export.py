"""Step 19 · Ship the Kaggle K3 terrain transformer (DINO ViT-S/8, self-supervised on all three worlds).

K3 learned what ground looks like from elevation patches of Earth, the Moon and Mars, with a
domain-adversarial head so the three worlds share one embedding. It replaces the first CPU
encoder (steps 7 to 9), which lost to the formula. This step re-runs the same honest tests
locally, for the transformer alone and for the 50/50 blend the website offers, then writes:

  public/data/shape.bin    18 targets × 80,206 cells, uint8 similarity rank (0 to 254)
  public/data/shape.json   target order, cell count and the test results
  public/data/terrain/{moon,mars}/t00.bin … t17.bin
                           "AI twins": the 5 closest Earth places for every 1° Moon or Mars cell,
                           10° bands (10 rows × 360 cols × 5 × uint32 grid cell index)

Lower "top %" is better: 10% means only a tenth of all land is ranked above the site.

    python kaggle/run.py fetch k3_ssl --account 1 --only "*.json,shape_ssl.npz,*_twins.npz"
    python pipeline/s19_k3_export.py
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np

from catalogue import KNOWN_ANALOGS, VALIDATION_SITES

ROOT = Path(__file__).resolve().parent.parent
K3 = ROOT / "kaggle" / "_out" / "k3_ssl"
DATA = ROOT / "public" / "data"


def main() -> None:
    meta = json.loads((DATA / "grid.json").read_text(encoding="utf-8"))
    buf = (DATA / "grid.bin").read_bytes()
    m = meta["count"]
    lay = {f["name"]: f for f in meta["layout"]}
    arr = lambda name: np.frombuffer(buf, dtype=np.dtype(lay[name]["dtype"]), count=m, offset=lay[name]["offset"]).astype(np.float32)  # noqa: E731
    mask = np.unpackbits(np.frombuffer(buf, np.uint8, count=meta["mask_bytes"]))[: meta["rows"] * meta["cols"]].astype(bool)
    p = np.nonzero(mask)[0][:m]
    lat = 90 - (p // meta["cols"] + 0.5) * meta["res"]
    lon = -180 + (p % meta["cols"] + 0.5) * meta["res"]
    H = np.stack([arr(f"h{b}") / 254 for b in range(8)], 1)
    relief = np.where(arr("f_relief") == 65535, 1, np.maximum(arr("f_relief"), 1))
    tmeta = {t["id"]: t for t in meta["targets"]}

    z = np.load(K3 / "shape_ssl.npz")
    ids = [str(x) for x in z["ids"]]
    ssl = {t: z["maps"][i].astype(np.float32) / 254 for i, t in enumerate(ids)}

    def formula(tid):
        t = tmeta[tid]
        ov = np.minimum(H, np.array(t["terrain"]["hist"], np.float32)[None]).sum(1)
        rel = np.clip(1 - np.abs(np.log10(relief / max(t["terrain"]["relief"], 1))), 0, 1)
        return 0.65 * ov + 0.35 * rel

    F = {t: formula(t) for t in ids}
    variants = {"formula": F, "learned": ssl, "both": {t: 0.5 * F[t] + 0.5 * ssl[t] for t in ids}}

    def top_pct(s, k):
        return float(100 * (s > s[k]).mean())

    def cell_of(la, lo):
        return int(np.argmin((lat - la) ** 2 + ((lon - lo + 180) % 360 - 180) ** 2))

    world_t = {w: [t for t in ids if tmeta[t]["body"] == w] for w in ("moon", "mars")}
    best = {v: {w: np.max(np.stack([variants[v][t] for t in world_t[w]]), 0) for w in world_t} for v in variants}

    def site_rows(sites):
        rows = []
        for sid, la, lo, worlds in sites:
            k = cell_of(la, lo)
            for w in worlds:
                rows.append({"id": sid, "world": w, **{v: round(top_pct(best[v][w], k), 1) for v in variants}})
        return rows

    known = site_rows([(a[0], a[2], a[3], a[4].split(",")) for a in KNOWN_ANALOGS])
    indep = site_rows([(a[0], a[2], a[3], [a[4]]) for a in VALIDATION_SITES])
    src = (ROOT / "src" / "data" / "sites.ts").read_text(encoding="utf-8")
    pat = re.compile(r'id: "([^"]+)",\s*name: "[^"]+",\s*country: "[^"]*",\s*lat: (-?[\d.]+),\s*lon: (-?[\d.]+),.*?pairs: \[([^\]]*)\]', re.S)
    pairs = []
    for mm in pat.finditer(src):
        k = cell_of(float(mm.group(2)), float(mm.group(3)))
        for t in re.findall(r'"([^"]+)"', mm.group(4)):
            if t in ssl:
                pairs.append({"earth": mm.group(1), "target": t, **{v: round(top_pct(variants[v][t], k), 1) for v in variants}})

    def summ(rows):
        return {"n": len(rows), **{v: round(float(np.median([r[v] for r in rows])), 1) for v in variants},
                **{f"{v}_top20": round(100 * float(np.mean([r[v] <= 20 for r in rows])), 1) for v in variants}}

    ev = json.loads((K3 / "k3_eval.json").read_text(encoding="utf-8"))
    tr = json.loads((K3 / "k3_train.json").read_text(encoding="utf-8"))
    log = json.loads((K3 / "k3_log.json").read_text(encoding="utf-8"))
    out = {
        "model": "DINO self-supervised ViT-S/8 on Earth, Moon and Mars elevation patches, domain-adversarial (Kaggle K3, 2 × T4)",
        "minutes": round(log["minutes"]), "steps": tr["steps"],
        "same_world_neighbours": ev["same_world_neighbours"], "chance_same_world": ev["chance_same_world"],
        "known": summ(known), "independent": summ(indep), "pairs": summ(pairs),
        "rows": {"known": known, "independent": indep, "pairs": pairs},
    }
    for name in ("known", "independent", "pairs"):
        print(f"{name:12s}", out[name])

    # the website: similarity ranks in the grid's target order
    order = [t["id"] for t in meta["targets"]]
    rows = np.stack([z["maps"][ids.index(t)] for t in order]).astype(np.uint8)
    (DATA / "shape.bin").write_bytes(rows.tobytes())
    ev_site = {"pairs": out["pairs"]["n"], "learned_median_top_pct": out["pairs"]["learned"], "formula_median_top_pct": out["pairs"]["formula"],
               "both_median_top_pct": out["pairs"]["both"], "learned_top20_pct": out["pairs"]["learned_top20"], "formula_top20_pct": out["pairs"]["formula_top20"],
               "known": out["known"], "independent": out["independent"], "model": out["model"], "minutes": out["minutes"]}
    (DATA / "shape.json").write_text(json.dumps({"targets": order, "count": m, "eval": ev_site}, separators=(",", ":")), encoding="utf-8")
    print(f"shape.bin {rows.nbytes / 1e6:.2f} MB")

    # AI twins in 10° bands
    for body in ("moon", "mars"):
        t = np.load(K3 / f"{body}_twins.npz")
        ll, cell = t["ll"], t["cell"].astype("<u4")
        r = np.rint((89.5 - ll[:, 0])).astype(int)
        c = np.rint(ll[:, 1] + 179.5).astype(int)
        assert r.min() == 0 and r.max() == 179 and c.min() == 0 and c.max() == 359
        grid = np.zeros((180, 360, 5), "<u4")
        grid[r, c] = cell
        d = DATA / "terrain" / body
        for b in range(18):
            (d / f"t{b:02d}.bin").write_bytes(grid[b * 10 : (b + 1) * 10].tobytes())
        print(body, "AI twin bands written")
    man = json.loads((DATA / "terrain" / "manifest.json").read_text(encoding="utf-8"))
    man["ai_twins"] = {"res": 1.0, "rows_per_band": 10, "cols": 360, "bands": 18, "per_cell": 5, "dtype": "uint32 grid cell index",
                       "source": out["model"]}
    (DATA / "terrain" / "manifest.json").write_text(json.dumps(man, indent=1), encoding="utf-8")

    # for validation.json (s14 copies it)
    (ROOT / "pipeline" / ".cache" / "k3_test.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
