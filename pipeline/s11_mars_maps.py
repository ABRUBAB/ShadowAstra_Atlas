"""Step 11 · Mars global maps from the Mars Global Surveyor TES instrument (ASU).

Raw numeric values (not colours) through the ASU JMARS map service, VICAR float32:
minerals (Bandfield 2002), dust cover index, Lambert albedo, thermal inertia.

    python pipeline/s11_mars_maps.py
"""

from __future__ import annotations

import re

import numpy as np

from common import CACHE, fetch

BASE = "http://ms-mars.mars.asu.edu/{svc}?SERVICE=WMS&REQUEST=GetMap&FORMAT=image/vicar&WIDTH={w}&HEIGHT={h}&SRS=JMARS:4&BBOX=0,-90,360,90&STYLES=&VERSION=1.1.1&LAYERS={layer}"

LAYERS = {
    # name: (service, layer, width)
    "hematite": ("TES_Hematite_numeric", "TES_Hematite_numeric", 1440),
    "olivine": ("TES_Olivine_numeric", "TES_Olivine_numeric", 1440),
    "plagioclase": ("TES_Plagioclase_numeric", "TES_Plagioclase_numeric", 1440),
    "clinopyroxene": ("TES_Clinopyroxene_numeric", "TES_Clinopyroxene_numeric", 1440),
    "orthopyroxene": ("TES_Orthopyroxene_numeric", "TES_Orthopyroxene_numeric", 1440),
    "quartz": ("TES_Quartz_numeric", "TES_Quartz_numeric", 1440),
    "feldspar": ("TES_Feldspar_numeric", "TES_Feldspar_numeric", 1440),
    "amphibole": ("TES_Amphibole_numeric", "TES_Amphibole_numeric", 1440),
    "glass_clay": ("TES_Glass_Clay_numeric", "TES_Glass_Clay_numeric", 1440),
    "dust": ("TES_Dust_numeric", "TES_Dust_numeric", 1440),
    "albedo": ("alb32", "TES_Lambert_Albedo_numeric", 2880),
    "thermal_inertia": ("ti16", "TES_Thermal_Inertia_numeric", 2880),
}


def read_vicar(raw: bytes) -> np.ndarray:
    head = raw[:4096].decode("latin-1")
    lbl = int(re.search(r"LBLSIZE=(\d+)", head).group(1))
    label = raw[:lbl].decode("latin-1")
    nl = int(re.search(r"\bNL=(\d+)", label).group(1))
    ns = int(re.search(r"\bNS=(\d+)", label).group(1))
    fmt = re.search(r"FORMAT='(\w+)'", label).group(1)
    # REALFMT/INTFMT (not BREALFMT, the binary-label format) give the byte order
    realfmt = re.search(r"(?<![A-Z])REALFMT='(\w+)'", label)
    intfmt = re.search(r"(?<![A-Z])INTFMT='(\w+)'", label)
    big_real = bool(realfmt and realfmt.group(1) == "IEEE")
    big_int = bool(intfmt and intfmt.group(1) == "HIGH")
    dtype = {"REAL": ">f4" if big_real else "<f4", "HALF": ">i2" if big_int else "<i2", "BYTE": "u1", "FULL": ">i4" if big_int else "<i4", "DOUB": ">f8" if big_real else "<f8"}[fmt]
    a = np.frombuffer(raw[lbl : lbl + nl * ns * np.dtype(dtype).itemsize], dtype=dtype).reshape(nl, ns).astype(np.float32)
    # JMARS rows go north → south and longitude 0 → 360 east; roll to −180 → 180
    a = np.roll(a, ns // 2, axis=1)
    return a


def main() -> None:
    for name, (svc, layer, w) in LAYERS.items():
        raw = fetch(BASE.format(svc=svc, layer=layer, w=w, h=w // 2), timeout=240)
        a = read_vicar(raw)
        bad = ~np.isfinite(a) | (a < -0.5) | (a > 1e20)  # −1 marks "no data" in the TES maps
        a[bad] = np.nan
        np.save(CACHE / f"mars_tes_{name}.npy", a)
        v = a[np.isfinite(a)]
        print(f"  {name:16s} {a.shape}  min {v.min():.3f}  median {np.median(v):.3f}  max {v.max():.3f}  nan {bad.mean():.1%}", flush=True)
    print("done.")


if __name__ == "__main__":
    main()
