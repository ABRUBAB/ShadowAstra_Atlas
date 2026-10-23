# ShadowAstra Atlas · K1b · Moon, Mars and Earth context layers that need Kaggle's network
#
# PDS Geosciences (unreachable from the team's home network) and NASA Earthdata (login):
#   Moon  · LRO Diviner GDR L3: rock abundance and soil (regolith) temperature, 32 ppd, ±60°
#   Moon  · Lunar Prospector neutron spectrometer: epithermal neutrons (hydrogen), 0.5°
#   Mars  · Mars Odyssey GRS: water-equivalent hydrogen and other elements, 5° bins
#   Earth · EMIT L3 aggregated mineral spectral abundance, 0.5° (needs the EARTHDATA_TOKEN secret)
# The directory layout of PDS archives changes over time, so every source is found by
# crawling the archive from a known root and logged; nothing here stops the others.

import json
import re
import time
import traceback
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

T0 = time.time()
OUT = Path("/kaggle/working")
RAW = OUT / "raw"
RAW.mkdir(parents=True, exist_ok=True)
LOG = []
UA = {"User-Agent": "ShadowAstra-Atlas (NASA Space Apps 2026)"}


def log(*a):
    msg = f"[{(time.time() - T0) / 60:6.1f} min] " + " ".join(str(x) for x in a)
    print(msg, flush=True)
    LOG.append(msg)


def get(url, headers=None, timeout=120, tries=4):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={**UA, **(headers or {})})
            return urllib.request.urlopen(req, timeout=timeout).read()
        except Exception as exc:  # noqa: BLE001
            if k == tries - 1:
                raise
            time.sleep(3 * (k + 1))
            last = exc  # noqa: F841


def listing(url):
    html = get(url).decode("latin-1")
    hrefs = re.findall(r'href="([^"?#]+)"', html, re.I)
    out = []
    for h in hrefs:
        full = urllib.parse.urljoin(url, h)
        if full.startswith(url) and full != url:
            out.append(full)
    return sorted(set(out))


def crawl(root, keep, follow=lambda u: True, depth=4, limit=4000):
    """Breadth-first walk of an Apache/IIS style directory tree."""
    files, todo, seen = [], [(root, 0)], set()
    while todo and len(seen) < limit:
        url, d = todo.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            items = listing(url)
        except Exception as exc:  # noqa: BLE001
            log("  cannot list", url, type(exc).__name__)
            continue
        for it in items:
            if it.endswith("/"):
                if d + 1 <= depth and follow(it):
                    todo.append((it, d + 1))
            elif keep(it):
                files.append(it)
    return files


def save(url, sub):
    dest = RAW / sub / url.rsplit("/", 1)[-1]
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        dest.write_bytes(get(url, timeout=600))
    return dest


def step(name, fn):
    try:
        log("==", name)
        fn()
    except Exception:  # noqa: BLE001
        log("!! failed", name)
        log(traceback.format_exc()[-1500:])


# ------------------------------------------------------------------ Moon: Diviner GDR L3
def diviner():
    roots = ["https://pds-geosciences.wustl.edu/lro/lro-l-dlre-5-gdr-v1/", "https://pds-geosciences.wustl.edu/lro/"]
    files = []
    for r in roots:
        files = crawl(
            r,
            keep=lambda u: re.search(r"(rock|_ra_|soil|_st_|rcf|cf_).*\.(img|lbl)$", u, re.I) is not None and "32" in u,
            follow=lambda u: any(k in u.lower() for k in ("dlre", "gdr", "data", "l3", "lrodlr", "cyl", "ppd")),
            depth=5,
        )
        if files:
            break
    log(f"  diviner candidates: {len(files)}")
    for u in files[:40]:
        log("   ", u)
    got = [save(u, "diviner") for u in files if re.search(r"\.(img|lbl)$", u, re.I)][:12]
    log(f"  saved {len(got)} Diviner files")


# ------------------------------------------------------------------ Moon: Lunar Prospector NS
def lunar_prospector():
    files = []
    for r in ["https://pds-geosciences.wustl.edu/lunar/", "https://pds-geosciences.wustl.edu/missions/lunarp/"]:
        files = crawl(
            r,
            keep=lambda u: re.search(r"(epi|neutron|ns).*\.(tab|img|dat|lbl|txt)$", u, re.I) is not None,
            follow=lambda u: any(k in u.lower() for k in ("lp", "ns", "neutron", "rdr", "data", "prospector", "reduced", "special")),
            depth=5,
        )
        if files:
            break
    log(f"  lunar prospector candidates: {len(files)}")
    for u in files[:40]:
        log("   ", u)
    for u in files[:20]:
        save(u, "lp_ns")


# ------------------------------------------------------------------ Mars: Odyssey GRS
def grs():
    root = "https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/"
    files = crawl(root, keep=lambda u: re.search(r"\.(tab|lbl)$", u, re.I) is not None and "5x5" in u.lower(), depth=4)
    log(f"  GRS 5x5 files: {len(files)}")
    for u in files:
        log("   ", u)
        save(u, "grs")


# ------------------------------------------------------------------ Earth: EMIT L3 minerals
def emit():
    try:
        from kaggle_secrets import UserSecretsClient  # type: ignore

        token = UserSecretsClient().get_secret("EARTHDATA_TOKEN")
    except Exception:  # noqa: BLE001
        log("  no EARTHDATA_TOKEN secret attached; skipping EMIT")
        return
    cmr = "https://cmr.earthdata.nasa.gov/search/granules.json?short_name=EMITL3ASA&version=002&page_size=20"
    entries = json.loads(get(cmr))["feed"]["entry"]
    links = [lk["href"] for e in entries for lk in e.get("links", []) if lk["href"].endswith(".nc")]
    log(f"  EMIT granule links: {links}")
    for u in links[:1]:
        dest = RAW / "emit" / u.rsplit("/", 1)[-1]
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(get(u, headers={"Authorization": f"Bearer {token}"}, timeout=900))
        log(f"  saved {dest.name} {dest.stat().st_size / 1e6:.1f} MB")
        try:
            import xarray as xr

            ds = xr.open_dataset(dest)
            log("  EMIT variables:", list(ds.data_vars)[:40])
            arrays = {}
            for v in ds.data_vars:
                a = np.asarray(ds[v].values, dtype=np.float32)
                if a.ndim == 2:
                    arrays[v] = a
            np.savez_compressed(OUT / "emit_l3asa.npz", **arrays)
            log(f"  EMIT arrays: {len(arrays)}")
        except Exception:  # noqa: BLE001
            log(traceback.format_exc()[-800:])


step("Diviner GDR L3", diviner)
step("Lunar Prospector NS", lunar_prospector)
step("Mars Odyssey GRS", grs)
step("EMIT L3ASA", emit)
(OUT / "k1b_log.json").write_text(json.dumps({"log": LOG, "minutes": (time.time() - T0) / 60}, indent=1))
log("K1b done")
