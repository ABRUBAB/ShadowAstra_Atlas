"""Push, watch and collect ShadowAstra Kaggle notebooks from this PC.

Each notebook lives in kaggle/<name>/ with a script and kernel-metadata.template.json.
Credentials are never read or printed by this file. Each account has its own folder
outside the repo holding an `access_token` file (a Kaggle API token). The CLI is given
the *path* to that file through KAGGLE_API_TOKEN, so the token itself never appears in
an environment variable, a command line or a log.

    python kaggle/run.py push k1_worlds --account 1
    python kaggle/run.py status k1_worlds --account 1
    python kaggle/run.py files k1_worlds --account 1       # list output files
    python kaggle/run.py fetch k1_worlds --account 1 --only "*.npz,*.json"   # selected files → kaggle/_out/k1_worlds
    python kaggle/run.py output k1_worlds --account 1      # everything (can be many GB)
    python kaggle/run.py whoami --account 2

Accounts: 1 and 2 → D:\\NASA_space_apps_challenge_2026\\_secrets\\kaggle1 and kaggle2
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
SECRETS = Path(r"D:\NASA_space_apps_challenge_2026\_secrets")
ACCOUNTS = {"1": SECRETS / "kaggle1", "2": SECRETS / "kaggle2"}


def env_for(account: str) -> dict:
    cfg = ACCOUNTS[account]
    token = cfg / "access_token"
    if not token.exists():
        sys.exit(f"No access_token for account {account} in {cfg}")
    e = {k: v for k, v in os.environ.items() if not k.startswith("KAGGLE_")}
    e["KAGGLE_CONFIG_DIR"] = str(cfg)
    e["KAGGLE_API_TOKEN"] = str(token)  # a path: the SDK reads the file itself
    e["PYTHONIOENCODING"] = "utf-8"
    return e


def username(account: str) -> str:
    """The account's public username, asked from Kaggle once and cached next to the token."""
    cache = ACCOUNTS[account] / "username"
    if cache.exists():
        return cache.read_text(encoding="utf-8").strip()
    # importing kaggle authenticates once (and then drops the token variable), so reuse that client
    code = "import kaggle; print(kaggle.api.config_values['username'])"
    out = subprocess.run([sys.executable, "-c", code], env=env_for(account), capture_output=True, text=True)
    lines = out.stdout.strip().splitlines()
    name = lines[-1].strip() if out.returncode == 0 and lines else ""
    if not name:
        sys.exit(f"Kaggle did not accept the token for account {account}.")
    cache.write_text(name, encoding="utf-8")
    return name


def kaggle(args: list[str], account: str) -> int:
    return subprocess.call([sys.executable, "-m", "kaggle.cli", *args], env=env_for(account))


# Lists a kernel's output files and downloads only those matching the patterns
# (the CLI's `kernels output` always downloads everything, which can be many GB).
FETCH = r"""
import fnmatch, os, sys, requests, kaggle
from kagglesdk.kernels.types.kernels_api_service import ApiListKernelSessionOutputRequest
owner, slug, dest, pats, listonly = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4].split(","), sys.argv[5] == "1"
token = None
with kaggle.api.build_kaggle_client() as k:
    while True:
        r = ApiListKernelSessionOutputRequest(); r.user_name = owner; r.kernel_slug = slug
        if token: r.page_token = token
        resp = k.kernels.kernels_api_client.list_kernel_session_output(r)
        for f in resp.files:
            hit = any(fnmatch.fnmatch(f.file_name, p) for p in pats)
            print(("GET  " if hit and not listonly else "     ") + f.file_name)
            if hit and not listonly:
                out = os.path.join(dest, f.file_name)
                os.makedirs(os.path.dirname(out), exist_ok=True)
                with requests.get(f.url, stream=True) as d, open(out, "wb") as o:
                    for chunk in d.iter_content(1 << 20):
                        o.write(chunk)
        if resp.log:
            open(os.path.join(dest, slug + ".log"), "w", encoding="utf-8").write(resp.log)
        token = resp.next_page_token
        if not token:
            break
"""


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
    ap.add_argument("cmd", choices=["push", "status", "output", "fetch", "files", "whoami", "log", "cli"])
    ap.add_argument("name", nargs="?")
    ap.add_argument("--account", default="1", choices=list(ACCOUNTS))
    ap.add_argument("--timeout", type=int, default=0, help="session timeout in seconds (0 = Kaggle default)")
    ap.add_argument("--only", default="*.json,*.npz,*.log", help="fetch: comma-separated file patterns")
    a, rest = ap.parse_known_args()  # for `cli`, unknown arguments go straight to the Kaggle CLI
    if a.cmd == "whoami":
        print(username(a.account))
        return
    if a.cmd == "cli":
        sys.exit(kaggle([a.name, *rest] if a.name else rest, a.account))
    slug = json.loads((HERE / a.name / "kernel-metadata.template.json").read_text(encoding="utf-8"))["slug"]
    ref = f"{username(a.account)}/{slug}"
    if a.cmd == "push":
        folder = build(a.name, a.account)
        extra = ["--timeout", str(a.timeout)] if a.timeout else []
        sys.exit(kaggle(["kernels", "push", "-p", str(folder), *extra], a.account))
    if a.cmd == "status":
        sys.exit(kaggle(["kernels", "status", ref], a.account))
    if a.cmd in ("fetch", "files"):
        dest = HERE / "_out" / a.name
        dest.mkdir(parents=True, exist_ok=True)
        owner, kslug = ref.split("/")
        args = [sys.executable, "-c", FETCH, owner, kslug, str(dest), a.only, "1" if a.cmd == "files" else "0"]
        sys.exit(subprocess.call(args, env=env_for(a.account)))
    if a.cmd in ("output", "log"):
        dest = HERE / "_out" / a.name
        dest.mkdir(parents=True, exist_ok=True)
        sys.exit(kaggle(["kernels", "output", ref, "-p", str(dest), "--force"], a.account))


if __name__ == "__main__":
    main()
