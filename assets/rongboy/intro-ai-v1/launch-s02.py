#!/usr/bin/env python3
"""Prepare, submit once, inspect or pull the authorized s02 F-path audition.

No network work happens during prepare. Do not call submit before s02 FIRST READY.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import time

BASE = Path(__file__).resolve().parent
HOST = "shouyun-4090"
PROJECT = "/data/app/huanghaibin/rongboy-intro-ai-v1-20261116"
INPUT = "/data/app/huanghaibin/input"
OUTPUT = "/data/app/huanghaibin/output"
HERO = Path("/Users/huanghaibin/Workspace/games/rongboy_fps/assets/rongboy/intro-ai-v1/cast/hero.png")
PREFIX = "rgintro_20261116_v1_"
MANIFEST = BASE / "s02-manifest.json"
RECEIPT = BASE / "s02-receipt.json"
PROMPT = """Keep the first frame exactly: the same handmade needle-felt explorer, the same face, yellow safari hat and goggles, yellow scarf, olive backpack, clothes, soft cream toy launcher, lighting and miniature setting. The only explorer has the exact face, costume and needle-felt materials shown in <Picture 1>. Use <Picture 1> for identity and costume only; keep the close framing and camera position of the first frame.
Move this finished tactile wool-felt miniature scene exactly like <Video 1>: preserve its camera move, screen direction, hand placement, staging and precise action timing. This is one continuous three-second loading close-up. Follow only the loading action visible in <Video 1>; the small yellow wool ball and the soft toy launcher keep the same physical positions and proportions. Keep both hands anatomically coherent. The camera does not cut or widen to a full-body view.
Handcrafted stop-motion feature-film quality, soft fuzzy wool fibres, visible seams, miniature cloth and paper props, warm cinematic light, shallow depth of field. Keep one explorer only; no other characters enter and no enemies are revealed. No morphing, no duplicated hands, no new props, no explosions, no firing in this loading shot. No captions, letters, logos, numbers, interface, watermarks or any on-screen writing. Sound: soft cloth handling and tiny toy-mechanism clicks only; no speech, no dialogue, no music.
"""


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1024 * 1024), b""):
            h.update(b)
    return h.hexdigest()


def write(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def run(args, capture=False):
    return subprocess.run([str(x) for x in args], check=True, text=True, capture_output=capture)


def probe(path):
    return json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path], True).stdout)


def prepare(first, guide):
    previous = json.loads(RECEIPT.read_text()) if RECEIPT.exists() else {}
    if previous.get("submission_attempted"):
        raise RuntimeError("An attempt exists; preserve its manifest and use status before any new preparation")
    for p in (first, guide, HERO):
        if not p.is_file():
            raise RuntimeError(f"Required final asset is not ready: {p}")
    plan = json.loads((BASE / "shot-plan.json").read_text())
    shot = next(x for x in plan["jobs"] if x["id"] == "s02")
    if shot["frames"] != 72 or shot["sec"] != 3 or shot["cast"] != ["hero"]:
        raise RuntimeError("s02 shot plan changed; review before launch")
    first_info = next(x for x in probe(first)["streams"] if x["codec_type"] == "video")
    if (first_info["width"], first_info["height"]) != (1024, 576):
        raise RuntimeError("Final first frame must already be 1024x576; normalize it before prepare")
    guide_info = next(x for x in probe(guide)["streams"] if x["codec_type"] == "video")
    if guide_info["r_frame_rate"] != "24/1":
        raise RuntimeError("The final guide must be 24 fps")
    if int(guide_info.get("nb_frames", 0)) < 73:
        raise RuntimeError("The guide must include at least 73 frames (s02's native H3 duration)")
    staged = BASE / "s02-staged"
    staged.mkdir(exist_ok=True)
    source_hash = digest(guide)
    silent = staged / f"s02-silent-{source_hash[:16]}.mp4"
    if not silent.exists():
        tmp = staged / f".s02-silent-{source_hash[:16]}.tmp.mp4"
        run(["ffmpeg", "-nostdin", "-v", "error", "-n", "-i", guide, "-f", "lavfi", "-i",
             "anullsrc=r=48000:cl=stereo", "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
             "-c:a", "aac", "-b:a", "128k", "-shortest", tmp])
        os.replace(tmp, silent)
    # Check reference audio really decodes as silence, not merely that an audio stream exists.
    audio = subprocess.run(["ffmpeg", "-nostdin", "-v", "info", "-i", str(silent), "-vn", "-af",
                            "volumedetect", "-f", "null", "-"], capture_output=True, text=True, check=True)
    if not any(x in audio.stderr for x in ("max_volume: -91.0 dB", "max_volume: -inf dB")):
        raise RuntimeError("Prepared reference audio was not verified silent")
    assets = []
    for role, path in (("first", first), ("hero", HERO), ("guide", silent)):
        sha = digest(path)
        name = f"{PREFIX}s02_{role}_{sha[:16]}{path.suffix.lower()}"
        assets.append({"role": role, "local": str(path.resolve()), "remote": f"{INPUT}/{name}", "sha256": sha})
    prompt_path = staged / "prompt.txt"
    approved_prompt = BASE / "jobs/s02.txt"
    if not approved_prompt.is_file() or not approved_prompt.read_text().strip():
        raise RuntimeError("The approved /tmp/rongboy-intro-ai/jobs/s02.txt is required")
    prompt_path.write_text(approved_prompt.read_text())
    payload = {"shot": "s02", "recipe": {"w": 1024, "h": 576, "sec": 3.0, "steps": 8, "seed": 7},
               "assets": assets, "prompt_sha256": digest(prompt_path), "source_guide_sha256": source_hash,
               "shot_plan_sha256": digest(BASE / "shot-plan.json"), "remote_driver_sha256": digest(BASE / "remote-s02.py")}
    run_id = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:16]
    remote_dir = f"{PROJECT}/s02/{run_id}"
    payload.update(run_id=run_id, remote_dir=remote_dir,
                   output_prefix=f"rongboy-intro-ai-v1-20261116/s02/{PREFIX}s02_s7_{run_id}")
    config = staged / f"config-{run_id}.json"
    write(config, payload)
    payload["local_config"] = str(config)
    payload["local_prompt"] = str(prompt_path)
    write(MANIFEST, payload)
    if not RECEIPT.exists():
        write(RECEIPT, {"phase": "prepared_waiting_for_explicit_s02_first_READY", "shot": "s02",
                        "run_id": run_id, "created": time.time(), "manifest": str(MANIFEST), "prompt_ids": []})
    print(json.dumps({"phase": "prepared", "manifest": str(MANIFEST), "run_id": run_id,
                      "first": str(first), "guide_with_verified_silent_audio": str(silent),
                      "native_frames": 73, "final_edit_frames": 72, "remote_dir": remote_dir}, indent=2))


def ssh(command):
    return run(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", HOST, command], True).stdout


def submit():
    cfg = json.loads(MANIFEST.read_text())
    old = json.loads(RECEIPT.read_text()) if RECEIPT.exists() else {}
    if old.get("submission_attempted"):
        raise RuntimeError("Submission was already attempted; use status, never resubmit automatically")
    remote = cfg["remote_dir"]
    ssh(f"mkdir -p {shlex.quote(remote)}")
    for item in cfg["assets"]:
        if digest(item["local"]) != item["sha256"]:
            raise RuntimeError(f"Local asset changed after prepare: {item['local']}")
        run(["rsync", "-a", "--ignore-existing", item["local"], f"{HOST}:{item['remote']}"])
    for source, dest in ((cfg["local_config"], "config.json"), (cfg["local_prompt"], "prompt.txt"),
                         (str(BASE / "remote-s02.py"), "remote-s02.py")):
        run(["rsync", "-a", "--ignore-existing", source, f"{HOST}:{remote}/{dest}"])
    # Verify the uploaded driver before executing it; immutable names never overwrite different bytes.
    check = "import hashlib,pathlib; p=pathlib.Path(" + repr(remote + "/remote-s02.py") + "); assert hashlib.sha256(p.read_bytes()).hexdigest()==" + repr(cfg["remote_driver_sha256"])
    ssh("python3 -c " + shlex.quote(check))
    old.update(phase="remote_start_requested", run_id=cfg["run_id"], submission_attempted=True,
               remote_dir=remote, submission_attempted_at=time.time())
    write(RECEIPT, old)
    try:
        result = json.loads(ssh("/home/huanghaibin/envs/comfy/bin/python " + shlex.quote(remote + "/remote-s02.py") + " start"))
    except Exception as exc:
        old.update(phase="remote_start_outcome_unknown_do_not_retry", error=str(exc))
        write(RECEIPT, old)
        raise
    if result.get("phase") == "waiting_for_idle_gpu":
        # No h3run process or POST was made. This is the one unambiguous wait result.
        old["submission_attempted"] = False
    old.update(phase=result["phase"], remote_start=result)
    write(RECEIPT, old)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def status():
    cfg = json.loads(MANIFEST.read_text())
    remote = cfg["remote_dir"]
    result = json.loads(ssh("/home/huanghaibin/envs/comfy/bin/python " + shlex.quote(remote + "/remote-s02.py") + " status"))
    old = json.loads(RECEIPT.read_text()) if RECEIPT.exists() else {}
    h = result.get("h3") or {}
    ids = list(dict.fromkeys(old.get("prompt_ids", []) + [h[k] for k in ("token", "prompt_id") if h.get(k)]))
    old.update(remote_status=result, prompt_ids=ids, last_readback=time.time())
    if h.get("phase"):
        old["phase"] = h["phase"]
    history = result.get("history") or {}
    if history.get("status", {}).get("status_str") == "success":
        old.update(phase="completed", outputs=history.get("outputs", h.get("outputs", [])))
    write(RECEIPT, old)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return old


def pull():
    data = status()
    if data.get("phase") != "completed":
        raise RuntimeError("Exact prompt history has not confirmed success")
    local = BASE / "s02-output"
    local.mkdir(exist_ok=True)
    files = []
    cfg = json.loads(MANIFEST.read_text())
    known_inputs = {Path(item["remote"]).name for item in cfg["assets"]}
    for name in data.get("outputs", []):
        if not name.endswith(".mp4"):
            continue
        # LoadVideo also returns its input filename in Comfy history; it is not a generated output.
        if name in known_inputs:
            continue
        path = Path(name)
        if path.is_absolute() or ".." in path.parts or not name.startswith("rongboy-intro-ai-v1-20261116/s02/"):
            raise RuntimeError("Unexpected output path in receipt")
        target = local / path.name
        run(["rsync", "-a", "--ignore-existing", f"{HOST}:{OUTPUT}/{name}", target])
        files.append({"remote": f"{OUTPUT}/{name}", "local": str(target), "sha256": digest(target), "probe": probe(target)})
    data.update(local_outputs=files)
    write(RECEIPT, data)
    print(json.dumps({"downloaded": [{k: x[k] for k in ("remote", "local", "sha256")} for x in files]}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("prepare", "submit", "status", "pull"))
    parser.add_argument("--first", type=Path, default=BASE / "firstframes/s02_paint.png")
    parser.add_argument("--guide", type=Path, default=BASE / "guides/s02.mp4")
    a = parser.parse_args()
    if a.action == "prepare":
        prepare(a.first, a.guide)
    elif a.action == "submit":
        submit()
    elif a.action == "status":
        status()
    else:
        pull()
