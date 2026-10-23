"""Step 8 · Terrain encoder: a small neural network that learns the shape of ground.

Self-supervised (SimCLR-style): two random views of the same 50 km height patch
(rotated, flipped, slightly rescaled, noisy) must land close together; other patches
must land far away. No labels are used, so known analog sites stay a fair test.

Trained on Earth, Moon and Mars patches together, so craters, lava plains and dunes
share one embedding space. Then every Earth land cell is compared with every Moon and
Mars target by cosine similarity.

Test: the catalogue pairs in src/data/sites.ts (e.g. Atacama → Gale) were chosen by
experts. A good shape measure should rank those Earth sites high for their targets.
We compare the encoder with the hand-made slope formula on exactly that question.

    python pipeline/s08_encoder.py        (needs steps 3, 5 and 7; CPU is fine, ~30 min)
"""

from __future__ import annotations

import json
import re
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from common import CACHE, LAT, LON, ROOT
from terrain_lib import topo_similarity

torch.manual_seed(7)
np.random.seed(7)
torch.set_num_threads(12)
SPACING_M = 50_000 / 42
EPOCHS = int(__import__("os").environ.get("EPOCHS", 20))
BATCH = 512


def features(h: torch.Tensor) -> torch.Tensor:
    """(B, 42, 42) heights in metres → (B, 2, 42, 42): scaled height and slope."""
    h = h - h.mean(dim=(1, 2), keepdim=True)
    gx = (torch.roll(h, -1, 2) - torch.roll(h, 1, 2)) / (2 * SPACING_M)
    gy = (torch.roll(h, -1, 1) - torch.roll(h, 1, 1)) / (2 * SPACING_M)
    slope = torch.rad2deg(torch.atan(torch.sqrt(gx**2 + gy**2)))
    slope[:, [0, -1], :] = slope[:, [1, -2], :]
    slope[:, :, [0, -1]] = slope[:, :, [1, -2]]
    return torch.stack([torch.sign(h) * torch.log1p(h.abs() / 150) / 3, slope / 15], 1)


def augment(h: torch.Tensor) -> torch.Tensor:
    b = h.shape[0]
    k = np.random.randint(4)
    h = torch.rot90(h, k, (1, 2))
    if np.random.rand() < 0.5:
        h = torch.flip(h, (2,))
    scale = torch.empty(b, 1, 1).uniform_(0.8, 1.25)
    h = h * scale + torch.randn_like(h) * 3.0
    # random shift by up to 3 cells (edge padding keeps the size)
    dx, dy = np.random.randint(-3, 4, 2)
    h = F.pad(h[:, None], (3, 3, 3, 3), mode="replicate")[:, 0, 3 + dy : 3 + dy + 42, 3 + dx : 3 + dx + 42]
    return h


class Encoder(nn.Module):
    def __init__(self, dim: int = 128):
        super().__init__()

        def block(i, o):
            return nn.Sequential(nn.Conv2d(i, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True), nn.Conv2d(o, o, 3, padding=1, bias=False), nn.BatchNorm2d(o), nn.ReLU(inplace=True))

        self.net = nn.Sequential(block(2, 16), nn.MaxPool2d(2), block(16, 32), nn.MaxPool2d(2), block(32, 64), nn.MaxPool2d(2), block(64, dim), nn.AdaptiveAvgPool2d(1), nn.Flatten())
        self.head = nn.Sequential(nn.Linear(dim, dim), nn.ReLU(inplace=True), nn.Linear(dim, 64))

    def forward(self, x):
        return self.net(x)


def nt_xent(z1, z2, t=0.2):
    z = F.normalize(torch.cat([z1, z2]), dim=1)
    sim = z @ z.T / t
    n = z1.shape[0]
    sim.fill_diagonal_(-1e9)
    target = torch.cat([torch.arange(n, 2 * n), torch.arange(0, n)])
    return F.cross_entropy(sim, target)


def catalogue_pairs():
    src = (ROOT / "src" / "data" / "sites.ts").read_text(encoding="utf-8")
    block = src[src.index("export const EARTH_SITES") :]
    pat = re.compile(r'id: "([^"]+)",\s*name: "[^"]+",\s*country: "[^"]*",\s*lat: (-?[\d.]+),\s*lon: (-?[\d.]+),.*?pairs: \[([^\]]*)\]', re.S)
    out = []
    for m in pat.finditer(block):
        pairs = re.findall(r'"([^"]+)"', m.group(4))
        out.append((m.group(1), float(m.group(2)), float(m.group(3)), pairs))
    return out


@torch.no_grad()
def embed(model, h: np.ndarray) -> np.ndarray:
    model.eval()
    out = []
    for s in range(0, len(h), 2048):
        x = features(torch.from_numpy(h[s : s + 2048].astype(np.float32)))
        # average the four rotations so the embedding does not depend on north
        e = sum(model(torch.rot90(x, k, (2, 3))) for k in range(4)) / 4
        out.append(F.normalize(e, dim=1).numpy())
    return np.concatenate(out)


def main() -> None:
    E = np.load(CACHE / "patches_earth.npz")
    S = np.load(CACHE / "patches_space.npz")
    I, J, earth = E["I"], E["J"], E["h"]
    moon, mars, tpatch, tids = S["moon"], S["mars"], S["targets"], [str(x) for x in S["target_ids"]]
    print(f"earth {len(earth)} · moon {len(moon)} · mars {len(mars)} · targets {len(tpatch)}")

    pool = np.concatenate([earth, np.repeat(moon, 6, 0), np.repeat(mars, 3, 0), np.repeat(tpatch, 40, 0)])
    model = Encoder()
    params = list(model.parameters())
    opt = torch.optim.AdamW(params, lr=2e-3, weight_decay=1e-4)
    steps = EPOCHS * (len(pool) // BATCH)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=2e-3, total_steps=steps, pct_start=0.1)
    t0 = time.time()
    for ep in range(EPOCHS):
        model.train()
        order = np.random.permutation(len(pool))
        tot, nb = 0.0, 0
        for s in range(0, len(order) - BATCH + 1, BATCH):
            h = torch.from_numpy(pool[order[s : s + BATCH]].astype(np.float32))
            z1 = model.head(model(features(augment(h))))
            z2 = model.head(model(features(augment(h))))
            loss = nt_xent(z1, z2)
            opt.zero_grad()
            loss.backward()
            opt.step()
            sched.step()
            tot += loss.item()
            nb += 1
        print(f"  epoch {ep + 1}/{EPOCHS}  loss {tot / nb:.3f}  {(time.time() - t0) / 60:.1f} min", flush=True)
    torch.save(model.state_dict(), CACHE / "encoder.pt")

    emb_e = embed(model, earth)
    emb_t = embed(model, tpatch)
    sim = emb_t @ emb_e.T  # (targets, cells)

    # ------------------------------------------------ test on the expert catalogue pairs
    targets = {t["id"]: t for t in json.loads((CACHE / "targets.json").read_text(encoding="utf-8"))}
    hist = np.load(CACHE / "terr_hist.npy")[I, J]
    relief = np.load(CACHE / "terr_relief.npy")[I, J]
    clat, clon = LAT[I], LON[J]
    res = {"learned": [], "formula": [], "pairs": []}
    for sid, la, lo, pairs in catalogue_pairs():
        d = (clat - la) ** 2 + ((clon - lo) * np.cos(np.radians(la))) ** 2
        k = int(d.argmin())
        if d[k] > 1.0:
            continue
        for tid in pairs:
            if tid not in tids:
                continue
            ti = tids.index(tid)
            t = targets[tid]["terrain"]
            topo = topo_similarity(hist, relief, np.array(t["hist"])[None], np.array([t["relief"]]))
            res["learned"].append(float((sim[ti] > sim[ti, k]).mean()))
            res["formula"].append(float((topo > topo[k]).mean()))
            res["pairs"].append(f"{sid}->{tid}")
    learned, formula = np.array(res["learned"]), np.array(res["formula"])
    ev = {
        "pairs": len(learned),
        "learned_median_top_pct": round(100 * float(np.median(learned)), 1),
        "formula_median_top_pct": round(100 * float(np.median(formula)), 1),
        "learned_top20_pct": round(100 * float((learned <= 0.2).mean()), 1),
        "formula_top20_pct": round(100 * float((formula <= 0.2).mean()), 1),
        "both_median_top_pct": None,
        "epochs": EPOCHS,
    }
    # blended measure: average of the two percentile ranks
    blend = []
    for (pair, a, b) in zip(res["pairs"], learned, formula):
        sid, tid = pair.split("->")
        blend.append((a + b) / 2)
    ev["both_median_top_pct"] = round(100 * float(np.median(blend)), 1)
    print(json.dumps(ev, indent=1))

    # percentile rank per target → uint8 for the website
    rank = np.zeros_like(sim, dtype=np.uint8)
    for ti in range(len(tids)):
        r = sim[ti].argsort().argsort() / max(1, sim.shape[1] - 1)
        rank[ti] = np.round(r * 254).astype(np.uint8)
    np.save(CACHE / "shape_rank.npy", rank)
    (CACHE / "shape_eval.json").write_text(json.dumps({**ev, "target_ids": tids, "per_pair": dict(zip(res["pairs"], zip([round(100 * x, 1) for x in learned], [round(100 * x, 1) for x in formula])))}, indent=1), encoding="utf-8")
    print("done.")


if __name__ == "__main__":
    main()
