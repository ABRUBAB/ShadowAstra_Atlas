"""Push, watch and collect ShadowAstra Kaggle notebooks from this PC.

Each notebook lives in kaggle/<name>/ with a script and kernel-metadata.template.json.
Credentials are never read or printed by this file: the Kaggle CLI reads kaggle.json
from the account's config folder.

    python kaggle/run.py push k1_worlds --account 1
    python kaggle/run.py status k1_worlds --account 1
    python kaggle/run.py output k1_worlds --account 1      # downloads to kaggle/_out/k1_worlds
    python kaggle/run.py whoami --account 2

Accounts: 1 → C:\\Users\\user\\.kaggle   2 → D:\\NASA_space_apps_challenge_2026\\_secrets\\kaggle2
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ACCOUNTS = {
    "1": Path.home() / ".kaggle",
    "2": Path(r"D:\NASA_space_apps_challenge_2026\_secrets\kaggle2"),
}


def env_for(account: str) -> dict:
    cfg = ACCOUNTS[account]
    if not (cfg / "kaggle.json").exists():
        sys.exit(f"No kaggle.json for account {account} in {cfg}")
    e = dict(os.environ)
    e["KAGGLE_CONFIG_DIR"] = str(cfg)
    return e


def username(account: str) -> str:
    # Only the public username is read, never the key.
    return json.loads((ACCOUNTS[account] / "kaggle.json").read_text(encoding="utf-8"))["username"]


def kaggle(args: list[str], account: str) -> int:
    return subprocess.call([sys.executable, "-m", "kaggle.cli", *args], env=env_for(account))


def build(name: str, account: str) -> Path:
    src = HERE / name
    meta = json.loads((src / "kernel-metadata.template.json").read_text(encoding="utf-8"))
    user = username(account)
    meta["id"] = f"{user}/{meta['slug']}"
    meta.pop("slug", None)
    # sources written as "{user}/..." follow the account that runs the notebook
    for key in ("kernel_sources", "dataset_sources"):
        meta[key] = [s.replace("{user}", user) for s in meta.get(key, [])]
    out = HERE / "_build" / name
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    shutil.copy(src / meta["code_file"], out / meta["code_file"])
    (out / "kernel-metadata.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["push", "status", "output", "whoami", "log"])
    ap.add_argument("name", nargs="?")
    ap.add_argument("--account", default="1", choices=list(ACCOUNTS))
    ap.add_argument("--timeout", type=int, default=0, help="session timeout in seconds (0 = Kaggle default)")
    a = ap.parse_args()
    if a.cmd == "whoami":
        print(username(a.account))
        return
    slug = json.loads((HERE / a.name / "kernel-metadata.template.json").read_text(encoding="utf-8"))["slug"]
    ref = f"{username(a.account)}/{slug}"
    if a.cmd == "push":
        folder = build(a.name, a.account)
        extra = ["--timeout", str(a.timeout)] if a.timeout else []
        sys.exit(kaggle(["kernels", "push", "-p", str(folder), *extra], a.account))
    if a.cmd == "status":
        sys.exit(kaggle(["kernels", "status", ref], a.account))
    if a.cmd in ("output", "log"):
        dest = HERE / "_out" / a.name
        dest.mkdir(parents=True, exist_ok=True)
        sys.exit(kaggle(["kernels", "output", ref, "-p", str(dest), "--force"], a.account))


if __name__ == "__main__":
    main()
