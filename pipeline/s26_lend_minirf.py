"""Step 26 · Two direct looks for ice at every Moon target: LRO LEND neutrons and LRO Mini-RF radar.

Diviner (step 20) says where ice could survive. These two LRO instruments look for the ice itself,
in two very different ways, and both are read only near each target, with HTTP range requests:

  LEND (Lunar Exploration Neutron Detector)
      Hydrogen slows neutrons down, so ground with more hydrogen (for example water ice) sends
      fewer epithermal neutrons up to the orbiter. Product: Averaged LEND Counts Data (ALD), PDS
      data set LRO-L-LEND-4/5-RDR-V1.0 (PDS4 collection urn:nasa:pds:lro_lend:data_science_averaged),
      files LEND_RDR_ALDS_20090915 (south polar map, 0.5° cells below 80°S, about 15 km across in
      latitude) and LEND_RDR_ALDE_20090915 (1° cells, about 30 km, between 80°S and 80°N). Both cover
      the nominal mission, 15 Sep 2009 to 11 Dec 2011, when LRO flew a near-circular orbit about
      50 km up. The later maps (2011 to 2016) are not used: LRO's elliptical orbit then changes the
      count rate with height, so the north and south can no longer be compared.
      We use the collimated sensors (CSETN, the sum of four), averaged over the cells whose centres lie
      within 15 km (polar map) or 30 km (1° map) of the target, weighted by exposure time, and compare
      that with typical highland ground away from the poles: the area-weighted average of the 1° cells
      between 50°S and 50°N whose Lunar Prospector iron oxide is below 8% (bright, iron-poor rock like
      the south pole's; LP GRS 2° map, Prettyman et al. 2006, as in step 20). Rock type matters: in this
      map, mare ground (FeO 12% or more) sends about 2% more neutrons than that highland ground, about as
      much as the polar dips. A negative "dip" means fewer neutrons, so more hydrogen than that ground.
      The ± is the counting error the product gives (1 sigma). Near the equator rock type moves the count
      by a few percent and hydrogen is too scarce for LEND, so equatorial numbers say little about water.
      LEND was designed to see about 5 km of ground from 50 km up (PDS instrument description), but
      other studies argue that much of the collimated signal comes from wider ground (Lawrence et al.
      2011, Science 334; Eke et al. 2012, ApJ 747). PDS publishes counts, not a water map, so we do not
      turn the dip into a water amount. Instrument: Mitrofanov et al. 2010 (Space Sci. Rev. 150);
      processing: Boynton et al. 2012 (JGR 117) and the LEND RDR SIS.
  Mini-RF (Miniature Radio Frequency radar, S band, 12.6 cm)
      The circular polarization ratio, CPR = same sense / opposite sense echo. Smooth dusty ground
      gives low values; rough, blocky ground gives high values, and so can thick, clean ice. So a high
      CPR inside a dark polar crater is a hint of ice, not proof (Spudis et al. 2013, JGR Planets 118;
      Fa and Cai 2013, JGR Planets 118; Thomson et al. 2012, GRL 39 for Shackleton).
      South-pole targets: polar CPR mosaic LSZ_XXXXX_3CP_PIU_90S000_V1 (data set
      LRO-L-MRFLRO-5-CDR-MOSAIC-V1.0, volume LROMRF_0005, 256 pixels per degree = 118 m, polar
      stereographic, east- and west-looking passes combined, 2009 to 2011). Other targets: global CPR
      mosaic GLOBAL_CPR_128PPD_SIMP_0C (LRO-L-MRFLRO-5-GLOBAL-MOSAIC-V1.0, volume LROMRF_1001, 128 pixels
      per degree = 237 m, Cahill et al. 2014, Icarus 243). Instrument: Nozette et al. 2010 (Space Sci.
      Rev. 150). Every pixel within 10 km of the target: median CPR, share of the ground above 1, and the
      share of that circle the mosaic covers ("not covered" when it has no data there). For context the
      same statistics are taken from a sparse sample of lines of the same mosaic (the south polar region
      poleward of 80°S, or the whole Moon between 70°S and 70°N).

These are shown as facts ("Earth can't copy"), never scored.

    python pipeline/s26_lend_minirf.py               → pipeline/.cache/target_ice.json
    python pipeline/s26_lend_minirf.py --patch-grid  also merges them into each Moon target's "resources"
        in public/data/grid.json (facts only: no score, model or grid.bin change). s06_build merges the
        same file on a rebuild, and s20 --patch-grid keeps these keys.
"""

from __future__ import annotations

import json
import math
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from common import CACHE, OUT, UA

R_MOON = 1737.4
# ------------------------------------------------------------------ LEND
LEND = "https://pds-geosciences.wustl.edu/lro/lro-l-lend-2-edr-v1/lrolen_0xxx/data/2009/20090915/lend_rdr_{map}_20090915.dat"
ALD_REC = 310  # bytes per row (LEND_RDR_ALD.FMT): two 23-byte times, then big-endian floats
ALD = np.dtype([("t", "S46"), ("lat", ">f4"), ("lon", ">f4"), ("spare", ">f4"), ("stn1", ">f4", 3), ("setn", ">f4", 3),
                ("stn2", ">f4", 3), ("stn3", ">f4", 3), ("cs_exp", ">f4"), ("cs", ">f4"), ("cs_err", ">f4"), ("shen", ">f4", 48)])
assert ALD.itemsize == ALD_REC
LEND_KM = {"alds": 15.0, "alde": 30.0}  # one map cell: 0.5° (15 km) near the pole, 1° (30 km) elsewhere
LPGRS = "https://pds-geosciences.wustl.edu/lunar/lp-l-grs-5-elem-abundance-v1/lp_9001/data/lpgrs_high1_elem_abundance_2deg.tab"
REF_LAT, REF_FEO = 50.0, 8.0  # reference ground: |lat| <= 50°, Lunar Prospector FeO below 8 weight %
# ------------------------------------------------------------------ Mini-RF
POLAR = "https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-4-cdr-v1/lromrf_0005/data/sar/mosaics/lsz_xxxxx_3cp_piu_90s000_v1.img"
POLAR_N, POLAR_C, POLAR_KM = 10346, 5173.5, 0.11845058759433  # samples = lines; projection offset (1-based); km per pixel
GLOBAL = "https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-5-global-mosaic-v1/lromrf_1001/data/128ppd/global_cpr_128ppd_simp_0c.img"
GLOBAL_W, GLOBAL_H, GLOBAL_PPD = 46080, 23040, 128.0
GLOBAL_S0, GLOBAL_L0, GLOBAL_KM = 23040.5, 11520.5, 0.23690117518867
CPR_KM = 10.0


def get_range(url: str, a: int, b: int, tries: int = 5) -> bytes:
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={**UA, "Range": f"bytes={a}-{b}"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) != b - a + 1:
                raise OSError(f"short read {len(data)} of {b - a + 1}")
            return data
        except Exception:  # noqa: BLE001 - network hiccups are retried
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"range {a}-{b} failed: {url}")


def km_between(lat1, lon1, lat2, lon2):
    """Great-circle distance on the Moon (numpy-friendly)."""
    p1, p2 = np.radians(lat1), np.radians(lat2)
    h = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(lon2 - lon1) / 2) ** 2
    return 2 * R_MOON * np.arcsin(np.sqrt(np.clip(h, 0, 1)))


# ================================================================== LEND
def ald_rows(name: str, r0: int, r1: int) -> np.ndarray:
    """Rows r0..r1 inclusive of a LEND ALD map: lat, lon, exposure (s), CSETN rate (counts/s), its error."""
    raw = get_range(LEND.format(map=name), r0 * ALD_REC, (r1 + 1) * ALD_REC - 1)
    a = np.frombuffer(raw, dtype=ALD)
    return np.stack([a["lat"], a["lon"], a["cs_exp"], a["cs"], a["cs_err"]], axis=1).astype(np.float64)


def lend_equatorial() -> np.ndarray:
    """The whole 1° map (57,600 cells, 17.9 MB): the highland reference spans 50°S to 50°N, all longitudes."""
    cache = CACHE / "lend_alde_20090915.npy"
    if cache.exists():
        return np.load(cache)
    a = ald_rows("alde", 0, 160 * 360 - 1)
    np.save(cache, a)
    return a


def lp_feo(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Lunar Prospector FeO (weight %) of the 2° equal-area bin holding each point (lon in degrees east, 0..360).
    Columns as in s20: index, lat min/max, lon min/max (-180..180), ..., TiO2 (11), FeO (12), K, Th, U."""
    from common import fetch

    t = np.array([[float(x) for x in ln.split()] for ln in fetch(LPGRS).decode("ascii").splitlines() if ln.strip()])
    lon = np.where(lon >= 180, lon - 360, lon)
    out = np.full(lat.shape, np.nan)
    for lat0 in np.unique(t[:, 1]):
        band = t[t[:, 1] == lat0]
        band = band[np.argsort(band[:, 3])]
        m = (lat >= lat0) & (lat < band[0, 2])
        j = np.clip(np.searchsorted(band[:, 3], lon[m], side="right") - 1, 0, len(band) - 1)
        out[m] = band[j, 12] * 100
    return out


def lend_reference(eq: np.ndarray) -> tuple[float, int]:
    """Area-weighted CSETN rate of highland ground away from the poles (see the docstring)."""
    feo = lp_feo(eq[:, 0], eq[:, 1])
    m = (eq[:, 2] > 0) & (eq[:, 3] > 0) & (np.abs(eq[:, 0]) <= REF_LAT) & (feo < REF_FEO)
    w = np.cos(np.radians(eq[m, 0]))
    return float(np.sum(eq[m, 3] * w) / np.sum(w)), int(m.sum())


def lend_polar(lat: float) -> np.ndarray:
    """Only the 0.5° latitude bands of the south polar map that can hold cells within 15 km of `lat`."""
    reach = LEND_KM["alds"] / (math.pi / 180 * R_MOON) + 1e-6
    bands = [i for i in range(20) if abs((-89.75 + 0.5 * i) - lat) <= reach]
    cache = CACHE / f"lend_alds_{bands[0]}_{bands[-1]}.npy"
    if cache.exists():
        return np.load(cache)
    a = ald_rows("alds", bands[0] * 720, (bands[-1] + 1) * 720 - 1)
    assert np.allclose(np.unique(a[:, 0]), [-89.75 + 0.5 * i for i in bands]), "unexpected LEND rows"
    np.save(cache, a)
    return a


def lend_at(lat: float, lon: float, eq: np.ndarray, ref: float) -> dict:
    name = "alds" if lat < -80 else "alde"
    a = lend_polar(lat) if name == "alds" else eq
    ok = (a[:, 2] > 0) & (a[:, 3] > 0)
    d = km_between(lat, lon % 360, a[:, 0], a[:, 1])
    m = ok & (d <= LEND_KM[name])
    w = a[m, 2]
    rate = float(np.sum(a[m, 3] * w) / np.sum(w))
    err = float(math.sqrt(np.sum((a[m, 4] * w) ** 2)) / np.sum(w))
    return {"lend_dip_pct": round(100 * (rate / ref - 1), 1), "lend_dip_err_pct": round(100 * err / ref, 1),
            "lend_rate_cps": round(rate, 3), "lend_ref_cps": round(ref, 3), "lend_cells": int(m.sum()),
            "lend_radius_km": LEND_KM[name], "lend_map_deg": 0.5 if name == "alds" else 1.0,
            "lend_ref": f"highland ground between {REF_LAT:.0f}°S and {REF_LAT:.0f}°N (Lunar Prospector FeO below {REF_FEO:.0f}%)",
            "lend_source": "LRO LEND collimated epithermal neutrons, averaged map 2009 to 2011 (PDS LRO-L-LEND-4/5-RDR-V1.0)"}


# ================================================================== Mini-RF
def read_lines(url: str, width: int, lines: list[int], s0: int, s1: int) -> np.ndarray:
    """Samples s0..s1 (1-based, inclusive) of each 1-based line, little-endian float32, NaN where empty."""

    def one(line: int) -> np.ndarray:
        a = ((line - 1) * width + (s0 - 1)) * 4
        return np.frombuffer(get_range(url, a, a + (s1 - s0 + 1) * 4 - 1), dtype="<f4")

    with ThreadPoolExecutor(8) as ex:
        block = np.vstack(list(ex.map(one, lines))).astype(np.float64)
    block[~np.isfinite(block) | (block <= 0) | (block > 1e30)] = np.nan  # ISIS nulls are about -3.4e38
    return block


def polar_window(lat: float, lon: float, km: float):
    """CPR pixels around a south-pole point (polar stereographic), with each pixel's distance in km."""
    r = 2 * R_MOON * math.tan(math.pi / 4 + math.radians(lat) / 2)
    s = POLAR_C + r * math.sin(math.radians(lon)) / POLAR_KM
    ln = POLAR_C - r * math.cos(math.radians(lon)) / POLAR_KM
    h = int(math.ceil(km / POLAR_KM)) + 2
    l0, l1 = max(1, int(round(ln)) - h), min(POLAR_N, int(round(ln)) + h)
    s0, s1 = max(1, int(round(s)) - h), min(POLAR_N, int(round(s)) + h)
    cache = CACHE / f"minirf_polar_{lat:.2f}_{lon:.2f}.npy"
    if cache.exists():
        cpr = np.load(cache)
    else:
        cpr = read_lines(POLAR, POLAR_N, list(range(l0, l1 + 1)), s0, s1)
        np.save(cache, cpr)
    ss, ll = np.meshgrid(np.arange(s0, s1 + 1, dtype=float), np.arange(l0, l1 + 1, dtype=float))
    x, y = (ss - POLAR_C) * POLAR_KM, (POLAR_C - ll) * POLAR_KM  # DSMAP.CAT: x = (S - S0)·scale, y = (L0 - L)·scale
    plat = np.degrees(2 * np.arctan(np.hypot(x, y) / (2 * R_MOON))) - 90
    plon = np.degrees(np.arctan2(x, y))
    return cpr, km_between(lat, lon, plat, plon)


def global_window(lat: float, lon: float, km: float):
    """CPR pixels around a point in the global simple cylindrical mosaic, with distances in km."""
    lon = (lon + 180) % 360 - 180
    hl = int(math.ceil(km / GLOBAL_KM)) + 2
    hs = int(math.ceil(km / (GLOBAL_KM * math.cos(math.radians(lat))))) + 2
    ln, s = int(round(GLOBAL_L0 - lat * GLOBAL_PPD)), int(round(GLOBAL_S0 + lon * GLOBAL_PPD))
    l0, l1, s0, s1 = ln - hl, ln + hl, s - hs, s + hs
    assert 1 <= l0 and l1 <= GLOBAL_H and 1 <= s0 and s1 <= GLOBAL_W, "window crosses the map edge"
    cache = CACHE / f"minirf_global_{lat:.2f}_{lon:.2f}.npy"
    if cache.exists():
        cpr = np.load(cache)
    else:
        cpr = read_lines(GLOBAL, GLOBAL_W, list(range(l0, l1 + 1)), s0, s1)
        np.save(cache, cpr)
    ss, ll = np.meshgrid(np.arange(s0, s1 + 1, dtype=float), np.arange(l0, l1 + 1, dtype=float))
    return cpr, km_between(lat, lon, (GLOBAL_L0 - ll) / GLOBAL_PPD, (ss - GLOBAL_S0) / GLOBAL_PPD)


def cpr_stats(cpr: np.ndarray, inside: np.ndarray) -> dict:
    v = cpr[inside]
    good = np.isfinite(v)
    cover = float(good.mean()) if v.size else 0.0
    if good.sum() < 50:
        return {"cpr_median": None, "cpr_above1_share": None, "cpr_coverage": round(cover, 3), "cpr_pixels": int(good.sum())}
    v = v[good]
    return {"cpr_median": round(float(np.median(v)), 2), "cpr_above1_share": round(float(np.mean(v > 1)), 3),
            "cpr_coverage": round(cover, 3), "cpr_pixels": int(v.size)}


def cpr_reference(polar: bool) -> dict:
    """Median CPR and share above 1 from a sparse sample of whole lines of the same mosaic (context only):
    every 64th line (7.6 km apart) poleward of 80°S, or every 256th line (2° apart) between 70°S and 70°N."""
    cache = CACHE / f"minirf_ref_{'polar' if polar else 'global'}.npy"
    if polar:
        reach = int(round(2 * R_MOON * math.tan(math.pi / 4 + math.radians(-80) / 2) / POLAR_KM))  # pixels from the pole to 80°S
        lines = list(range(int(POLAR_C) - reach, int(POLAR_C) + reach + 1, 64))
        if cache.exists():
            a = np.load(cache)
        else:
            a = read_lines(POLAR, POLAR_N, lines, 1, POLAR_N)
            np.save(cache, a)
        ss, ll = np.meshgrid(np.arange(1, POLAR_N + 1, dtype=float), np.array(lines, dtype=float))
        r = np.hypot((ss - POLAR_C) * POLAR_KM, (POLAR_C - ll) * POLAR_KM)
        keep = np.degrees(2 * np.arctan(r / (2 * R_MOON))) - 90 <= -80
        w = np.ones_like(a)
    else:
        lines = list(range(int(GLOBAL_L0 - 70 * GLOBAL_PPD), int(GLOBAL_L0 + 70 * GLOBAL_PPD) + 1, 256))
        if cache.exists():
            a = np.load(cache)
        else:
            a = read_lines(GLOBAL, GLOBAL_W, lines, 1, GLOBAL_W)
            np.save(cache, a)
        keep = np.ones_like(a, dtype=bool)
        w = np.repeat(np.cos(np.radians((GLOBAL_L0 - np.array(lines, dtype=float)) / GLOBAL_PPD))[:, None], a.shape[1], axis=1)  # equal area
    good = keep & np.isfinite(a)
    v, wt = a[good], w[good]
    order = np.argsort(v)
    cum = np.cumsum(wt[order]) / wt.sum()
    return {"cpr_ref_median": round(float(v[order][np.searchsorted(cum, 0.5)]), 2),
            "cpr_ref_above1_share": round(float(np.sum(wt[v > 1]) / wt.sum()), 3),
            "cpr_ref_region": "south polar region, poleward of 80°S" if polar else "the whole Moon between 70°S and 70°N"}


def minirf_at(lat: float, lon: float, refs: dict) -> dict:
    polar = lat < -70
    cpr, d = polar_window(lat, lon, CPR_KM) if polar else global_window(lat, lon, CPR_KM)
    out = cpr_stats(cpr, d <= CPR_KM)
    out.update({"cpr_radius_km": CPR_KM, "cpr_pixel_m": round((POLAR_KM if polar else GLOBAL_KM) * 1000), **refs[polar],
                "minirf_source": ("LRO Mini-RF S-band radar, south polar CPR mosaic, 118 m (PDS LRO-L-MRFLRO-5-CDR-MOSAIC-V1.0)" if polar
                                  else "LRO Mini-RF S-band radar, global CPR mosaic, 237 m (PDS LRO-L-MRFLRO-5-GLOBAL-MOSAIC-V1.0)")})
    return out


# ================================================================== main
def main() -> None:
    targets = [t for t in json.loads((OUT / "grid.json").read_text(encoding="utf-8"))["targets"] if t["body"] == "moon"]
    eq = lend_equatorial()
    ok = (eq[:, 2] > 0) & (eq[:, 3] > 0)
    wt = np.cos(np.radians(eq[ok, 0]))
    moon = float(np.sum(eq[ok, 3] * wt) / np.sum(wt))
    ref, nref = lend_reference(eq)
    print(f"LEND collimated epithermal, 2009 to 2011: highland reference {ref:.4f} counts/s over {nref} cells "
          f"({100 * (ref / moon - 1):+.2f}% against the whole map 80°S to 80°N, {moon:.4f})")
    refs = {True: cpr_reference(True), False: cpr_reference(False)}
    print("Mini-RF context:", refs)
    res: dict[str, dict] = {}
    for t in targets:
        t0 = time.time()
        r = {**lend_at(t["lat"], t["lon"], eq, ref), **minirf_at(t["lat"], t["lon"], refs)}
        res[t["id"]] = r
        print(f"  {t['id']:20s} LEND {r['lend_dip_pct']:+5.1f} ± {r['lend_dip_err_pct']:.1f}% ({r['lend_cells']} cells)  "
              f"CPR median {r['cpr_median']}, above 1 {r['cpr_above1_share']}, cover {r['cpr_coverage']} ({time.time() - t0:.0f} s)", flush=True)
    (CACHE / "target_ice.json").write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding="utf-8")
    if "--patch-grid" in sys.argv:
        gp = OUT / "grid.json"
        g = json.loads(gp.read_text(encoding="utf-8"))
        for t in g["targets"]:
            if t["id"] in res:
                t.setdefault("resources", {}).update(res[t["id"]])
        gp.write_text(json.dumps(g, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"LEND and Mini-RF facts merged into {gp.name} for {sum(t['id'] in res for t in g['targets'])} targets")


if __name__ == "__main__":
    main()
