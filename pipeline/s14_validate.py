"""Step 14 · Test the finished scores the way a reviewer would.

Everything is computed from public/data/grid.bin and grid.json, the same numbers the
website uses, with a NumPy twin of scoreAll() in src/lib/grid.ts.

  1. Independent sites: 28 published analog sites (catalogue.VALIDATION_SITES) that are
     never used for training. Where does each rank among all 80,206 land areas?
     The learned model is retrained without any known site within 300 km of each one.
  2. Known sites: the 38 training sites, for the hand-made formula (never fitted to them).
  3. Jobs: does choosing the job a site was used for move it up, compared with other jobs?
  4. Robustness: how much do the top places change if the weights or the data are a bit off?
  5. Ablations: what each factor, and the new rock types, add.

Writes public/data/validation.json for the How it works page.

    python pipeline/s14_validate.py      (after s06_build.py)
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np

from catalogue import KNOWN_ANALOGS, KNOWN_JOBS, VALIDATION_SITES

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
RNG = np.random.default_rng(2026)

# Section 6 tests a Mars mineral match inside Rocks & craters. On the known Mars sites it ranked them a little worse
# (5 better, 18 worse), so the site does not score minerals; it shows them as facts.
USE_MINERALS = False
TASKS = ["base", "landing", "traverse", "isru", "ice", "caves", "astrobio", "impact", "polar"]
DIMS = ["topography", "geology", "temperature", "lighting", "regolith"]
TASK_WEIGHTS = {  # src/lib/scoring.ts
    "base": dict(topography=0.25, geology=0.1, temperature=0.25, lighting=0.2, regolith=0.2),
    "traverse": dict(topography=0.45, geology=0.1, temperature=0.1, lighting=0.1, regolith=0.25),
    "isru": dict(topography=0.1, geology=0.35, temperature=0.05, lighting=0.05, regolith=0.45),
    "ice": dict(topography=0.15, geology=0.15, temperature=0.4, lighting=0.2, regolith=0.1),
    "caves": dict(topography=0.35, geology=0.35, temperature=0.1, lighting=0.1, regolith=0.1),
    "astrobio": dict(topography=0.05, geology=0.45, temperature=0.25, lighting=0.05, regolith=0.2),
    "impact": dict(topography=0.4, geology=0.45, temperature=0.05, lighting=0.05, regolith=0.05),
    "polar": dict(topography=0.2, geology=0.05, temperature=0.3, lighting=0.4, regolith=0.05),
    "landing": dict(topography=0.5, geology=0.15, temperature=0.05, lighting=0.1, regolith=0.2),
}


# ------------------------------------------------------------------ the grid, as the browser sees it
class Grid:
    def __init__(self):
        self.meta = json.loads((DATA / "grid.json").read_text(encoding="utf-8"))
        buf = (DATA / "grid.bin").read_bytes()
        m = self.meta
        self.n = m["count"]
        self.a, self.f = {}, {}
        for fl in m["layout"]:
            self.a[fl["name"]] = np.frombuffer(buf, dtype=np.dtype(fl["dtype"]), count=self.n, offset=fl["offset"])
            self.f[fl["name"]] = fl
        mask = np.unpackbits(np.frombuffer(buf, np.uint8, count=m["mask_bytes"]))[: m["rows"] * m["cols"]].astype(bool)
        p = np.nonzero(mask)[0][: self.n]
        self.row, self.col = p // m["cols"], p % m["cols"]
        self.lat = 90 - (self.row + 0.5) * m["res"]
        self.lon = -180 + (self.col + 0.5) * m["res"]
        self.targets = {t["id"]: t for t in m["targets"]}
        self.index = np.full(m["rows"] * m["cols"], -1, np.int64)
        self.index[p] = np.arange(self.n)
        K = 1 / 254
        self.I = {k[2:]: self.a[k].astype(np.float32) * K for k in self.a if k.startswith("i_")}
        self.H = np.stack([self.a[f"h{b}"].astype(np.float32) * K for b in range(8)], 1)
        rel = self.a["f_relief"].astype(np.float32)
        self.relief = np.where(self.a["f_relief"] == self.f["f_relief"]["nodata"], 1.0, np.maximum(rel, 1))
        self.model = {w: self.a[f"model_{w}"].astype(np.float32) / self.f[f"model_{w}"]["scale"] for w in ("moon", "mars")}
        self.lith = self.a["f_lith"].astype(np.int64) if "f_lith" in self.a else None
        # EMIT minerals: percentile among the places EMIT saw (0 to 1), NaN where it saw nothing
        self.mpct = {}
        for fam in ("clay", "sulfate", "carbonate", "iron"):
            key = f"f_min_{fam}"
            if key in self.a:
                v = self.a[key]
                ok = v != self.f[key]["nodata"]
                pct = np.full(self.n, np.nan, np.float32)
                # equal shares (many places have exactly no gypsum) share their average rank
                from scipy.stats import rankdata

                pct[ok] = (rankdata(v[ok], method="average") - 1) / max(1, ok.sum() - 1)
                self.mpct[fam] = pct
        self.emit_seen = np.isfinite(self.mpct["clay"]) if self.mpct else np.zeros(self.n, bool)
        # terrain AI (K3) ground-shape similarity rank per target, 0 to 1 (public/data/shape.bin)
        self.shape = {}
        sj = DATA / "shape.json"
        if sj.exists():
            smeta = json.loads(sj.read_text(encoding="utf-8"))
            raw = np.frombuffer((DATA / "shape.bin").read_bytes(), np.uint8).reshape(len(smeta["targets"]), smeta["count"])
            self.shape = {t: raw[i].astype(np.float32) / 254 for i, t in enumerate(smeta["targets"])}

    def cell_at(self, lat, lon, max_ring=4):
        rows, cols, res = self.meta["rows"], self.meta["cols"], self.meta["res"]
        r0 = min(rows - 1, max(0, int((90 - lat) // res)))
        c0 = int(((lon + 180) % 360) // res)
        for ring in range(max_ring + 1):
            best, bd = -1, 1e9
            for dr in range(-ring, ring + 1):
                for dc in range(-ring, ring + 1):
                    if max(abs(dr), abs(dc)) != ring:
                        continue
                    r = r0 + dr
                    if r < 0 or r >= rows:
                        continue
                    k = self.index[r * cols + (c0 + dc) % cols]
                    if k >= 0 and dr * dr + dc * dc < bd:
                        bd, best = dr * dr + dc * dc, int(k)
            if best >= 0:
                return best
        return -1


MIN_UNSEEN = 0.5  # mineral match where EMIT saw nothing: unknown, so neutral
MIN_WEIGHT = {"astrobio": 0.4, "isru": 0.35}  # share of Rocks & craters given to minerals; other jobs 0.2


def mineral_match(g: Grid, t):
    """How strongly a place shows the target's water-made minerals (src/lib/grid.ts mineralMatch)."""
    fams = t.get("minerals", {}).get("families")
    if not fams or not g.mpct:
        return None
    m = np.mean([g.mpct[f] for f in fams], 0)
    return np.where(np.isfinite(m), m, MIN_UNSEEN).astype(np.float32)


def geology(g: Grid, world, task, rock, use_rock=False):
    """src/lib/grid.ts geology(). `use_rock=True` is the tested variant that adds GLiM rock types
    (dominant class per 0.5° cell); it ranked the 38 known sites worse, so the site does not use it."""
    I = g.I
    volc, imp, bare, dry = I["volcanic"], I["impact"], I["bare"], I["dry"]
    hard = np.maximum(volc, imp)
    if not use_rock:
        if task == "caves":
            return 0.85 * volc + 0.15 * bare
        if task == "impact":
            return 0.85 * imp + 0.15 * bare
        if task == "landing":
            return 0.5 * imp + 0.2 * volc + 0.3 * bare
        if task == "astrobio":
            return 0.5 * dry + 0.3 * bare + 0.2 * hard
        if task == "isru":
            return 0.6 * volc + 0.2 * imp + 0.2 * bare if world == "moon" else 0.5 * volc + 0.2 * imp + 0.3 * bare
        return 0.6 * hard + 0.4 * bare if world == "moon" else 0.45 * hard + 0.3 * bare + 0.25 * dry
    if task == "caves":
        return 0.6 * volc + 0.25 * rock + 0.15 * bare
    if task == "impact":
        return 0.7 * imp + 0.15 * rock + 0.15 * bare
    if task == "landing":
        return 0.4 * imp + 0.15 * volc + 0.2 * rock + 0.25 * bare
    if task == "astrobio":
        return 0.35 * rock + 0.3 * dry + 0.2 * bare + 0.15 * hard
    if task == "isru":
        return 0.45 * rock + 0.25 * volc + 0.1 * imp + 0.2 * bare
    return 0.35 * rock + 0.35 * hard + 0.3 * bare if world == "moon" else 0.35 * rock + 0.3 * hard + 0.2 * bare + 0.15 * dry


def temperature(g: Grid, world, task):
    I = g.I
    if task in ("ice", "polar"):
        return 0.6 * I["cold"] + 0.4 * I["ice"]
    if world == "moon":
        return 0.55 * I["cold"] + 0.45 * I["swing"]
    return 0.45 * I["cold"] + 0.3 * I["swing"] + 0.25 * I["airdry"]


def dims(g: Grid, t, task, use_rock=False, use_min=USE_MINERALS, shape="formula"):
    th = np.array(t["terrain"]["hist"], np.float32)
    ov = np.minimum(g.H, th[None, :]).sum(1)
    rel = np.clip(1 - np.abs(np.log10(g.relief / max(t["terrain"]["relief"], 1))), 0, 1)
    topo = 0.65 * ov + 0.35 * rel
    if shape != "formula" and t["id"] in g.shape:
        topo = g.shape[t["id"]] if shape == "learned" else 0.5 * topo + 0.5 * g.shape[t["id"]]
    aff = np.array(t.get("rock", {}).get("aff", [0.5] * 17), np.float32)
    rock = aff[np.clip(g.lith, 0, len(aff) - 1)] if g.lith is not None else np.full(g.n, 0.5, np.float32)
    geo = geology(g, t["body"], task, rock, use_rock)
    mm = mineral_match(g, t) if use_min else None
    if mm is not None:
        mw = MIN_WEIGHT.get(task, 0.2)
        geo = (1 - mw) * geo + mw * mm
    return {
        "topography": topo,
        "geology": geo,
        "temperature": temperature(g, t["body"], task),
        "lighting": np.array(t["light"], np.float32)[g.row] / 100,
        "regolith": 0.6 * g.I["bare"] + 0.4 * g.I["dry"],
    }


MIX = 0.6  # shipped default share of the learned model (chosen on the known sites, see 2b)


def score(g: Grid, t, task, mix=MIX, weights=None, use_rock=False, model=None, D=None, use_min=None, shape="formula"):
    w = weights or TASK_WEIGHTS[task]
    D = D or dims(g, t, task, use_rock, USE_MINERALS if use_min is None else use_min, shape)
    ws = sum(w.values()) or 1
    mission = sum(D[d] * w[d] for d in DIMS) / ws
    mdl = g.model[t["body"]] if model is None else model
    return (1 - mix) * mission + mix * mdl


def world_score(g, world, tasks, **kw):
    """Best score over the world's targets and the given jobs."""
    best = None
    for t in g.meta["targets"]:
        if t["body"] != world:
            continue
        for task in tasks:
            s = score(g, t, task, **kw)
            best = s if best is None else np.maximum(best, s)
    return best


def top_pct(s, k):
    """Share of land that scores higher than cell k, in percent (lower is better)."""
    return float(100 * (s > s[k]).mean())


def boot_median(x, n=2000):
    x = np.asarray(x, float)
    if len(x) == 0:
        return [None, None]
    m = np.median(RNG.choice(x, size=(n, len(x)), replace=True), axis=1)
    return [round(float(np.percentile(m, 2.5)), 1), round(float(np.percentile(m, 97.5)), 1)]


def hav(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def spearman(a, b):
    ra, rb = a.argsort().argsort().astype(float), b.argsort().argsort().astype(float)
    return float(np.corrcoef(ra, rb)[0, 1])


def top_places(g, s, count=10, spacing=300):
    order = np.argsort(-s)[:4000]
    out = []
    for k in order:
        if all(hav(g.lat[k], g.lon[k], g.lat[o], g.lon[o]) >= spacing for o in out):
            out.append(int(k))
            if len(out) == count:
                break
    return out


def overlap(g, a, b, km=150):
    return float(np.mean([any(hav(g.lat[x], g.lon[x], g.lat[y], g.lon[y]) < km for y in b) for x in a]))


# ------------------------------------------------------------------ main
def main():
    t0 = time.time()
    g = Grid()
    print(f"grid: {g.n} cells, {len(g.meta['targets'])} targets")
    known_ll = np.array([(a[2], a[3]) for a in KNOWN_ANALOGS])
    known_world = [a[4] for a in KNOWN_ANALOGS]

    # learned model retrained without known sites near each independent site
    import s06_build as s06

    F = s06.features()
    assert F.n == g.n, "rebuild the grid first (s06_build.py)"
    full_idx = {w: [F.cell_of[a[0]] for a in KNOWN_ANALOGS if w in a[4] and a[0] in F.cell_of] for w in ("moon", "mars")}

    mw_cache = {}

    def model_without(world, lat, lon):
        if (world, lat, lon) not in mw_cache:
            mw_cache[(world, lat, lon)] = _model_without(world, lat, lon)
        return mw_cache[(world, lat, lon)]

    def _model_without(world, lat, lon):
        keep = [F.cell_of[a[0]] for a, (la, lo), ww in zip(KNOWN_ANALOGS, known_ll, known_world)
                if world in ww and a[0] in F.cell_of and hav(lat, lon, la, lo) >= 300]
        if len(keep) == len(full_idx[world]):
            return None, 0  # nothing nearby: the shipped model is already independent
        p, _, _ = s06.train_predict(F, keep, rng=np.random.default_rng(11))
        return s06.pct_rank(p).astype(np.float32), len(full_idx[world]) - len(keep)

    # ---------------------------------------------------------- 1. independent sites
    cache = {}

    def ws(world, tasks, **kw):
        key = (world, tuple(tasks), tuple(sorted((k, str(v) if not isinstance(v, np.ndarray) else id(v)) for k, v in kw.items())))
        if key not in cache:
            cache[key] = world_score(g, world, tasks, **kw)
        return cache[key]

    sites = []
    for sid, name, la, lo, world, jobs, source in VALIDATION_SITES:
        k = g.cell_at(la, lo)
        jobs = jobs.split(",")
        dk = hav(la, lo, known_ll[:, 0], known_ll[:, 1])
        near = [(KNOWN_ANALOGS[i][1], round(float(dk[i]))) for i in np.argsort(dk)[:1]]
        mdl, hidden = model_without(world, la, lo)
        formula = ws(world, jobs, mix=0.0)
        blend = ws(world, jobs, mix=MIX) if mdl is None else world_score(g, world, jobs, mix=MIX, model=mdl)
        model = g.model[world] if mdl is None else mdl
        base = s06.baseline(F, world)
        row = {
            "id": sid, "name": name, "lat": la, "lon": lo, "world": world, "jobs": jobs, "source": source, "cell": k,
            "rock": g.meta["lithology"][int(g.lith[k])]["label"] if g.lith is not None else None,
            "nearest_known": near[0], "hidden_known": hidden,
            "formula": round(top_pct(formula, k), 1),
            "blend": round(top_pct(blend, k), 1),
            "model": round(top_pct(model, k), 1),
            "baseline": round(top_pct(base, k), 1),
            "dry_only": round(top_pct(g.I["dry"], k), 1),
            "remote_only": round(top_pct(g.I["remote"], k), 1),
            "cover": round(float(g.a["q_cover"][k] / 254), 2),
            "formula_rocks": round(top_pct(ws(world, jobs, mix=0.0, use_rock=True), k), 1),
        }
        sites.append(row)
        print(f"  {sid:18s} {world} {','.join(jobs):16s} formula top {row['formula']:5.1f}%  blend {row['blend']:5.1f}%  model {row['model']:5.1f}%"
              f"  base {row['baseline']:5.1f}%  (hid {hidden})  rock {row['rock']}")

    def summary(rows, keys=("formula", "blend", "model", "baseline", "dry_only", "remote_only", "formula_rocks")):
        out = {"n": len(rows)}
        for key in keys:
            v = [r[key] for r in rows if r.get(key) is not None]
            if not v:
                continue
            out[key] = {"median": round(float(np.median(v)), 1), "ci": boot_median(v), "top10": round(100 * float(np.mean(np.array(v) <= 10)), 1),
                        "top25": round(100 * float(np.mean(np.array(v) <= 25)), 1)}
        return out

    indep = {"sites": sites, "all": summary(sites), "moon": summary([s for s in sites if s["world"] == "moon"]),
             "mars": summary([s for s in sites if s["world"] == "mars"])}
    print("independent:", json.dumps({k: {m: indep[k][m]["median"] for m in ("formula", "blend", "model", "baseline")} for k in ("all", "moon", "mars")}))

    # ---------------------------------------------------------- 2. known sites, formula only (never fitted to them)
    known_rows = []
    for sid, name, la, lo, worlds in KNOWN_ANALOGS:
        k = g.cell_at(la, lo)
        kj = KNOWN_JOBS[sid].split(",")
        for world in worlds.split(","):
            known_rows.append({"id": sid, "name": name, "world": world, "jobs": kj, "cell": k,
                               "formula": round(top_pct(ws(world, kj, mix=0.0), k), 1),
                               "formula_any_job": round(top_pct(ws(world, TASKS, mix=0.0), k), 1),
                               "formula_rocks": round(top_pct(ws(world, kj, mix=0.0, use_rock=True), k), 1),
                               "baseline": round(top_pct(s06.baseline(F, world), k), 1),
                               "dry_only": round(top_pct(g.I["dry"], k), 1),
                               "remote_only": round(top_pct(g.I["remote"], k), 1)})
    known = {"rows": known_rows, "all": summary(known_rows, ("formula", "formula_any_job", "formula_rocks", "baseline", "dry_only", "remote_only")),
             "loo_model": g.meta["evaluation"]}
    print("known (formula, own jobs):", known["all"]["formula"]["median"], "any job:", known["all"]["formula_any_job"]["median"], "with rocks:", known["all"]["formula_rocks"]["median"])

    # ---------------------------------------------------------- 2b. how much should the learned model count?
    # Chosen on the known sites with leave-one-region-out models, then only reported on the independent sites.
    mixes = [round(x, 1) for x in np.arange(0, 1.01, 0.1)]
    loo = {m: [] for m in mixes}
    SHAPES = ("formula", "learned", "both") if g.shape else ("formula",)
    shape_known = {sv: [] for sv in SHAPES}
    for world in ("moon", "mars"):
        pos = [(a[0], F.cell_of[a[0]], a[2], a[3]) for a in KNOWN_ANALOGS if world in a[4] and a[0] in F.cell_of]
        for sid, k, la, lo in pos:
            formula_w = ws(world, KNOWN_JOBS[sid].split(","), mix=0.0)
            train = [kk for (_s, kk, la2, lo2) in pos if hav(la, lo, la2, lo2) >= 300]
            p, _, _ = s06.train_predict(F, train, rng=np.random.default_rng(5))
            mdl = s06.pct_rank(p).astype(np.float32)
            others = np.ones(g.n, bool)
            others[train] = False
            for m in mixes:
                b = (1 - m) * formula_w + m * mdl
                loo[m].append(float(100 * (b[others] > b[k]).mean()))
            for sv in SHAPES:
                b = (1 - MIX) * ws(world, KNOWN_JOBS[sid].split(","), mix=0.0, shape=sv) + MIX * mdl
                shape_known[sv].append(float(100 * (b[others] > b[k]).mean()))
    mix_curve = [{"mix": m, "known_median": round(float(np.median(loo[m])), 1), "known_top10": round(100 * float(np.mean(np.array(loo[m]) <= 10)), 1)} for m in mixes]
    best_mix = min(mix_curve, key=lambda r: (r["known_median"], -r["known_top10"]))["mix"]
    for r in mix_curve:
        v = []
        for s in sites:
            mdl, _ = model_without(s["world"], s["lat"], s["lon"])
            model = g.model[s["world"]] if mdl is None else mdl
            v.append(top_pct((1 - r["mix"]) * ws(s["world"], s["jobs"], mix=0.0) + r["mix"] * model, s["cell"]))
        r["independent_median"] = round(float(np.median(v)), 1)
        r["independent_top10"] = round(100 * float(np.mean(np.array(v) <= 10)), 1)
    for r in mix_curve:
        print(f"  mix {r['mix']:.1f}: known median top {r['known_median']}%  in top 10%: {r['known_top10']}%")
    indep_at_best = []
    for s in sites:
        mdl, _ = model_without(s["world"], s["lat"], s["lon"])
        model = g.model[s["world"]] if mdl is None else mdl
        b = (1 - best_mix) * ws(s["world"], s["jobs"], mix=0.0) + best_mix * model
        indep_at_best.append(top_pct(b, s["cell"]))
        s["chosen_mix"] = round(indep_at_best[-1], 1)
    mixing = {"curve": mix_curve, "best_on_known": best_mix, "shipped": MIX, "chosen": best_mix, "independent_median": round(float(np.median(indep_at_best)), 1), "independent_ci": boot_median(indep_at_best),
              "independent_top10": round(100 * float(np.mean(np.array(indep_at_best) <= 10)), 1)}
    print(f"chosen model share {best_mix}: independent median top {mixing['independent_median']}% CI {mixing['independent_ci']}")

    # ---------------------------------------------------------- 3. does the job matter?
    job_rows = []
    for s in sites:
        k, world = s["cell"], s["world"]
        per = {task: top_pct(ws(world, [task], mix=0.0), k) for task in TASKS}
        own = float(np.mean([per[j] for j in s["jobs"]]))
        other = float(np.mean([per[j] for j in TASKS if j not in s["jobs"]]))
        job_rows.append({"id": s["id"], "own": round(own, 1), "other": round(other, 1), "per_job": {j: round(v, 1) for j, v in per.items()}})
    for r in known_rows:
        k, world = r["cell"], r["world"]
        per = {task: top_pct(ws(world, [task], mix=0.0), k) for task in TASKS}
        own = float(np.mean([per[j] for j in r["jobs"]]))
        other = float(np.mean([per[j] for j in TASKS if j not in r["jobs"]]))
        job_rows.append({"id": r["id"] + ":" + world, "own": round(own, 1), "other": round(other, 1), "per_job": {j: round(v, 1) for j, v in per.items()}, "known": True})
    diff = np.array([r["other"] - r["own"] for r in job_rows])
    jobs = {"rows": job_rows, "better_share": round(100 * float(np.mean(diff > 0)), 1), "median_gain": round(float(np.median(diff)), 1),
            "sign_test_p": sign_test(int((diff > 0).sum()), int((diff != 0).sum()))}
    print(f"jobs: own job ranks better for {jobs['better_share']}% of sites, median gain {jobs['median_gain']} points, p={jobs['sign_test_p']}")

    # ---------------------------------------------------------- 4. robustness
    reps = [("shackleton", "base"), ("shackleton", "polar"), ("hadley", "traverse"), ("jezero", "astrobio"), ("gale", "traverse"),
            ("arcadia", "ice"), ("arsia", "caves"), ("meridiani", "isru")]
    rob = []
    sample = RNG.choice(g.n, size=20000, replace=False)
    for tid, task in reps:
        t = g.targets[tid]
        D = dims(g, t, task)
        s0 = score(g, t, task, D=D)
        top0 = top_places(g, s0)
        sp_w, ov_w, sp_n, ov_n = [], [], [], []
        for _ in range(60):
            w = {d: TASK_WEIGHTS[task][d] * float(np.exp(RNG.normal(0, 0.25))) for d in DIMS}
            s1 = score(g, t, task, weights=w, D=D)
            sp_w.append(spearman(s0[sample], s1[sample]))
            ov_w.append(overlap(g, top0, top_places(g, s1)))
        for _ in range(30):
            Dn = {d: np.clip(v + RNG.normal(0, 0.05, g.n).astype(np.float32), 0, 1) for d, v in D.items()}
            s1 = score(g, t, task, D=Dn)
            sp_n.append(spearman(s0[sample], s1[sample]))
            ov_n.append(overlap(g, top0, top_places(g, s1)))
        rob.append({"target": tid, "task": task, "weights_spearman": round(float(np.median(sp_w)), 3), "weights_top10": round(float(np.median(ov_w)), 2),
                    "weights_top10_p10": round(float(np.percentile(ov_w, 10)), 2),
                    "noise_spearman": round(float(np.median(sp_n)), 3), "noise_top10": round(float(np.median(ov_n)), 2)})
        print(f"  robust {tid}/{task}: weights rho={rob[-1]['weights_spearman']} top10 kept {rob[-1]['weights_top10']} · noise rho={rob[-1]['noise_spearman']} top10 kept {rob[-1]['noise_top10']}")

    # ---------------------------------------------------------- 5. ablations (formula only)
    abl = {}
    for d in DIMS + ["rocks"]:
        ind_v, kn_v = [], []
        for s in sites:
            if d == "rocks":
                sc = ws(s["world"], s["jobs"], mix=0.0, use_rock=True)
            else:
                sc = world_ablate(g, s["world"], s["jobs"], d)
            ind_v.append(top_pct(sc, s["cell"]))
        for r, (sid, _n, la, lo, _w) in zip(known_rows, [(a[0], a[1], a[2], a[3], a[4]) for a in KNOWN_ANALOGS for _ in a[4].split(",")]):
            k = g.cell_at(la, lo)
            kj = KNOWN_JOBS[sid].split(",")
            sc = ws(r["world"], kj, mix=0.0, use_rock=True) if d == "rocks" else world_ablate(g, r["world"], kj, d)
            kn_v.append(top_pct(sc, k))
        abl[d] = {"independent_median": round(float(np.median(ind_v)), 1), "known_median": round(float(np.median(kn_v)), 1)}
        print(f"  {'with' if d == 'rocks' else 'without'} {d:12s}: independent median top {abl[d]['independent_median']}% / known {abl[d]['known_median']}%")

    # ---------------------------------------------------------- 5b. ground shape from the terrain AI (K3), in the full score
    # Chosen on the known sites (leave-one-region-out models, as in 2b), then reported on the independent sites.
    shape_ind = {sv: [] for sv in SHAPES}
    for s in sites:
        mdl, _ = model_without(s["world"], s["lat"], s["lon"])
        model = g.model[s["world"]] if mdl is None else mdl
        for sv in SHAPES:
            b = (1 - MIX) * ws(s["world"], s["jobs"], mix=0.0, shape=sv) + MIX * model
            shape_ind[sv].append(top_pct(b, s["cell"]))
    shape_test = {sv: {"known_median": round(float(np.median(shape_known[sv])), 2), "known_top10": round(100 * float(np.mean(np.array(shape_known[sv]) <= 10)), 1),
                       "independent_median": round(float(np.median(shape_ind[sv])), 2), "independent_top10": round(100 * float(np.mean(np.array(shape_ind[sv]) <= 10)), 1)}
                  for sv in SHAPES}
    shape_test["best_on_known"] = min(SHAPES, key=lambda sv: (shape_test[sv]["known_median"], -shape_test[sv]["known_top10"]))
    print("ground shape in the full score:", shape_test)

    # ---------------------------------------------------------- 6. EMIT minerals in Rocks & craters (Mars targets with known minerals)
    # Chosen on the known Mars sites (own jobs), then reported on the independent Mars sites.
    mrows = []
    for r in known_rows + [dict(s, known=False) for s in sites]:
        if r["world"] != "mars":
            continue
        k = r["cell"]
        jobs_ = r["jobs"]
        mrows.append({"id": r["id"], "known": r.get("known", True), "emit": bool(g.emit_seen[k]),
                      "without": round(top_pct(ws("mars", jobs_, mix=0.0, use_min=False), k), 1),
                      "with": round(top_pct(ws("mars", jobs_, mix=0.0, use_min=True), k), 1)})

    def msum(rows):
        if not rows:
            return {"n": 0}
        d = np.array([r["without"] - r["with"] for r in rows])
        return {"n": len(rows), "without": round(float(np.median([r["without"] for r in rows])), 1), "with": round(float(np.median([r["with"] for r in rows])), 1),
                "better": int((d > 0).sum()), "worse": int((d < 0).sum())}

    minerals = {"rows": mrows, "known": msum([r for r in mrows if r["known"]]), "independent": msum([r for r in mrows if not r["known"]]),
                "known_emit": msum([r for r in mrows if r["known"] and r["emit"]]), "independent_emit": msum([r for r in mrows if not r["known"] and r["emit"]]),
                "weights": {"default": 0.2, **MIN_WEIGHT}, "unseen": MIN_UNSEEN, "shipped": USE_MINERALS,
                "targets": {t["id"]: t["minerals"] for t in g.meta["targets"] if "minerals" in t},
                "emit_places": int(g.emit_seen.sum())}
    mt = Path(__file__).resolve().parent / ".cache" / "minerals_test.json"
    if mt.exists():
        mdl = json.loads(mt.read_text(encoding="utf-8"))
        minerals["model"] = {k: mdl[k] for k in ("hidden", "independent", "decision", "minutes")}
    print("minerals (formula, Mars):", {k: minerals[k] for k in ("known", "independent", "known_emit", "independent_emit")})
    k3p = Path(__file__).resolve().parent / ".cache" / "k3_test.json"
    k3 = None
    if k3p.exists():
        k3 = json.loads(k3p.read_text(encoding="utf-8"))
        k3.pop("rows", None)

    out = {
        "generated": time.strftime("%Y-%m-%d"),
        "cells": g.n,
        "independent": indep,
        "known": known,
        "jobs": jobs,
        "mixing": mixing,
        "robustness": rob,
        "ablation": {"full": {"independent_median": indep["all"]["formula"]["median"], "known_median": known["all"]["formula"]["median"]}, **abl},
        "minerals": minerals,
        "terrain_ai": {**(k3 or {}), "full_score": shape_test} if k3 or len(SHAPES) > 1 else None,
        "model": g.meta["sources"].get("model"),
        "notes": [
            "Percentages are 'top X% of all land': 1% means only 1 in 100 land areas scores higher.",
            "Independent sites were never used to build or tune the model; the model is retrained without known sites within 300 km of each one.",
            f"Formula = the mission factors only; blend = what the site shows by default ({round(100 * (1 - MIX))}% factors, {round(100 * MIX)}% learned model).",
            "Rocks factor partly uses volcano and crater catalogues, so volcanic and impact sites get some help by design.",
        ],
    }
    (DATA / "validation.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"validation.json written in {time.time() - t0:.0f} s")


def world_ablate(g, world, tasks, drop):
    best = None
    for t in g.meta["targets"]:
        if t["body"] != world:
            continue
        for task in tasks:
            w = dict(TASK_WEIGHTS[task])
            w[drop] = 0.0
            s = score(g, t, task, mix=0.0, weights=w)
            best = s if best is None else np.maximum(best, s)
    return best


def sign_test(wins, n):
    """Two-sided exact sign test p-value."""
    from math import comb

    if n == 0:
        return None
    k = min(wins, n - wins)
    p = sum(comb(n, i) for i in range(0, k + 1)) / 2**n
    return round(min(1.0, 2 * p), 4)


if __name__ == "__main__":
    main()
