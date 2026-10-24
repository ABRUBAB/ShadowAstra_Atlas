"""Step 16 · Add the Kaggle K5 model comparison to public/data/validation.json.

    python kaggle/run.py fetch k5_models --account 2 --only "*.json"
    python pipeline/s16_model_zoo.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
k5 = json.loads((ROOT / "kaggle" / "_out" / "k5_models" / "k5_results.json").read_text(encoding="utf-8"))
vp = ROOT / "public" / "data" / "validation.json"
v = json.loads(vp.read_text(encoding="utf-8"))
NAMES = {"lgbm": "LightGBM (the earlier site model)", "xgb": "XGBoost", "cat": "CatBoost", "et": "ExtraTrees", "logreg": "Logistic regression",
         "nnpu": "nnPU neural network", "knn": "Nearest known site", "lgbm_tuned": "LightGBM, tuned (Optuna)", "xgb_tuned": "XGBoost, tuned (Optuna)", "ensemble": "Ensemble of the best three (on the site now)"}
rows = []
for key, r in k5["results"].items():
    rows.append({"id": key, "name": NAMES.get(key, key), "hidden": r["hidden"]["median"], "hidden_ci": r["hidden"]["ci"], "hidden_top10": r["hidden"]["top10"],
                 "independent": r.get("independent", {}).get("median"), "independent_ci": r.get("independent", {}).get("ci"), "members": r.get("members")})
rows.sort(key=lambda x: x["hidden"])
v["model_zoo"] = {"rows": rows, "chosen": k5["chosen_on_hidden_known"], "minutes": round(k5["minutes"])}
vp.write_text(json.dumps(v, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print("model_zoo:", [(r["id"], r["hidden"], r["independent"]) for r in rows])
