# ShadowAstra Atlas · K5 · Which model finds analog sites best?
#
# Positive-unlabelled learning: 38 published analog sites are the positives, the other
# 80,000 land places are unlabelled. Every model below is trained and tested the same way:
#   * hidden known sites: hide each site and every known site within 300 km, retrain, and
#     ask where the hidden one ranks among all land (the website's test, 50 site-world pairs)
#   * independent sites: 28 published sites never used for anything, scored by a model
#     trained on all known sites (the final, untouched test)
# Optuna tunes LightGBM and XGBoost on the hidden known sites only; the independent sites are
# checked once at the end. Models: LightGBM, XGBoost, CatBoost, ExtraTrees, logistic
# regression, a non-negative PU neural network (nnPU, Kiryo et al. 2017), a nearest-known-site
# baseline, and a rank-average ensemble of the best three.

import glob
import json
import math
import os
import time
import warnings
import zlib

import numpy as np

warnings.filterwarnings("ignore")
T0 = time.time()
OUT = "/kaggle/working" if os.path.exists("/kaggle/working") else "./k5_out"
os.makedirs(OUT, exist_ok=True)
LOG = []
SMOKE = os.environ.get("SA_SMOKE") == "1"
TRIALS = 4 if SMOKE else int(os.environ.get("SA_TRIALS", 30))


def log(*a):
    msg = f"[{(time.time() - T0) / 60:6.1f} min] " + " ".join(str(x) for x in a)
    print(msg, flush=True)
    LOG.append(msg)


def find(name):
    hits = sorted(glob.glob(f"/kaggle/input/**/{name}", recursive=True)) + sorted(glob.glob(f"./**/{name}", recursive=True))
    return hits[0]


Z = np.load(find("features.npz"))
X, NAMES, LAT, LON = Z["X"].astype(np.float32), [str(x) for x in Z["names"]], Z["lat"], Z["lon"]
SITES = json.load(open(find("sites.json")))
N = len(X)
log(f"{N} places × {X.shape[1]} features")


def hav(la1, lo1, la2, lo2):
    p1, p2 = np.radians(la1), np.radians(la2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(lo2 - lo1) / 2) ** 2
    return 2 * 6371 * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def pct_rank(x):
    o = np.argsort(np.argsort(x, kind="stable"), kind="stable")
    return (o / (len(x) - 1)).astype(np.float32)


# ------------------------------------------------------------------ models (fit on idx with labels y and weights w, predict all)
def m_lgbm(params=None):
    import lightgbm as lgb

    p = dict(objective="binary", learning_rate=0.05, num_leaves=15, min_data_in_leaf=5, feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0, verbose=-1, num_threads=4)
    rounds = 220
    if params:
        p.update({k: v for k, v in params.items() if k != "rounds"})
        rounds = params.get("rounds", rounds)

    def fit(Xt, y, w, seed):
        m = lgb.train({**p, "seed": seed}, lgb.Dataset(Xt, y, weight=w), num_boost_round=rounds)
        return m.predict

    return fit


def m_xgb(params=None):
    import xgboost as xgb

    p = dict(max_depth=4, learning_rate=0.05, n_estimators=300, subsample=0.8, colsample_bytree=0.8, reg_lambda=1.0, tree_method="hist", n_jobs=4, verbosity=0)
    if params:
        p.update(params)

    def fit(Xt, y, w, seed):
        m = xgb.XGBClassifier(**p, random_state=seed)
        m.fit(Xt, y, sample_weight=w)
        return lambda A: m.predict_proba(A)[:, 1]

    return fit


def m_cat():
    from catboost import CatBoostClassifier

    def fit(Xt, y, w, seed):
        m = CatBoostClassifier(iterations=400, depth=5, learning_rate=0.05, verbose=0, thread_count=4, random_seed=seed)
        m.fit(Xt, y, sample_weight=w)
        return lambda A: m.predict_proba(A)[:, 1]

    return fit


def m_et():
    from sklearn.ensemble import ExtraTreesClassifier

    def fit(Xt, y, w, seed):
        m = ExtraTreesClassifier(n_estimators=300, min_samples_leaf=3, max_features=0.5, n_jobs=4, random_state=seed)
        m.fit(np.nan_to_num(Xt), y, sample_weight=w)
        return lambda A: m.predict_proba(np.nan_to_num(A))[:, 1]

    return fit


def m_logreg():
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    def fit(Xt, y, w, seed):
        sc = StandardScaler().fit(np.nan_to_num(X))
        m = LogisticRegression(C=0.5, max_iter=3000)
        m.fit(sc.transform(np.nan_to_num(Xt)), y, sample_weight=w)
        return lambda A: m.predict_proba(sc.transform(np.nan_to_num(A)))[:, 1]

    return fit


def nnpu_scores(pos, seed, prior=0.003, epochs=40):
    """Non-negative PU risk with a small MLP on standardised features (all land is unlabelled)."""
    import torch
    import torch.nn as nn

    torch.manual_seed(seed)
    A = np.nan_to_num(X)
    mu, sd = A.mean(0), A.std(0) + 1e-6
    A = torch.tensor((A - mu) / sd, dtype=torch.float32)
    P = A[pos]
    net = nn.Sequential(nn.Linear(A.shape[1], 128), nn.ReLU(), nn.Dropout(0.1), nn.Linear(128, 64), nn.ReLU(), nn.Linear(64, 1))
    opt = torch.optim.Adam(net.parameters(), lr=1e-3, weight_decay=1e-4)
    sig = lambda z: torch.sigmoid(-z)  # noqa: E731  sigmoid loss for label +1
    rng = np.random.default_rng(seed)
    for _ in range(epochs):
        for _b in range(20):
            U = A[rng.choice(N, 2048, replace=False)]
            Pb = P[rng.choice(len(P), min(len(P), 64), replace=True)]
            gp, gu = net(Pb).squeeze(1), net(U).squeeze(1)
            r_pos = prior * sig(gp).mean()
            r_neg = sig(-gu).mean() - prior * sig(-gp).mean()
            loss = r_pos + torch.clamp(r_neg, min=0) if r_neg.item() >= 0 else -r_neg
            opt.zero_grad()
            loss.backward()
            opt.step()
    net.eval()
    import torch as _t

    with _t.no_grad():
        return net(A).squeeze(1).numpy()


def knn_scores(pos):
    A = np.nan_to_num(X)
    A = (A - A.mean(0)) / (A.std(0) + 1e-6)
    A = A / (np.linalg.norm(A, axis=1, keepdims=True) + 1e-9)
    sims = A @ A[pos].T
    return np.sort(sims, axis=1)[:, -3:].mean(1)


def pu_bag(fit_factory, pos, bags=4, seed=0):
    """Positive-unlabelled bagging, exactly like pipeline/s06_build.py."""
    rng = np.random.default_rng(seed)
    out = np.zeros(N)
    for b in range(bags):
        neg = np.setdiff1d(rng.choice(N, size=6000, replace=False), pos)
        idx = np.concatenate([pos, neg])
        y = np.concatenate([np.ones(len(pos)), np.zeros(len(neg))])
        w = np.concatenate([np.full(len(pos), len(neg) / max(1, len(pos)) / 4), np.ones(len(neg))])
        pred = fit_factory(X[idx], y, w, 7 + b)
        out += pred(X) / bags
    return out


def scores(name, pos, seed=0, params=None, bags=4):
    if name == "nnpu":
        return np.mean([nnpu_scores(pos, seed + b) for b in range(2)], 0)
    if name == "knn":
        return knn_scores(pos)
    f = {"lgbm": lambda: m_lgbm(params), "xgb": lambda: m_xgb(params), "cat": m_cat, "et": m_et, "logreg": m_logreg}[name]()
    return pu_bag(f, pos, bags=bags, seed=seed)


# ------------------------------------------------------------------ the two tests
KNOWN = {w: [(s[0], s[2], s[3], s[4]) for s in SITES["known"] if w in s[1]] for w in ("moon", "mars")}
INDEP = {w: [(s[0], s[2], s[3], s[4]) for s in SITES["validation"] if s[1] == w] for w in ("moon", "mars")}


def folds(world):
    pos = KNOWN[world]
    for h, (sid, k, la, lo) in enumerate(pos):
        train = [kk for (_s, kk, la2, lo2) in pos if hav(la, lo, la2, lo2) >= 300]
        yield sid, k, train


def rank_of(s, k, exclude):
    m = np.ones(N, bool)
    m[exclude] = False
    return float(100 * (s[m] > s[k]).mean())


def summary(ranks):
    r = np.asarray(ranks)
    boot = np.median(np.random.default_rng(0).choice(r, size=(2000, len(r))), axis=1)
    return {"median": round(float(np.median(r)), 2), "ci": [round(float(np.percentile(boot, 2.5)), 2), round(float(np.percentile(boot, 97.5)), 2)], "top10": round(100 * float(np.mean(r <= 10)), 1), "top1": round(100 * float(np.mean(r <= 1)), 1), "n": len(r)}


def evaluate(name, params=None, bags=4, keep=False, fold_cache=None):
    hidden, store = [], {}
    for world in ("moon", "mars"):
        for sid, k, train in folds(world):
            s = scores(name, np.array(train), seed=zlib.crc32(sid.encode()) % 1000, params=params, bags=bags)
            hidden.append(rank_of(s, k, train))
            if keep:
                store[(world, sid)] = (pct_rank(s), k, train)
    return summary(hidden), store


def independent(name, params=None):
    ranks, full = [], {}
    for world in ("moon", "mars"):
        pos = np.array([k for (_s, k, _a, _b) in KNOWN[world]])
        s = scores(name, pos, seed=11, params=params)
        full[world] = pct_rank(s)
        for sid, k, la, lo in INDEP[world]:
            ranks.append(rank_of(s, k, pos))
    return summary(ranks), full


def main():
    names = ["lgbm", "xgb", "cat", "et", "logreg", "nnpu", "knn"]
    if SMOKE:
        names = ["lgbm", "logreg", "knn"]
        for w in KNOWN:
            KNOWN[w] = KNOWN[w][:4]
    results, stores = {}, {}
    for nm in names:
        t = time.time()
        try:
            res, store = evaluate(nm, keep=True)
        except Exception as e:  # noqa: BLE001
            log(f"{nm} failed: {e!r}")
            continue
        results[nm] = {"hidden": res, "minutes": round((time.time() - t) / 60, 1)}
        stores[nm] = store
        log(f"{nm:7s} hidden known sites: median top {res['median']}%  CI {res['ci']}  top 10%: {res['top10']}%")

    # Optuna on the hidden known sites only
    try:
        import optuna

        optuna.logging.set_verbosity(optuna.logging.WARNING)
        for nm in ("lgbm", "xgb"):
            def objective(trial, nm=nm):
                if nm == "lgbm":
                    p = {"learning_rate": trial.suggest_float("learning_rate", 0.02, 0.15, log=True), "num_leaves": trial.suggest_int("num_leaves", 4, 48), "min_data_in_leaf": trial.suggest_int("min_data_in_leaf", 2, 40),
                         "feature_fraction": trial.suggest_float("feature_fraction", 0.4, 1.0), "lambda_l2": trial.suggest_float("lambda_l2", 1e-3, 30, log=True), "rounds": trial.suggest_int("rounds", 80, 600)}
                else:
                    p = {"max_depth": trial.suggest_int("max_depth", 2, 8), "learning_rate": trial.suggest_float("learning_rate", 0.02, 0.2, log=True), "n_estimators": trial.suggest_int("n_estimators", 80, 600),
                         "subsample": trial.suggest_float("subsample", 0.5, 1.0), "colsample_bytree": trial.suggest_float("colsample_bytree", 0.4, 1.0), "reg_lambda": trial.suggest_float("reg_lambda", 1e-3, 30, log=True),
                         "min_child_weight": trial.suggest_float("min_child_weight", 0.1, 20, log=True)}
                res, _ = evaluate(nm, params=p, bags=3)
                return res["median"] + 0.02 * (100 - res["top10"])

            st = optuna.create_study(direction="minimize", sampler=optuna.samplers.TPESampler(seed=1))
            st.optimize(objective, n_trials=TRIALS)
            best = st.best_params
            res, store = evaluate(nm, params=best, keep=True)
            key = f"{nm}_tuned"
            results[key] = {"hidden": res, "params": best}
            stores[key] = store
            log(f"{key:11s} hidden known sites: median top {res['median']}%  CI {res['ci']}  top 10%: {res['top10']}%  {best}")
    except Exception as e:  # noqa: BLE001
        log(f"optuna skipped: {e!r}")

    # rank-average ensemble of the three best (chosen on the hidden known sites)
    ranked = sorted(results, key=lambda n: (results[n]["hidden"]["median"], -results[n]["hidden"]["top10"]))
    top3 = ranked[:3]
    ens = []
    for key in stores[top3[0]]:
        s = np.mean([stores[n][key][0] for n in top3], 0)
        _r, k, train = stores[top3[0]][key]
        ens.append(rank_of(s, k, train))
    results["ensemble"] = {"hidden": summary(ens), "members": top3}
    log(f"ensemble {top3}: median top {results['ensemble']['hidden']['median']}%")

    # the untouched test, once, for every model
    fulls = {}
    for nm in [n for n in results if n != "ensemble"]:
        base = nm.replace("_tuned", "")
        res, full = independent(base, params=results[nm].get("params"))
        results[nm]["independent"] = res
        fulls[nm] = full
        log(f"{nm:11s} independent sites: median top {res['median']}%  CI {res['ci']}")
    ind = []
    for world in ("moon", "mars"):
        s = np.mean([fulls[n][world] for n in top3], 0)
        pos = np.array([k for (_s, k, _a, _b) in KNOWN[world]])
        fulls.setdefault("ensemble", {})[world] = s
        for sid, k, la, lo in INDEP[world]:
            ind.append(rank_of(s, k, pos))
    results["ensemble"]["independent"] = summary(ind)
    log(f"ensemble independent: median top {results['ensemble']['independent']['median']}%")

    best = min(results, key=lambda n: (results[n]["hidden"]["median"], -results[n]["hidden"]["top10"]))
    for world in ("moon", "mars"):
        np.save(os.path.join(OUT, f"k5_model_{world}.npy"), fulls[best][world].astype(np.float32))
    json.dump({"results": results, "chosen_on_hidden_known": best, "features": NAMES, "minutes": (time.time() - T0) / 60, "log": LOG}, open(os.path.join(OUT, "k5_results.json"), "w"), indent=1)
    log(f"K5 done · best on the hidden known sites: {best}")


main()
