"""Step 18 · Do EMIT minerals make the learned model better? Tested, not assumed.

The same two tests as everywhere else, run twice (the K5 ensemble without and with the four
EMIT mineral families as extra inputs), with identical random draws so the comparison is paired:

  hidden known sites   hide each known site and every known site within 300 km, retrain,
                       and ask where the hidden one ranks among all land (50 site-world pairs)
  independent sites    the 28 published sites never used for training, each scored by a model
                       retrained without known sites within 300 km of it

Writes pipeline/.cache/minerals_test.json; s14_validate.py copies it into validation.json.
The shipped model uses minerals only if they win on the hidden known sites (the independent
sites are reported, never used to choose).

    python pipeline/s18_minerals_test.py      (after s17_emit.py)
"""

from __future__ import annotations

import json
import time
import zlib
from types import SimpleNamespace

import numpy as np

import s06_build as s06
from catalogue import KNOWN_ANALOGS, VALIDATION_SITES
from common import CACHE, LAT, LON

T0 = time.time()


def variants():
    F = s06.features()
    assert F.minerals and s06.MINERALS_IN_MODEL, "run s17_emit.py first, and run this with SA_MINERALS=1"
    k = len(s06.MINERAL_GROUPS)
    X0 = F.X[:, :-k]
    Xl0 = np.nan_to_num(X0)
    Xl0 = ((Xl0 - Xl0.mean(0)) / (Xl0.std(0) + 1e-6)).astype(np.float32)
    F0 = SimpleNamespace(**{**vars(F), "X": X0, "Xl": Xl0, "feat_names": F.feat_names[:-k]})
    return F, {"without": F0, "with": F}


def decide(res):
    """Minerals join the model only if they help on the hidden known sites in every way we look:
    a better median, no fewer sites in the top 10%, and no worse at the sites EMIT actually sees."""
    h, e = res["hidden"]["all"], res["hidden"]["emit_seen"]
    better = h["with"]["median"] < h["without"]["median"] and h["with"]["top10"] >= h["without"]["top10"] and e["with"]["median"] <= e["without"]["median"]
    return "with" if better else "without"


def rank_of(s, k, exclude):
    m = np.ones(len(s), bool)
    m[exclude] = False
    return float(100 * (s[m] > s[k]).mean())


def main():
    F, V = variants()
    I, J = F.I, F.J
    lat, lon = LAT[I], LON[J]
    worlds_of = {a[0]: a[4] for a in KNOWN_ANALOGS}
    covered = np.isfinite(F.minerals["clay"])
    rows = {"hidden": [], "independent": []}

    for world in ("moon", "mars"):
        pos = [(sid, k) for sid, k in F.cell_of.items() if world in worlds_of[sid]]
        for sid, k in pos:
            train = [kk for (_s, kk) in pos if s06.hav(lat[k], lon[k], lat[kk], lon[kk]) >= 300]
            r = {"id": sid, "world": world, "emit": bool(covered[k])}
            for name, Fv in V.items():
                p, _, _ = s06.train_predict(Fv, train, rng=np.random.default_rng(zlib.crc32(sid.encode()) % 1000))
                r[name] = round(rank_of(p, k, train), 2)
            rows["hidden"].append(r)
            print(f"[{(time.time() - T0) / 60:5.1f} min] hidden {world} {sid:16s} without {r['without']:6.2f}%  with {r['with']:6.2f}%  emit={r['emit']}", flush=True)

    for sid, _name, la, lo, world, _jobs, _src in VALIDATION_SITES:
        k = s06.snap(I, J, la, lo, max_d2=32)
        train = [kk for s2, kk in F.cell_of.items() if world in worlds_of[s2] and s06.hav(la, lo, lat[kk], lon[kk]) >= 300]
        r = {"id": sid, "world": world, "emit": bool(covered[k])}
        for name, Fv in V.items():
            p, _, _ = s06.train_predict(Fv, train, rng=np.random.default_rng(11))
            r[name] = round(rank_of(p, k, train), 2)
        rows["independent"].append(r)
        print(f"[{(time.time() - T0) / 60:5.1f} min] indep  {world} {sid:16s} without {r['without']:6.2f}%  with {r['with']:6.2f}%  emit={r['emit']}", flush=True)

    def summ(rs):
        out = {"n": len(rs)}
        for name in ("without", "with"):
            v = np.array([r[name] for r in rs])
            out[name] = {"median": round(float(np.median(v)), 2), "top10": round(100 * float(np.mean(v <= 10)), 1)} if len(v) else None
        if rs:
            d = np.array([r["without"] - r["with"] for r in rs])
            out["with_better"] = int((d > 0).sum())
            out["with_worse"] = int((d < 0).sum())
        return out

    res = {"generated": time.strftime("%Y-%m-%d"), "minutes": round((time.time() - T0) / 60, 1), "rows": rows}
    for test in ("hidden", "independent"):
        res[test] = {"all": summ(rows[test]), "emit_seen": summ([r for r in rows[test] if r["emit"]]),
                     "mars": summ([r for r in rows[test] if r["world"] == "mars"])}
    res["decision"] = decide(res)
    (CACHE / "minerals_test.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    print(json.dumps({t: res[t] for t in ("hidden", "independent", "decision")}, indent=1))


if __name__ == "__main__":
    import sys

    if "--decide" in sys.argv:  # re-apply the rule to saved results
        path = CACHE / "minerals_test.json"
        saved = json.loads(path.read_text(encoding="utf-8"))
        saved["decision"] = decide(saved)
        path.write_text(json.dumps(saved, indent=1), encoding="utf-8")
        print("decision:", saved["decision"])
    else:
        main()
