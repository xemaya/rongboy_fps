#!/usr/bin/env python3
"""Single-shot runner using the installed h3run.py; never retries a submission."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

BASE = Path(__file__).resolve().parent
CONFIG = BASE / "config.json"
STATE = BASE / "launcher-receipt.json"
H3_RECEIPT = BASE / "h3-receipt.json"
SAFE_PORTS = (8188, 8189, 8190, 8192, 8194)
RUNNER = Path("/home/huanghaibin/bin/h3run.py")
PYTHON = "/home/huanghaibin/envs/comfy/bin/python"


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def write(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def get(port, path):
    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=10) as r:
        return json.load(r)


def status():
    data = {"run_dir": str(BASE), "launcher": json.loads(STATE.read_text()) if STATE.exists() else None,
            "h3": json.loads(H3_RECEIPT.read_text()) if H3_RECEIPT.exists() else None}
    h = data["h3"]
    if h and h.get("prompt_id") and h.get("port") in SAFE_PORTS:
        try:
            pid = h["prompt_id"]
            history = get(h["port"], f"/history/{pid}").get(pid)
            if history:
                paths = []
                for output in history.get("outputs", {}).values():
                    for value in output.values():
                        if isinstance(value, list):
                            for item in value:
                                if isinstance(item, dict) and "filename" in item:
                                    paths.append(str(Path(item.get("subfolder", "")) / item["filename"]))
                data["history"] = {"status": history.get("status"), "outputs": paths}
            else:
                q = get(h["port"], "/queue")
                data["queue_location"] = next((key for key in ("queue_running", "queue_pending")
                                               if any(len(row) > 1 and row[1] == pid for row in q.get(key, []))), None)
        except Exception as exc:
            data["readback_error"] = str(exc)
    return data


def start():
    cfg = json.loads(CONFIG.read_text())
    if cfg["shot"] != "s02" or cfg["recipe"] != {"w": 1024, "h": 576, "sec": 3.0, "steps": 8, "seed": 7}:
        raise RuntimeError("This launcher accepts only the authorized s02 recipe")
    script = RUNNER.read_text()
    if not all(x in script for x in ("if a.first and (a.ref or a.refvideo)", "frame_idx=0", 'ap.add_argument("--receipt"')):
        raise RuntimeError("Installed h3run.py no longer has the required F path and receipt support")
    if not Path("/home/huanghaibin/bin/director_receipt.py").is_file():
        raise RuntimeError("Existing durable h3 receipt helper is missing")
    for item in cfg["assets"]:
        p = Path(item["remote"])
        if not p.is_file() or digest(p) != item["sha256"]:
            raise RuntimeError(f"Remote asset mismatch: {p}")
    prompt = BASE / "prompt.txt"
    if digest(prompt) != cfg["prompt_sha256"]:
        raise RuntimeError("Remote prompt checksum mismatch")
    with open(BASE / "launch.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if (BASE / "attempted").exists() or H3_RECEIPT.exists() or STATE.exists():
            raise RuntimeError("An attempt is already recorded; use status, never resubmit automatically")
        snapshots = []
        selected = None
        for port in SAFE_PORTS:
            try:
                q = get(port, "/queue")
                empty = not q.get("queue_running") and not q.get("queue_pending")
                snapshots.append({"port": port, "running": len(q.get("queue_running", [])),
                                  "pending": len(q.get("queue_pending", [])), "at": time.time()})
                if empty:
                    selected = port
                    break
            except Exception as exc:
                snapshots.append({"port": port, "error": str(exc), "at": time.time()})
        if selected is None:
            print(json.dumps({"phase": "waiting_for_idle_gpu", "queues": snapshots}))
            return
        # Verify the selected port still belongs to the expected physical GPU.
        gpu = selected - 8188
        processes = subprocess.run(["nvidia-smi", "--query-compute-apps=gpu_uuid,pid,process_name",
                                    "--format=csv,noheader,nounits"], capture_output=True, text=True, check=True).stdout
        gpu_map = subprocess.run(["nvidia-smi", "--query-gpu=index,uuid", "--format=csv,noheader,nounits"],
                                 capture_output=True, text=True, check=True).stdout
        target_uuid = dict((int(row.split(",")[0].strip()), row.split(",")[1].strip())
                           for row in gpu_map.splitlines() if row.strip())[gpu]
        if any(target_uuid in row and "llama" in row.lower() for row in processes.splitlines()):
            raise RuntimeError("Selected GPU now has a llama process; aborting")
        confirmed_mapping = False
        for row in processes.splitlines():
            columns = [x.strip() for x in row.split(",", 2)]
            if len(columns) != 3 or columns[0] != target_uuid:
                continue
            proc = Path("/proc") / columns[1]
            try:
                argv = proc.joinpath("cmdline").read_bytes().decode().split("\0")
                if "--port" not in argv or argv[argv.index("--port") + 1] != str(selected):
                    continue
                env = proc.joinpath("environ").read_bytes().decode().split("\0")
                confirmed_mapping = f"CUDA_VISIBLE_DEVICES={gpu}" in env and any(x.endswith("main.py") for x in argv)
                if confirmed_mapping:
                    break
            except (OSError, ValueError, IndexError):
                continue
        if not confirmed_mapping:
            raise RuntimeError("Safe port to physical GPU mapping could not be confirmed; aborting")
        # Last API action before the single launch is the fresh queue read.
        q = get(selected, "/queue")
        if q.get("queue_running") or q.get("queue_pending"):
            print(json.dumps({"phase": "waiting_for_idle_gpu", "port": selected, "reason": "queue_changed"}))
            return
        names = {x["role"]: Path(x["remote"]).name for x in cfg["assets"]}
        cmd = [PYTHON, str(RUNNER), "--receipt", str(H3_RECEIPT), "--port", str(selected),
               "--prompt-file", str(prompt), "--unet", "minimax_h3_fl2va_pruned_fp8_scaled.safetensors",
               "--lora", "minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors:1",
               "--first", names["first"], "--ref", names["hero"], "--refvideo", names["guide"],
               "--w", "1024", "--h", "576", "--sec", "3", "--steps", "8", "--seed", "7",
               "--sampler", "res_multistep", "--scheduler", "simple", "--prefix", cfg["output_prefix"]]
        marker = os.open(BASE / "attempted", os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(marker)
        state = {"phase": "launching", "shot": "s02", "at": time.time(), "port": selected, "gpu": gpu,
                 "queue_snapshots": snapshots, "argv": cmd, "config_sha256": digest(CONFIG),
                 "h3run_sha256": digest(RUNNER), "output_prefix": cfg["output_prefix"]}
        write(STATE, state)
        with open(BASE / "h3run.log", "ab", buffering=0) as log:
            proc = subprocess.Popen(cmd, cwd="/home/huanghaibin/bin", stdin=subprocess.DEVNULL,
                                    stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        state.update(phase="runner_started", pid=proc.pid)
        write(STATE, state)
    print(json.dumps(state, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("start", "status"))
    a = parser.parse_args()
    if a.action == "status":
        print(json.dumps(status(), ensure_ascii=False))
    else:
        start()
