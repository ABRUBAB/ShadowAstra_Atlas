"""Step 17 · EMIT surface minerals on the shared 0.5° grid.

NASA's EMIT imaging spectrometer on the ISS maps the minerals of the world's dry, bare
land (±52° latitude). Its L3 product (EMITL3ASA v002, LP DAAC) gives the share of eleven
minerals in every 0.5° cell. The minerals that matter for Mars are the ones water leaves
behind: clays, sulfates, carbonates and iron oxides, the same families orbiters and rovers
found at Jezero, Gale, Meridiani and Mawrth Vallis.

EMIT cell centres sit on whole and half degrees, a quarter cell off our grid, so each of our
cells is the mean of the (up to) four EMIT cells it overlaps. Cells EMIT masks (plants,
water, cloud, cities) stay empty: no data, not zero.

Needs a free NASA Earthdata token (never stored in the repo):

    curl -L -H "Authorization: Bearer <token>" -o pipeline/.cache/emit/EMIT_L3_ASA_002.nc \\
      https://data.lpdaac.earthdatacloud.nasa.gov/lp-prod-protected/EMITL3ASA.002/EMIT_L3_ASA_002/EMIT_L3_ASA_002.nc
    python pipeline/s17_emit.py

Writes pipeline/.cache/emit.npz: one 360 × 720 float32 grid per mineral and per group.
"""

from __future__ import annotations

import h5py
import numpy as np

from common import CACHE, LAT, LON, NCOL, NROW

SRC = CACHE / "emit" / "EMIT_L3_ASA_002.nc"
MINERALS = ["Calcite", "Chlorite", "Dolomite", "Goethite", "Gypsum", "Hematite", "Illite+Muscovite", "Kaolinite", "Montmorillonite", "Quartz+Feldspar", "Vermiculite"]
# mineral families as Mars scientists group them
GROUPS = {
    "clay": ("Kaolinite", "Montmorillonite", "Illite+Muscovite", "Chlorite", "Vermiculite"),
    "sulfate": ("Gypsum",),
    "carbonate": ("Calcite", "Dolomite"),
    "iron": ("Hematite", "Goethite"),
}


def main() -> None:
    f = h5py.File(SRC, "r")
    elat, elon = f["lat"][:].astype(np.float64), f["lon"][:].astype(np.float64)
    out = {}
    for m in MINERALS:
        a = f[m][:].astype(np.float32)
        a[a < -9000] = np.nan
        g = np.full((NROW, NCOL), np.nan, np.float32)
        # each of our cells (centre at x.25 / x.75) overlaps the EMIT cells 0.25° either side
        acc = np.zeros((NROW, NCOL), np.float32)
        cnt = np.zeros((NROW, NCOL), np.int8)
        for dlat in (-0.25, 0.25):
            for dlon in (-0.25, 0.25):
                ri = np.rint((elat[0] - (LAT + dlat)) / 0.5).astype(int)
                ci = np.rint(((LON + dlon) - elon[0]) / 0.5).astype(int)
                rok = (ri >= 0) & (ri < len(elat))
                cok = (ci >= 0) & (ci < len(elon))
                sub = np.full((NROW, NCOL), np.nan, np.float32)
                sub[np.ix_(rok, cok)] = a[np.ix_(ri[rok], ci[cok])]
                ok = np.isfinite(sub)
                acc[ok] += sub[ok]
                cnt[ok] += 1
        g[cnt > 0] = acc[cnt > 0] / cnt[cnt > 0]
        out[m] = g
    for name, members in GROUPS.items():
        out[name] = np.sum([out[m] for m in members], axis=0)
    np.savez_compressed(CACHE / "emit.npz", **{k.replace("+", "_"): v for k, v in out.items()})
    cov = np.isfinite(out["clay"])
    print(f"EMIT minerals on {int(cov.sum())} of our cells")
    for name in GROUPS:
        v = out[name][cov]
        print(f"  {name:9s} median {np.median(v):.3f}  p95 {np.percentile(v, 95):.3f}  max {v.max():.3f}")
    # sanity: known mineral sites
    for label, la, lo in (("White Sands (gypsum)", 32.8, -106.3), ("Atacama", -24.1, -70.0), ("Pilbara (iron)", -22.0, 118.5), ("Death Valley", 36.5, -117.0)):
        i, j = int((90 - la) / 0.5), int((lo + 180) / 0.5)
        print(f"  {label:22s}", {k: (round(float(out[k][i, j]), 3) if np.isfinite(out[k][i, j]) else None) for k in GROUPS})


if __name__ == "__main__":
    main()
