# ShadowAstra Atlas · K3 · A terrain foundation model for three worlds (2 × T4)
#
# Self-supervised ViT-S/8 (DINO self-distillation, multi-crop) trained on height patches
# from Earth (K2), the Moon and Mars (K1), all cut the same way: 50 km squares, north up,
# smoothed to the pixel spacing. Inputs are two channels: height and slope in physical
# units, so scale is kept. A small domain-adversarial head (gradient reversal) pushes the
# three worlds into one shared space, so "crater field on Earth" lands near "crater field
# on Mars" rather than near "anything on Earth".
#
# Then: embeddings for every Earth land cell and every 1° Moon and Mars cell, similarity
# maps for the website's 18 targets, top Earth twins for every Moon and Mars cell, and an
# honest evaluation against the formula (known sites, independent sites, expert pairs,
# how well the worlds mix). Training is time-boxed and checkpointed every epoch, so a later
# session can resume from k3_ckpt.pt.

import glob
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

OUT = Path("/kaggle/working") if Path("/kaggle/working").exists() else Path("./k3_out")
OUT.mkdir(parents=True, exist_ok=True)
TIME_BUDGET_H = float(os.environ.get("SA_BUDGET_H", 8.0))  # whole session
TRAIN_SHARE = 0.86  # of the budget, the rest is embeddings and evaluation

TRAIN_SRC = r'''
import glob, json, math, os, time
import numpy as np
import torch, torch.nn as nn, torch.nn.functional as F
import torch.distributed as dist
import timm

OUT = os.environ["SA_OUT"]
DEADLINE = float(os.environ["SA_DEADLINE"])
SMOKE = os.environ.get("SA_SMOKE") == "1"
WORLDS = ["earth", "moon", "mars"]
FOOT_KM = 50.0


def find(name):
    hits = sorted(glob.glob(f"/kaggle/input/**/{name}", recursive=True)) + sorted(glob.glob(f"{OUT}/../**/{name}", recursive=True))
    return hits[0] if hits else None


def features(h, spacing_km):
    """(B,1,H,W) heights in metres -> (B,2,H,W): height/400 and slope/30 degrees."""
    h = h - h.mean(dim=(2, 3), keepdim=True)
    d = (spacing_km * 1000.0).view(-1, 1, 1, 1) * 2
    gx = torch.zeros_like(h)
    gy = torch.zeros_like(h)
    gx[..., :, 1:-1] = (h[..., :, 2:] - h[..., :, :-2]) / d
    gy[..., 1:-1, :] = (h[..., 2:, :] - h[..., :-2, :]) / d
    slope = torch.rad2deg(torch.atan(torch.sqrt(gx * gx + gy * gy)))
    return torch.cat([(h / 400.0).clamp(-12, 12), slope / 30.0], 1)


def views(h, n_global=2, n_local=6, g=None):
    """Random rotated, flipped, scaled crops made on the GPU with one affine warp each."""
    B = h.shape[0]
    dev = h.device
    x = h.unsqueeze(1)
    out = []
    for i in range(n_global + n_local):
        glob_ = i < n_global
        size = 96 if glob_ else 48
        lo, hi = (0.45, 1.0) if glob_ else (0.12, 0.45)
        s = torch.sqrt(torch.empty(B, device=dev).uniform_(lo, hi, generator=g))
        ang = (torch.randint(0, 4, (B,), device=dev, generator=g).float() * (math.pi / 2)) + torch.empty(B, device=dev).uniform_(-0.18, 0.18, generator=g)
        flip = torch.where(torch.rand(B, device=dev, generator=g) < 0.5, -1.0, 1.0)
        room = (1 - s) * 0.98
        tx = torch.empty(B, device=dev).uniform_(-1, 1, generator=g) * room
        ty = torch.empty(B, device=dev).uniform_(-1, 1, generator=g) * room
        c, sn = torch.cos(ang), torch.sin(ang)
        theta = torch.stack([torch.stack([s * c * flip, -s * sn, tx], 1), torch.stack([s * sn * flip, s * c, ty], 1)], 1)
        grid = F.affine_grid(theta, (B, 1, size, size), align_corners=False)
        v = F.grid_sample(x, grid, mode="bilinear", padding_mode="reflection", align_corners=False)
        v = v * torch.empty(B, 1, 1, 1, device=dev).uniform_(0.8, 1.25, generator=g)
        spacing = s * FOOT_KM / size
        out.append(features(v, spacing))
    return out


class Head(nn.Module):
    def __init__(self, d=384, out=8192, hid=1536, bot=256):
        super().__init__()
        self.mlp = nn.Sequential(nn.Linear(d, hid), nn.GELU(), nn.Linear(hid, hid), nn.GELU(), nn.Linear(hid, bot))
        self.last = nn.utils.parametrizations.weight_norm(nn.Linear(bot, out, bias=False))
        self.last.parametrizations.weight.original0.data.fill_(1.0)
        self.last.parametrizations.weight.original0.requires_grad = False

    def forward(self, x):
        return self.last(F.normalize(self.mlp(x), dim=-1))


class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = timm.create_model("vit_small_patch8_224", pretrained=False, img_size=96, in_chans=2, num_classes=0, dynamic_img_size=True, drop_path_rate=0.1)
        self.head = Head(self.backbone.num_features)

    def forward(self, crops):
        feats = [self.backbone(c) for c in crops]
        return torch.cat([self.head(f) for f in feats]), feats


class GradReverse(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x, lam):
        ctx.lam = lam
        return x.view_as(x)

    @staticmethod
    def backward(ctx, g):
        return -ctx.lam * g, None


class Data:
    def __init__(self, smoke=False):
        self.arrs = []
        for w in WORLDS:
            p = find(f"{w}_train96.npy")
            a = np.load(p, mmap_mode="r") if p else np.random.default_rng(0).normal(0, 300, (512, 96, 96)).astype(np.float16)
            self.arrs.append(a)
        self.sizes = [len(a) for a in self.arrs]

    def batch(self, n, rng):
        w = rng.integers(0, 3, n)
        out = np.empty((n, 96, 96), np.float32)
        for k in range(3):
            idx = np.nonzero(w == k)[0]
            if len(idx):
                j = np.sort(rng.integers(0, self.sizes[k], len(idx)))
                out[idx] = np.asarray(self.arrs[k][j], dtype=np.float32)
        return torch.from_numpy(out), torch.from_numpy(w)


def main():
    ddp = "LOCAL_RANK" in os.environ
    if ddp:
        dist.init_process_group("nccl")
        rank, world = dist.get_rank(), dist.get_world_size()
        torch.cuda.set_device(int(os.environ["LOCAL_RANK"]))
    else:
        rank, world = 0, 1
    dev = torch.device("cuda", int(os.environ.get("LOCAL_RANK", 0))) if torch.cuda.is_available() else torch.device("cpu")
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.manual_seed(7 + rank)
    rng = np.random.default_rng(100 + rank)
    g = torch.Generator(device=dev)
    g.manual_seed(1000 + rank)

    data = Data()
    per_gpu = 8 if SMOKE else int(os.environ.get("SA_BATCH", 64))
    student, teacher = Net().to(dev), Net().to(dev)
    teacher.load_state_dict(student.state_dict())
    for p in teacher.parameters():
        p.requires_grad = False
    dom = nn.Linear(student.backbone.num_features, 3).to(dev)
    if ddp:
        student = nn.parallel.DistributedDataParallel(student, device_ids=[dev.index])
        dom = nn.parallel.DistributedDataParallel(dom, device_ids=[dev.index])
    s_mod = student.module if ddp else student
    params = [p for p in list(s_mod.parameters()) + list((dom.module if ddp else dom).parameters()) if p.requires_grad]
    decay = [p for p in params if p.ndim > 1]
    nodecay = [p for p in params if p.ndim <= 1]
    opt = torch.optim.AdamW([{"params": decay, "weight_decay": 0.04}, {"params": nodecay, "weight_decay": 0.0}], lr=1e-4)
    scaler = torch.amp.GradScaler("cuda", enabled=dev.type == "cuda")
    center = torch.zeros(1, 8192, device=dev)

    step, epoch, history = 0, 0, []
    ck = find("k3_ckpt.pt")
    if ck:
        st = torch.load(ck, map_location=dev)
        s_mod.load_state_dict(st["student"])
        teacher.load_state_dict(st["teacher"])
        (dom.module if ddp else dom).load_state_dict(st["dom"])
        center = st["center"].to(dev)
        step, history = st["step"], st.get("history", [])
        if rank == 0:
            print(f"resumed from step {step}", flush=True)

    total_batch = per_gpu * world
    steps_per_epoch = max(1, sum(data.sizes) // total_batch)
    base_lr = 5e-4 * total_batch / 256
    # time the first steps, then fix the schedule so training ends before the deadline
    t_start = time.time()
    start_step = step
    total_steps = None
    timing_steps = 3 if SMOKE else 40
    while True:
        if total_steps is None and step - start_step >= timing_steps:
            rate = (step - start_step) / max(1e-6, time.time() - t_start)
            t = torch.tensor([step + 4 if SMOKE else step + int((DEADLINE - time.time()) * rate * 0.97)], device=dev, dtype=torch.long)
            if ddp:
                dist.all_reduce(t, op=dist.ReduceOp.MIN)
            total_steps = int(t.item())
            if rank == 0:
                print(f"{rate:.2f} steps/s, {total_steps} steps in total ({total_steps / steps_per_epoch:.1f} epochs)", flush=True)
        if total_steps is not None and step >= total_steps:
            break
        T = total_steps or 10**7
        warm = min(2000, int(0.06 * T)) if total_steps else 10**7
        lr = base_lr * min(1.0, (step + 1) / max(1, warm)) if step < warm else 1e-6 + (base_lr - 1e-6) * 0.5 * (1 + math.cos(math.pi * (step - warm) / max(1, T - warm)))
        wd = 0.04 + (0.4 - 0.04) * min(1.0, step / max(1, T))
        opt.param_groups[0]["lr"] = lr
        opt.param_groups[1]["lr"] = lr
        opt.param_groups[0]["weight_decay"] = wd
        mom = 1 - (1 - 0.996) * (math.cos(math.pi * min(1.0, step / max(1, T))) + 1) / 2
        ep_f = step / steps_per_epoch
        t_temp = 0.04 + (0.07 - 0.04) * min(1.0, ep_f / 8)
        lam = 0.1 * min(1.0, ep_f / 5)

        h, w = data.batch(per_gpu, rng)
        h, w = h.to(dev, non_blocking=True), w.to(dev, non_blocking=True)
        with torch.no_grad():
            crops = views(h, g=g)
        with torch.autocast(device_type=dev.type, dtype=torch.float16, enabled=dev.type == "cuda"):
            with torch.no_grad():
                t_out, _ = teacher(crops[:2])
            s_out, s_feats = student(crops)
            s_log = (s_out.float() / 0.1).chunk(len(crops))
            t_prob = F.softmax((t_out.float() - center) / t_temp, dim=-1).detach().chunk(2)
            loss, n = 0.0, 0
            for iq, q in enumerate(t_prob):
                for v in range(len(s_log)):
                    if v == iq:
                        continue
                    loss = loss + torch.sum(-q * F.log_softmax(s_log[v], dim=-1), dim=-1).mean()
                    n += 1
            loss = loss / n
            z = torch.cat(s_feats[:2]).float()
            dl = F.cross_entropy(dom(GradReverse.apply(z, lam)), torch.cat([w, w]))
            total = loss + dl
        opt.zero_grad(set_to_none=True)
        scaler.scale(total).backward()
        scaler.unscale_(opt)
        nn.utils.clip_grad_norm_(params, 3.0)
        scaler.step(opt)
        scaler.update()
        with torch.no_grad():
            for ps, pt in zip(s_mod.parameters(), teacher.parameters()):
                pt.mul_(mom).add_(ps.detach(), alpha=1 - mom)
            c = t_out.float().mean(0, keepdim=True)
            if ddp:
                dist.all_reduce(c)
                c = c / world
            center = center * 0.9 + c * 0.1
        step += 1
        if rank == 0 and (step % 200 == 0 or SMOKE):
            history.append({"step": step, "epoch": round(ep_f, 2), "loss": round(loss.item(), 4), "domain_loss": round(dl.item(), 4), "lr": lr, "min": round((time.time() - t_start) / 60, 1)})
            print(history[-1], flush=True)
        if rank == 0 and (step % steps_per_epoch == 0 or (total_steps and step >= total_steps)):
            torch.save({"student": s_mod.state_dict(), "teacher": teacher.state_dict(), "dom": (dom.module if ddp else dom).state_dict(), "center": center.cpu(), "step": step, "history": history}, os.path.join(OUT, "k3_ckpt.pt"))
    if rank == 0:
        torch.save({"student": s_mod.state_dict(), "teacher": teacher.state_dict(), "dom": (dom.module if ddp else dom).state_dict(), "center": center.cpu(), "step": step, "history": history}, os.path.join(OUT, "k3_ckpt.pt"))
        torch.save(teacher.backbone.state_dict(), os.path.join(OUT, "k3_teacher_backbone.pt"))
        json.dump({"steps": step, "history": history, "per_gpu": per_gpu, "gpus": world}, open(os.path.join(OUT, "k3_train.json"), "w"), indent=1)
    if ddp:
        dist.destroy_process_group()


if __name__ == "__main__":
    main()
'''

T0 = time.time()
LOG = []


def log(*a):
    msg = f"[{(time.time() - T0) / 60:6.1f} min] " + " ".join(str(x) for x in a)
    print(msg, flush=True)
    LOG.append(msg)


REPO = "https://raw.githubusercontent.com/ABRUBAB/ShadowAstra_Atlas/main/"
TARGETS = {  # website targets (src/data/sites.ts)
    "shackleton": ("moon", -89.67, 129.78), "malapert": ("moon", -86.0, -2.9), "haworth": ("moon", -87.4, -5.0),
    "mons-mouton": ("moon", -84.6, 31.0), "nobile": ("moon", -85.2, 53.5), "de-gerlache": ("moon", -88.5, -87.1),
    "cabeus": ("moon", -84.68, -48.7), "marius-pit": ("moon", 14.1, -56.8), "tranquillitatis-pit": ("moon", 8.33, 33.22),
    "hadley": ("moon", 26.13, 3.63), "jezero": ("mars", 18.38, 77.58), "gale": ("mars", -5.4, 137.8),
    "arcadia": ("mars", 46.7, -176.0), "deuteronilus": ("mars", 43.9, 22.0), "arsia": ("mars", -8.3, -120.1),
    "meridiani": ("mars", -1.95, -5.53), "utopia": ("mars", 25.07, 109.93), "mawrth": ("mars", 22.6, -16.5),
}


def find(name):
    hits = sorted(glob.glob(f"/kaggle/input/**/{name}", recursive=True)) + sorted(glob.glob(f"{OUT}/**/{name}", recursive=True))
    return hits[0] if hits else None


def get(url, timeout=300):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "ShadowAstra-Atlas"}), timeout=timeout).read()


def train():
    src = OUT / "k3_train_ddp.py"
    src.write_text(TRAIN_SRC, encoding="utf-8")
    env = dict(os.environ, SA_OUT=str(OUT), SA_DEADLINE=str(T0 + TIME_BUDGET_H * 3600 * TRAIN_SHARE))
    import torch

    n = torch.cuda.device_count()
    log(f"GPUs: {n} · training until {TIME_BUDGET_H * TRAIN_SHARE:.1f} h into the session")
    cmd = [sys.executable, "-m", "torch.distributed.run", "--standalone", f"--nproc_per_node={n}", str(src)] if n > 1 else [sys.executable, str(src)]
    r = subprocess.run(cmd, env=env)
    log(f"training exit code {r.returncode}")


def embed_all():
    import numpy as np
    import torch
    import torch.nn.functional as F
    import timm

    os.environ.setdefault("SA_OUT", str(OUT))
    os.environ.setdefault("SA_DEADLINE", "0")
    ns = {}
    exec(compile(TRAIN_SRC, "train", "exec"), ns)
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    net = timm.create_model("vit_small_patch8_224", pretrained=False, img_size=96, in_chans=2, num_classes=0, dynamic_img_size=True).to(dev)
    net.load_state_dict(torch.load(OUT / "k3_teacher_backbone.pt", map_location=dev))
    net.eval()

    def emb(arr, size):
        out = np.zeros((len(arr), net.num_features), np.float16)
        for s in range(0, len(arr), 1024):
            h = torch.from_numpy(np.asarray(arr[s : s + 1024], dtype=np.float32)).to(dev).unsqueeze(1)
            if size != 96:
                h = F.interpolate(h, size=(96, 96), mode="area")
            x = ns["features"](h, torch.full((len(h),), 50.0 / 96, device=dev))
            with torch.no_grad(), torch.autocast(device_type=dev.type, dtype=torch.float16, enabled=dev.type == "cuda"):
                out[s : s + len(h)] = F.normalize(net(x).float(), dim=-1).cpu().numpy().astype(np.float16)
        return out

    E = {}
    for w in ("earth", "moon", "mars"):
        p = find(f"{w}_cells128.npy")
        if not p:
            log(f"no cells for {w}")
            continue
        E[w] = emb(np.load(p, mmap_mode="r"), 128)
        E[w + "_ll"] = np.load(find(f"{w}_cells128_ll.npy"))
        np.save(OUT / f"{w}_emb.npy", E[w])
        np.save(OUT / f"{w}_emb_ll.npy", E[w + "_ll"])
        log(f"{w}: {len(E[w])} embeddings")
    return E


def evaluate(E):
    import numpy as np
    import torch

    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    meta = json.loads(get(REPO + "public/data/grid.json"))
    buf = get(REPO + "public/data/grid.bin", timeout=600)
    m = meta["count"]
    mask = np.unpackbits(np.frombuffer(buf, np.uint8, count=meta["mask_bytes"]))[: meta["rows"] * meta["cols"]].astype(bool)
    p = np.nonzero(mask)[0][:m]
    row, col = p // meta["cols"], p % meta["cols"]
    lat, lon = 90 - (row + 0.5) * meta["res"], -180 + (col + 0.5) * meta["res"]
    keep = np.abs(lat) < 84.0  # the cells K2 cut, in the same order
    assert keep.sum() == len(E["earth"]), (keep.sum(), len(E["earth"]))
    Ee = torch.from_numpy(E["earth"].astype(np.float32)).to(dev)

    # the website's formula ground-shape score, for comparison
    lay = {f["name"]: f for f in meta["layout"]}

    def arr(name):
        f = lay[name]
        return np.frombuffer(buf, dtype=np.dtype(f["dtype"]), count=m, offset=f["offset"]).astype(np.float32)

    H = np.stack([arr(f"h{b}") / 254 for b in range(8)], 1)
    relief = np.maximum(arr("f_relief"), 1)
    tmeta = {t["id"]: t for t in meta["targets"]}

    def formula(tid):
        t = tmeta[tid]
        ov = np.minimum(H, np.array(t["terrain"]["hist"], np.float32)[None]).sum(1)
        rel = np.clip(1 - np.abs(np.log10(relief / max(t["terrain"]["relief"], 1))), 0, 1)
        return 0.65 * ov + 0.35 * rel

    def nearest(w, la, lo):
        ll = E[w + "_ll"]
        d = (ll[:, 0] - la) ** 2 + ((ll[:, 1] - lo + 180) % 360 - 180) ** 2 * math.cos(math.radians(la)) ** 2
        return int(np.argmin(d))

    sims, maps = {}, {}
    for tid, (w, la, lo) in TARGETS.items():
        if w not in E:
            continue
        q = torch.from_numpy(E[w][nearest(w, la, lo)].astype(np.float32)).to(dev)
        s = np.full(m, -1.0, np.float32)
        s[keep] = (Ee @ q).cpu().numpy()
        sims[tid] = s
        r = s.argsort().argsort() / (m - 1)
        maps[tid] = np.clip(np.round(r * 254), 0, 254).astype(np.uint8)
    np.savez_compressed(OUT / "shape_ssl.npz", ids=np.array(list(maps)), maps=np.stack(list(maps.values())))
    log(f"similarity maps for {len(maps)} targets")

    # top Earth twins for every Moon and Mars cell
    for w in ("moon", "mars"):
        if w not in E:
            continue
        Q = torch.from_numpy(E[w].astype(np.float32)).to(dev)
        idx, val = [], []
        for s in range(0, len(Q), 2048):
            v, i = torch.topk(Q[s : s + 2048] @ Ee.T, 5, dim=1)
            idx.append(i.cpu().numpy())
            val.append(v.cpu().numpy())
        full = np.nonzero(keep)[0]
        np.savez_compressed(OUT / f"{w}_twins.npz", ll=E[w + "_ll"], cell=full[np.concatenate(idx)].astype(np.int32), sim=np.concatenate(val).astype(np.float16))
        log(f"{w}: Earth twins for {len(Q)} cells")

    # how well do the three worlds mix? share of 10 nearest neighbours from the same world
    rng = np.random.default_rng(0)
    pools = {w: torch.from_numpy(E[w][rng.choice(len(E[w]), min(4000, len(E[w])), replace=False)].astype(np.float32)).to(dev) for w in ("earth", "moon", "mars") if w in E}
    allv = torch.cat(list(pools.values()))
    lab = torch.cat([torch.full((len(v),), i) for i, v in enumerate(pools.values())]).to(dev)
    nn_ = torch.topk(allv @ allv.T, 11, dim=1).indices[:, 1:]
    same = (lab[nn_] == lab[:, None]).float().mean().item()

    # known sites and expert pairs: embedding vs formula, rank among all land (lower is better)
    def top_pct(s, k):
        return float(100 * (s > s[k]).mean())

    def cell_of(la, lo):
        d = (lat - la) ** 2 + ((lon - lo + 180) % 360 - 180) ** 2
        return int(np.argmin(d))

    cat_src = get(REPO + "pipeline/catalogue.py").decode()
    ns = {}
    exec(compile(cat_src, "catalogue", "exec"), ns)
    known = [(a[0], a[2], a[3], a[4].split(",")) for a in ns["KNOWN_ANALOGS"]]
    indep = [(a[0], a[2], a[3], [a[4]]) for a in ns["VALIDATION_SITES"]]
    world_t = {w: [t for t, v in TARGETS.items() if v[0] == w and t in sims] for w in ("moon", "mars")}
    best = {w: np.max(np.stack([sims[t] for t in world_t[w]]), 0) for w in world_t if world_t[w]}
    bestf = {w: np.max(np.stack([formula(t) for t in world_t[w]]), 0) for w in world_t if world_t[w]}

    def site_ranks(sites):
        rows = []
        for sid, la, lo, ws in sites:
            k = cell_of(la, lo)
            for w in ws:
                if w in best:
                    rows.append({"id": sid, "world": w, "ssl": round(top_pct(best[w], k), 1), "formula": round(top_pct(bestf[w], k), 1)})
        return rows

    kr, ir = site_ranks(known), site_ranks(indep)
    sites_ts = get(REPO + "src/data/sites.ts").decode()
    pat = re.compile(r'id: "([^"]+)",\s*name: "[^"]+",\s*country: "[^"]*",\s*lat: (-?[\d.]+),\s*lon: (-?[\d.]+),.*?pairs: \[([^\]]*)\]', re.S)
    pairs = []
    for mm in pat.finditer(sites_ts):
        k = cell_of(float(mm.group(2)), float(mm.group(3)))
        for t in re.findall(r'"([^"]+)"', mm.group(4)):
            if t in sims:
                pairs.append({"earth": mm.group(1), "target": t, "ssl": round(top_pct(sims[t], k), 1), "formula": round(top_pct(formula(t), k), 1)})
    med = lambda rows, key: round(float(np.median([r[key] for r in rows])), 1) if rows else None  # noqa: E731
    ev = {
        "same_world_neighbours": round(same, 3),
        "chance_same_world": round(1 / len(pools), 3),
        "known_sites": {"n": len(kr), "ssl_median": med(kr, "ssl"), "formula_median": med(kr, "formula"), "rows": kr},
        "independent_sites": {"n": len(ir), "ssl_median": med(ir, "ssl"), "formula_median": med(ir, "formula"), "rows": ir},
        "expert_pairs": {"n": len(pairs), "ssl_median": med(pairs, "ssl"), "formula_median": med(pairs, "formula"), "rows": pairs},
    }
    (OUT / "k3_eval.json").write_text(json.dumps(ev, indent=1))
    log("evaluation:", json.dumps({k: (v if not isinstance(v, dict) else {kk: vv for kk, vv in v.items() if kk != "rows"}) for k, v in ev.items()}))


def main():
    if os.environ.get("SA_SMOKE") != "1" or not (OUT / "k3_teacher_backbone.pt").exists():
        train()
    if (OUT / "k3_teacher_backbone.pt").exists():
        E = embed_all()
        if "earth" in E:
            evaluate(E)
    (OUT / "k3_log.json").write_text(json.dumps({"log": LOG, "minutes": (time.time() - T0) / 60}, indent=1))
    log("K3 done")


main()
