"""Step 24 · Expert review of the top candidates (roadmap item 3, for Md. Tanvir Hasan).

    python pipeline/s24_review.py kit                    → docs/review/EXPERT_REVIEW_KIT.md, docs/review/review_sheet.csv,
                                                           public/data/review.json (status "pending")
    python pipeline/s24_review.py import <filled.csv>    → public/data/review.json with the ratings

The 20 places: for every one of the 18 targets, its best new place on the whole Earth (no travel
limits, at least 150 km from any known test site, places 400 km apart, the target's main job),
then the two strongest runners-up. Scores are the site's default blend, computed with the same
NumPy code as every published test (s14_validate), so they match what Find shows. Each place also
gets its best 10 km spot (s23). Nothing here changes a score: the review is reported as it comes back.
"""

from __future__ import annotations

import csv
import json
import math
import sys
import time
from pathlib import Path

import numpy as np

import s14_validate as v
from s22_parity_fixture import main_jobs
import s23_pinpoint as pin

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "docs" / "review"
REVIEW_JSON = ROOT / "public" / "data" / "review.json"
SITE = "https://shadowastra-atlas.vercel.app"
REVIEWER = "Md. Tanvir Hasan"
RUBRIC = [
    ("ground", "Ground shape", "Do the slopes and relief look like the target's ground for this job? 1 = not at all, 5 = a strong match."),
    ("geology", "Rocks and geology", "Is the rock type, volcanic or impact setting, or mineralogy relevant to the target? 1 to 5."),
    ("environment", "Cold, dryness and light", "Does the climate help the test (cold, dry, bare, sunlight)? 1 to 5."),
    ("access", "Access and permits", "Could a small team realistically reach and work there (roads, towns, protected areas, safety)? 1 to 5."),
    ("overall", "Would you recommend it", "yes / maybe / no, for this target and job."),
]
EARTH_R = 6371.0


def hav(la1, lo1, la2, lo2):
    p = math.pi / 180
    a = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 2 * EARTH_R * math.asin(min(1.0, math.sqrt(a)))


def value(g: v.Grid, name: str, k: int):
    f = g.f.get(name)
    if not f:
        return None
    x = g.a[name][k]
    return None if x == f["nodata"] else float(x) / f["scale"]


def place_name(g: v.Grid, k: int) -> tuple[str, str]:
    """Same wording as Grid.name() in src/lib/grid.ts."""
    N = g.meta["names"]
    ci, ri, pi_ = (value(g, f, k) for f in ("n_country", "n_region", "n_place"))
    country = N["country"][int(ci)] if ci is not None else None
    region = N["region"][int(ri)] if ri is not None else None
    place = N["place"][int(pi_)] if pi_ is not None else None
    km = value(g, "n_place_km", k) or 0
    where = country or ("Antarctica" if g.lat[k] < -60 else None)
    title = region or (f"Near {place}" if place else where or "Remote land")
    near = f"{round(km)} km from {place}" if region and place and km < 400 else None
    return title, " · ".join(x for x in (near, where) if x)


def confidence(g: v.Grid, k: int, world: str) -> str:
    c = g.meta["confidence"]
    cover = g.a["q_cover"][k] / 254.0
    spread = g.a[f"u_{world}"][k] / 254.0
    if cover < c["cover_low"] or spread > c["spread_low"]:
        return "low"
    return "medium" if cover < c["cover_medium"] or spread > c["spread_medium"] else "high"


def total(g: v.Grid, tid: str, job: str) -> np.ndarray:
    t = g.targets[tid]
    w = v.TASK_WEIGHTS[job]
    D = v.dims(g, t, job, use_min=v.USE_MINERALS, shape="formula")
    mission = sum(D[d] * w[d] for d in v.DIMS) / (sum(w.values()) or 1)
    return (1 - v.MIX) * mission + v.MIX * g.model[t["body"]]


def best_new(g: v.Grid, s: np.ndarray, count: int, taken: list[tuple[float, float]]) -> list[int]:
    known = [(a["lat"], a["lon"]) for a in g.meta["known"]]
    out: list[int] = []
    for k in np.argsort(-s, kind="stable"):
        la, lo = float(g.lat[k]), float(g.lon[k])
        if min(hav(la, lo, a, b) for a, b in known) < 150:
            continue
        if any(hav(la, lo, a, b) < 400 for a, b in [(float(g.lat[x]), float(g.lon[x])) for x in out] + taken):
            continue
        out.append(int(k))
        if len(out) >= count:
            break
    return out


def kit() -> None:
    t0 = time.time()
    g = v.Grid()
    jobs = main_jobs()
    lith = g.meta.get("lithology") or []
    picks: list[dict] = []
    runners: list[dict] = []
    for t in g.meta["targets"]:
        job = jobs[t["id"]]
        s = total(g, t["id"], job)
        # kept 400 km from places already chosen for earlier targets, so the 20 are 20 different places
        ks = best_new(g, s, 2, [(p["lat"], p["lon"]) for p in picks])
        for i, k in enumerate(ks):
            title, sub = place_name(g, k)
            rock = value(g, "f_lith", k)
            row = {"target": t["id"], "target_name": t["name"], "body": t["body"], "job": job, "k": k,
                   "lat": round(float(g.lat[k]), 2), "lon": round(float(g.lon[k]), 2), "place": title, "where": sub,
                   "score": round(float(s[k]), 3), "top_pct": round(float((s > s[k]).mean() * 100), 2),
                   "confidence": confidence(g, k, t["body"]),
                   "slope": value(g, "f_slope", k), "relief_m": value(g, "f_relief", k),
                   "rock": lith[int(rock)]["label"] if rock is not None and int(rock) < len(lith) else None,
                   "coldest_night_c": value(g, "f_lst_night_min", k), "rain_mm": value(g, "f_precip", k),
                   "bare_share": value(g, "f_barren", k), "hist": t["terrain"]["hist"]}
            (picks if i == 0 else runners).append(row)
    # two strongest runners-up, kept apart from everything chosen
    for r in sorted(runners, key=lambda x: -x["score"]):
        if len(picks) >= 20:
            break
        if all(hav(r["lat"], r["lon"], p["lat"], p["lon"]) >= 400 for p in picks):
            picks.append(r)
    for i, p in enumerate(picks, 1):
        p["id"] = f"R{i:02d}"
        la0, lo0 = float(g.lat[p["k"]]), float(g.lon[p["k"]])
        h = pin.heights(la0, lo0)
        W = pin.windows(h, np.array(p["hist"]), pin.water(la0, lo0))
        if not len(W):
            W = pin.windows(h, np.array(p["hist"]))
        b = int(np.argmax(W[:, 2]))
        la, lo = local_latlon(float(g.lat[p["k"]]), float(g.lon[p["k"]]), W[b, 0], W[b, 1])
        p["pin_lat"], p["pin_lon"], p["pin_alike"] = round(la, 3), round(lo, 3), round(float(W[b, 2]), 3)
        p["find_url"] = f"{SITE}/discover?step=results&target={p['target']}&task={p['job']}&at={p['lat']:.2f},{p['lon']:.2f}"
        p["report_url"] = f"{SITE}/report?target={p['target']}&task={p['job']}&at={p['lat']:.2f},{p['lon']:.2f}"
        p["map_url"] = f"https://www.google.com/maps/@{p['lat']:.3f},{p['lon']:.3f},60000m/data=!3m1!1e3"
        print(f"  {p['id']} {p['target']:20s} {p['place'][:32]:32s} {p['score']:.3f} top {p['top_pct']}%  {time.time() - t0:.0f} s", flush=True)
    write_kit(picks)
    REVIEW_JSON.write_text(json.dumps({"status": "pending", "reviewer": REVIEWER, "generated": time.strftime("%Y-%m-%d"),
                                       "candidates": [{k: p[k] for k in ("id", "target", "job", "lat", "lon", "place", "score")} for p in picks],
                                       "rubric": [{"id": a, "label": b} for a, b, _ in RUBRIC]}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(picks)} candidates · kit in {OUT_DIR.relative_to(ROOT)} · {time.time() - t0:.0f} s")


def local_latlon(lat0: float, lon0: float, x: float, y: float) -> tuple[float, float]:
    """Inverse azimuthal-equidistant projection of one point (same formula as terrain_lib.local_points)."""
    R = pin.RADIUS_KM["earth"]
    rho = math.hypot(x, y)
    if rho < 1e-9:
        return lat0, lon0
    c, p0 = rho / R, math.radians(lat0)
    lat = math.asin(math.cos(c) * math.sin(p0) + y * math.sin(c) * math.cos(p0) / rho)
    lon = math.radians(lon0) + math.atan2(x * math.sin(c), rho * math.cos(p0) * math.cos(c) - y * math.sin(p0) * math.sin(c))
    return math.degrees(lat), (math.degrees(lon) + 180) % 360 - 180


def top_text(pct: float) -> str:
    return "highest on Earth" if pct == 0 else f"top {pct:.2f}%"


def fmt(x, unit="", d=0):
    return "n/a" if x is None else f"{x:.{d}f}{unit}"


def write_kit(picks: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Expert review kit: the 20 strongest new candidates",
        "",
        f"For **{REVIEWER}** (scientific validation, Team ShadowAstra). Generated {time.strftime('%d %B %Y')} by `pipeline/s24_review.py kit`.",
        "",
        "## What we ask",
        "",
        "For each place below, open its link, look at the satellite view and the place report, and rate it in",
        "`review_sheet.csv` (Excel or Google Sheets both work). One to two hours in total is plenty; a short note",
        "is worth more than a careful number. When you are done, send the sheet back and we run",
        "`python pipeline/s24_review.py import review_sheet.csv`; How it works then shows your verdict as it is,",
        "good or bad. Your ratings never change a score.",
        "",
        "## The rubric",
        "",
        "| Column | Question |",
        "|---|---|",
        *[f"| `{a}` ({b}) | {c} |" for a, b, c in RUBRIC],
        "| `notes` | Anything we got wrong or did not think of: hazards, permits, better spots nearby, published work. |",
        "",
        "## How the places were chosen",
        "",
        "For each of the 18 targets, its best new place on Earth: no travel limits, at least 150 km from any",
        "of the 38 known test sites and 400 km from the places already chosen, scored for the target's main",
        "job with the site's default blend (40% mission factors, 60% learned model). Then the two strongest",
        "runners-up.",
        "A place is a 0.5° cell, about 55 km across; the best 10 km spot is the piece of it whose slopes are",
        "most like the target's (see How it works for how well that works).",
        "",
        "## The 20 places",
        "",
        "| # | Target · job | Place | Score (top %) | Confidence | Ground | Rock | Cold & dry | Best 10 km spot | Links |",
        "|---|---|---|---|---|---|---|---|---|---|",
    ]
    for p in picks:
        lines.append(
            f"| {p['id']} | {p['target_name']} · {p['job']} | **{p['place']}**<br>{p['where']}<br>`{p['lat']:.2f}, {p['lon']:.2f}` | "
            f"{p['score']:.2f} ({top_text(p['top_pct'])}) | {p['confidence']} | slope {fmt(p['slope'], '°', 1)}, relief {fmt(p['relief_m'], ' m')} | "
            f"{p['rock'] or 'unknown'} | night {fmt(p['coldest_night_c'], ' °C')}, rain {fmt(p['rain_mm'], ' mm/yr')} | "
            f"`{p['pin_lat']:.3f}, {p['pin_lon']:.3f}` ({round(p['pin_alike'] * 100)}% alike) | [Find]({p['find_url']}) · [report]({p['report_url']}) · [satellite]({p['map_url']}) |"
        )
    lines += ["", "Values: NASA POWER, MODIS, SRTM, GLiM and the learned model, as on the site. `n/a` means the source has no value there.", ""]
    (OUT_DIR / "EXPERT_REVIEW_KIT.md").write_text("\n".join(lines), encoding="utf-8")
    cols = ["id", "target", "job", "place", "lat", "lon", "score", "top_pct", "confidence", "find_url"] + [a for a, _, _ in RUBRIC] + ["notes", "reviewer", "date"]
    with (OUT_DIR / "review_sheet.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for p in picks:
            w.writerow({**{c: p.get(c, "") for c in cols}, "reviewer": REVIEWER})


def import_sheet(path: str) -> None:
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    review = json.loads(REVIEW_JSON.read_text(encoding="utf-8"))
    by_id = {c["id"]: c for c in review["candidates"]}
    done = []
    for r in rows:
        nums = {a: r.get(a, "").strip() for a, _, _ in RUBRIC if a != "overall"}
        if not any(nums.values()) and not r.get("overall", "").strip():
            continue
        c = by_id[r["id"]]
        for a, x in nums.items():
            if x:
                n = float(x)
                if not 1 <= n <= 5:
                    raise SystemExit(f"{r['id']} {a}: {x} is not between 1 and 5")
                c[a] = n
        o = r.get("overall", "").strip().lower()
        if o:
            if o not in ("yes", "maybe", "no"):
                raise SystemExit(f"{r['id']} overall: {o!r} is not yes, maybe or no")
            c["overall"] = o
        c["notes"] = r.get("notes", "").strip()
        done.append(c)
    if not done:
        raise SystemExit("no ratings found in the sheet")
    mean = {a: round(float(np.mean([c[a] for c in done if a in c])), 2) for a, _, _ in RUBRIC if a != "overall" and any(a in c for c in done)}
    votes = {o: sum(c.get("overall") == o for c in done) for o in ("yes", "maybe", "no")}
    review.update({"status": "done", "reviewed": len(done), "mean": mean, "overall": votes,
                   "date": rows[0].get("date") or time.strftime("%Y-%m-%d")})
    REVIEW_JSON.write_text(json.dumps(review, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(done)} reviewed · means {mean} · overall {votes} → {REVIEW_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "kit":
        kit()
    elif len(sys.argv) >= 3 and sys.argv[1] == "import":
        import_sheet(sys.argv[2])
    else:
        raise SystemExit(__doc__)
