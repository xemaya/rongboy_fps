#!/usr/bin/env python3
"""Original, deterministic score and material foley for Rongboy's 30 s intro.

Run with the Lemo core Python (numpy/scipy/soundfile) and ffmpeg on PATH:
    /Users/huanghaibin/lemo-opuscar/.venv/bin/python scenes/rongboy-intro/score.py

No samples, network services, speech, or external audio are used. cue-map.json
owns the duration, pauses, and action times. The musical material is an original
D-major toy/wood motif at 80 BPM, with a short B-minor/G detour for the reveal.
All synthesis is local; the only encoder/meter is ffmpeg. The temporary floating
mix and loudness passes are deleted automatically. The three delivered files are
out/mix.wav (24-bit / 48 kHz stereo), score.mp3, and out/audio-report.json.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile

import numpy as np
from scipy import signal
import soundfile as sf


HERE = Path(__file__).resolve().parent
SR = 48_000
SEED = 20261116
TARGET_I = -14.0
# Keep extra headroom for lossy preview encoding and the final film's AAC.
TARGET_TP = -1.7
RNG = np.random.default_rng(SEED)
TAU = 2 * np.pi


def frames(seconds: float) -> int:
    return round(seconds * SR)


def timebase(seconds: float) -> np.ndarray:
    return np.arange(frames(seconds), dtype=np.float64) / SR


def db(value: float) -> float:
    return float(20 * np.log10(max(float(value), 1e-15)))


def rms(audio: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(audio, dtype=np.float64))))


def edge(audio: np.ndarray, attack: float = 0.002, release: float = 0.025) -> np.ndarray:
    """Remove discontinuities without erasing short attacks."""
    audio = np.asarray(audio, dtype=np.float64).copy()
    a, r = min(frames(attack), len(audio)), min(frames(release), len(audio))
    if a > 1:
        audio[:a] *= np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if r > 1:
        audio[-r:] *= np.cos(np.linspace(0, np.pi / 2, r)) ** 2
    return audio


def unit(audio: np.ndarray) -> np.ndarray:
    return audio / max(np.max(np.abs(audio)), 1e-12)


def noise(seconds: float, low: float, high: float) -> np.ndarray:
    """Band limited noise, with enough leading samples for a settled filter."""
    n = frames(seconds)
    src = RNG.normal(0, 1, n + 1024)
    if low <= 0:
        sos = signal.butter(2, high, fs=SR, output="sos")
    else:
        sos = signal.butter(2, [low, high], btype="bandpass", fs=SR, output="sos")
    out = signal.sosfilt(sos, src)[1024:]
    # The level here is RMS rather than peak; a transient keeps its texture.
    return out / max(rms(out), 1e-12)


def modal(
    seconds: float,
    frequencies: list[float],
    weights: list[float],
    decays: list[float],
    bend: float = 0,
) -> np.ndarray:
    t = timebase(seconds)
    out = np.zeros_like(t)
    for f, w, decay in zip(frequencies, weights, decays):
        # A few cents of settling makes a struck object, without a long gliss.
        phase = TAU * (f * t + bend * 0.035 * (1 - np.exp(-t / 0.035)))
        out += w * np.sin(phase) * np.exp(-t / decay)
    return edge(out, 0.0007, 0.016)


def wood_pluck(midi: float, seconds: float = 0.85, low: bool = False) -> np.ndarray:
    """Damped string partials plus a short, noisy wooden soundboard exciter."""
    f = 440 * 2 ** ((midi - 69) / 12)
    t = timebase(seconds)
    result = np.zeros_like(t)
    pick = 0.23 + RNG.uniform(-0.025, 0.025)
    for h in range(1, 15):
        if f * h > 9500:
            break
        partial = np.sin(np.pi * h * pick) / (h ** (1.55 if low else 1.35))
        decay = (0.48 if low else 0.62) / (1 + (h - 1) * 0.25)
        phase = RNG.uniform(-0.018, 0.018)
        result += partial * np.sin(TAU * f * h * t + phase) * np.exp(-t / decay)
    # Body modes are quiet, short, and are not a synth pad.
    body = modal(seconds, [177, 398, 835], [0.08, 0.045, 0.018], [0.075, 0.045, 0.022])
    pick_noise = noise(seconds, 650, 5500) * np.exp(-t / 0.011) * 0.045
    result = result + body + pick_noise
    # Gentle magnetic/wood-like saturation only on the instrument.
    result = np.tanh(result * 1.18) / 1.18
    return edge(unit(result), 0.0015, 0.035)


def toy_chime(midi: float, seconds: float = 1.0) -> np.ndarray:
    """Small toy glock: decaying inharmonic modes and a soft mallet contact."""
    f = 440 * 2 ** ((midi - 69) / 12)
    t = timebase(seconds)
    out = modal(
        seconds,
        [f, f * 2.756, f * 5.404, f * 8.93],
        [1, 0.24, 0.055, 0.012],
        [0.32, 0.115, 0.055, 0.026],
    )
    out += 0.05 * noise(seconds, 800, 6000) * np.exp(-t / 0.007)
    return unit(edge(out, 0.001, 0.04))


def felt_tap(seconds: float = 0.16, pitch: float = 165) -> np.ndarray:
    t = timebase(seconds)
    knock = modal(seconds, [pitch, pitch * 2.16, 820], [1, 0.24, 0.07], [0.037, 0.024, 0.009])
    wool = noise(seconds, 350, 2100) * np.exp(-t / 0.023) * 0.22
    return unit(edge(knock + wool, 0.001, 0.015))


def cloth(seconds: float = 0.45, strength: float = 1.0) -> np.ndarray:
    t = timebase(seconds)
    # Multiple overlapping fleece-grain gestures, not white-noise whooshes.
    env = np.zeros_like(t)
    for center, width, weight in [(0.18, 0.12, 1), (0.46, 0.16, 0.65), (0.73, 0.11, 0.45)]:
        env += weight * np.exp(-0.5 * ((t / seconds - center) / width) ** 2)
    texture = 0.61 * noise(seconds, 620, 3700) + 0.30 * noise(seconds, 130, 620)
    grains = 0.79 + 0.16 * np.sin(TAU * 47 * t) + 0.05 * np.sin(TAU * 83 * t)
    return edge(texture * env * grains * 0.17 * strength, 0.006, 0.045)


def wood_click(seconds: float = 0.16, pitch: float = 620) -> np.ndarray:
    t = timebase(seconds)
    modes = modal(seconds, [pitch, pitch * 1.61, pitch * 2.87], [1, 0.35, 0.10], [0.025, 0.014, 0.008])
    return edge(modes * 0.42 + noise(seconds, 900, 6200) * np.exp(-t / 0.006) * 0.08, 0.0006, 0.02)


def thud(seconds: float, pitch: float, decay: float = 0.065) -> np.ndarray:
    t = timebase(seconds)
    phase = TAU * (pitch * t + pitch * 0.40 * 0.018 * (1 - np.exp(-t / 0.018)))
    return edge(
        (np.sin(phase) + 0.27 * np.sin(phase * 2.07)) * np.exp(-t / decay),
        0.0014,
        0.025,
    )


def overlay(dst: np.ndarray, src: np.ndarray, at: float, gain: float = 1) -> None:
    start = frames(at)
    end = min(len(dst), start + len(src))
    if end > start:
        dst[start:end] += src[:end-start] * gain


def foley(kind: str, pitch: float | None = None) -> tuple[np.ndarray, float, str]:
    """Return one mono gesture, its pan, and its plain material description."""
    if kind == "cloth":
        return cloth(0.43), -0.18, "short fleece and soft-palm friction"
    if kind == "load":
        out = np.zeros(frames(0.57))
        overlay(out, cloth(0.30, 0.8), 0, 1.2)
        overlay(out, wood_click(0.14, 575), 0.12, 0.8)
        overlay(out, thud(0.19, 128, 0.038), 0.205, 0.25)
        overlay(out, wood_click(0.10, 820), 0.27, 0.35)
        return out, -0.22, "felt ball compresses, wooden button clicks and seats"
    if kind == "door":
        seconds = 0.73
        t = timebase(seconds)
        # Stick-slip grains on a low wooden hinge, deliberately no shrill squeal.
        f = 155 + 18 * np.sin(TAU * 1.6 * t) + 22 * t
        phase = TAU * np.cumsum(f) / SR
        creak = (np.sin(phase) + 0.30 * np.sin(phase * 2.03))
        creak *= (0.55 + 0.45 * np.sin(TAU * (21 * t + 7 * t * t)) ** 2)
        env = np.sin(np.pi * np.minimum(t / 0.65, 1)) ** 1.7
        out = 0.105 * creak * env + 0.045 * noise(seconds, 350, 1800) * env
        overlay(out, wood_click(0.13, 470), 0.58, 0.27)
        return edge(out, 0.008, 0.05), -0.64, "small low wooden door hinge with soft latch"
    if kind == "step":
        out = np.zeros(frames(0.30))
        overlay(out, thud(0.22, RNG.uniform(104, 123), 0.047), 0, 0.28)
        overlay(out, cloth(0.18, 0.60), 0.014, 0.75)
        overlay(out, felt_tap(0.11, RNG.uniform(190, 240)), 0.047, 0.040)
        return out, 0, "soft felt foot compresses into a rug, short sole scuff"
    if kind == "gasp":
        # It is a little fabric-body squeeze; there is no human breath or voice.
        seconds = 0.26
        t = timebase(seconds)
        env = np.sin(np.pi * t / seconds) ** 1.7
        out = noise(seconds, 320, 2100) * env * 0.036
        out += 0.026 * thud(seconds, 185, 0.047)
        return edge(out, 0.012, 0.04), -0.10, "tiny fleece-body squeeze, no vocal sound"
    if kind == "shot":
        out = np.zeros(frames(0.46))
        overlay(out, thud(0.25, 89, 0.044), 0, 0.83)
        t = timebase(0.31)
        puff = noise(0.31, 240, 3400) * (1 - np.exp(-t / 0.0015)) * np.exp(-t / 0.052)
        overlay(out, puff, 0, 0.16)
        overlay(out, modal(0.22, [285, 520, 890], [1, 0.16, 0.06], [0.034, 0.024, 0.01], 38), 0.004, 0.20)
        overlay(out, cloth(0.20, 0.45), 0.03, 0.72)
        return out, -0.17, "dry wool-ball poof, small pressure thump and short wooden twang"
    if kind == "bounce":
        seconds = 0.27
        p = pitch or 520
        t = timebase(seconds)
        out = modal(seconds, [p, p * 1.57, p * 2.65], [1, 0.31, 0.11], [0.052, 0.024, 0.012], p * 0.045) * 0.47
        out += thud(seconds, p / 3.8, 0.035) * 0.17
        out += noise(seconds, 450, 3800) * np.exp(-t / 0.019) * 0.048
        return edge(out, 0.0008, 0.025), (-0.70 if p < 600 else 0.77), "short wooden rim knock wrapped in soft ball contact"
    if kind == "hit":
        seconds = 0.40
        t = timebase(seconds)
        out = thud(seconds, 98, 0.055) * 0.67
        out += noise(seconds, 200, 2700) * np.exp(-t / 0.052) * 0.085
        out += cloth(seconds, 0.32)
        return out, 0.18, "plush-body pock with a small scatter of wool fibres"
    if kind == "cushion":
        out = np.zeros(frames(0.88))
        overlay(out, thud(0.47, 74, 0.095), 0, 0.61)
        overlay(out, cloth(0.57, 0.85), 0, 1.3)
        overlay(out, modal(0.40, [118, 236, 357], [1, 0.21, 0.07], [0.09, 0.065, 0.03], -12), 0.06, 0.12)
        overlay(out, thud(0.26, 105, 0.045), 0.34, 0.12)
        overlay(out, cloth(0.27, 0.23), 0.50, 0.7)
        return out, 0.56, "deep sofa-cushion compression, soft spring and fabric settling"
    if kind == "wobble":
        out = np.zeros(frames(0.65))
        for at, p, gain in [(0, 210, 0.19), (0.18, 174, 0.12), (0.34, 145, 0.07)]:
            overlay(out, modal(0.25, [p, p * 2.02, p * 3.16], [1, 0.14, 0.03], [0.055, 0.025, 0.012], -8), at, gain)
        overlay(out, cloth(0.35, 0.20), 0.08, 0.8)
        return out, 0.52, "three short settling spring-plucks in the sofa"
    if kind == "fuse":
        seconds = 0.66
        t = timebase(seconds)
        env = np.sin(np.pi * t / seconds) ** 1.1
        out = noise(seconds, 650, 3900) * env * (0.7 + 0.3 * np.sin(TAU * 33 * t) ** 2) * 0.057
        out += noise(seconds, 170, 650) * env * 0.019
        return edge(out, 0.015, 0.06), -0.48, "dry twisted yarn rub on the raised soft bomb, no fire"
    if kind == "bow":
        seconds = 0.91
        t = timebase(seconds)
        env = np.sin(np.pi * t / seconds) ** 1.4
        freq = 175 + 58 * (1 - np.exp(-t / 0.37))
        phase = TAU * np.cumsum(freq) / SR
        tension = (np.sin(phase) + 0.18 * np.sin(phase * 2.01)) * 0.055 * env
        fibres = noise(seconds, 680, 2700) * env * (0.45 + 0.55 * np.sin(TAU * 49 * t) ** 4) * 0.032
        out = tension + fibres
        overlay(out, wood_click(0.09, 940), 0.10, 0.13)
        overlay(out, wood_click(0.08, 1070), 0.62, 0.09)
        return edge(out, 0.018, 0.08), 0.68, "restrained string tension with short fibre and fingerboard ticks"
    if kind == "title":
        out = np.zeros(frames(0.65))
        overlay(out, wood_click(0.14, 740), 0, 0.18)
        overlay(out, cloth(0.32, 0.32), 0, 0.7)
        return out, 0, "small soft wood-and-felt title accent"
    if kind == "ready":
        out = np.zeros(frames(0.62))
        overlay(out, cloth(0.38, 0.75), 0, 1)
        overlay(out, wood_click(0.14, 540), 0.15, 0.52)
        overlay(out, felt_tap(0.16, 215), 0.22, 0.08)
        return out, 0, "two palms grip the cloth stock and a short wooden readiness click"
    raise ValueError(f"Unhandled cue type: {kind}")


def place(stem: np.ndarray, mono: np.ndarray, at: float, gain: float, pan: float = 0) -> None:
    start = frames(at)
    end = min(len(stem), start + len(mono))
    if end <= start:
        raise ValueError(f"Sound outside the film at {at}")
    theta = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    s = mono[:end-start] * gain
    stem[start:end, 0] += s * np.cos(theta)
    stem[start:end, 1] += s * np.sin(theta)


def small_room(stem: np.ndarray, wet: float) -> np.ndarray:
    """Quiet, short stereo reflections; no large ambient/reverb wash."""
    result = stem.copy()
    reflected = signal.sosfilt(signal.butter(1, 3300, fs=SR, output="sos"), stem, axis=0)
    for delay, level, cross in [
        (0.021, 0.53, False), (0.036, 0.40, True),
        (0.061, 0.29, True), (0.094, 0.20, False),
        (0.143, 0.13, True), (0.208, 0.07, False),
    ]:
        d = frames(delay)
        src = reflected[:-d, ::-1] if cross else reflected[:-d]
        result[d:] += wet * level * src
    return result


def music_pause_envelope(n: int, pauses: list[list[float]]) -> np.ndarray:
    gain = np.ones(n, dtype=np.float64)
    for start, end in pauses:
        a, b = frames(start), frames(end)
        fade = frames(0.30)
        gain[a-fade:a] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
        gain[a:b] = 0
        # First new note after each pause retains its attack.
        rise = frames(0.025)
        gain[b:b+rise] *= np.sin(np.linspace(0, np.pi / 2, rise)) ** 2
    gain[:frames(0.08)] *= np.sin(np.linspace(0, np.pi / 2, frames(0.08))) ** 2
    gain[-frames(0.22):] *= np.cos(np.linspace(0, np.pi / 2, frames(0.22))) ** 2
    return gain


def make_music(n: int, pauses: list[list[float]]) -> tuple[np.ndarray, list[dict]]:
    stem = np.zeros((n, 2), dtype=np.float64)
    notes: list[dict] = []

    def note(at: float, midi: int, vel: float = 0.14, instrument: str = "wood", duration: float = 0.85, pan: float = -0.18) -> None:
        if instrument == "bell":
            sound = toy_chime(midi, duration)
        else:
            sound = wood_pluck(midi, duration, low=instrument == "bass")
        place(stem, sound, at, vel, pan)
        notes.append({"t": at, "midi": midi, "instrument": instrument, "gain": vel, "duration_s": duration})

    # The little A–B–D–F# shape first has space to breathe. Changing the lower
    # chord and leaving phrases unfinished makes the curiosity feel deliberate.
    melody = [
        (0.15, 69, .150, "wood"), (0.90, 71, .125, "wood"),
        (1.65, 74, .095, "bell"), (2.40, 66, .125, "wood"),
        (3.15, 64, .125, "wood"), (3.90, 69, .150, "wood"),
        (4.65, 78, .085, "bell"), (5.40, 74, .135, "wood"),
        (6.15, 64, .125, "wood"), (6.90, 69, .145, "wood"),
        (7.65, 71, .145, "wood"), (8.40, 73, .085, "bell"),
        (9.15, 74, .145, "wood"), (9.90, 76, .115, "wood"),
        (10.275, 73, .085, "wood"),
    ]
    for i, (at, midi, vel, inst) in enumerate(melody):
        note(at, midi, vel, inst, 0.80 if at < 10 else 0.45, 0.20 if inst == "bell" else (-0.22 if i % 2 == 0 else 0.08))
    for at, root in [(0.15, 50), (3.15, 55), (6.15, 57), (9.15, 59)]:
        note(at, root, .145, "bass", .80, -.06)
        note(at + 1.5, root + 12, .057, "wood", .55, -.30)

    # The ricochet sequence is led by its foley. Small dry recovery notes answer
    # the sofa landing, without filling the joke's held reaction shot.
    note(15.48, 55, .105, "bass", .65, .16)
    note(15.86, 74, .065, "bell", .58, .25)
    for at, midi, vel in [(16.62, 67, .095), (17.37, 66, .09), (17.745, 64, .08), (18.12, 62, .07)]:
        note(at, midi, vel, "wood", .45, -.05)

    # New arrivals: the same theme on B minor, a low countervoice, then shorter
    # eighth notes and soft wooden ticks bring us into the title and first person.
    late = [
        (20.65, 66, .11), (21.025, 71, .145), (21.775, 74, .15),
        (22.15, 73, .13), (22.525, 69, .145), (23.275, 67, .14),
        (23.65, 69, .14), (24.025, 69, .16), (24.40, 74, .16),
        (24.775, 78, .16), (25.15, 76, .15), (25.525, 74, .16),
        (25.90, 69, .14), (26.275, 78, .16), (26.65, 76, .15),
        (27.025, 74, .16), (27.40, 69, .13),
    ]
    for i, (at, midi, vel) in enumerate(late):
        note(at, midi, vel, "wood", .58, -.24 if i % 2 == 0 else .12)
    for at, root in [(21.025, 47), (22.525, 55), (24.025, 50), (25.525, 57), (27.775, 55), (28.40, 57), (28.96, 50)]:
        note(at, root, .16 if at < 27.7 else .145, "bass", .68, -.08)
        if at < 27:
            note(at + .75, root + 12, .072, "wood", .45, -.35)
    for at, midi, vel in [(21.025, 78, .045), (22.525, 79, .05), (24.025, 81, .065), (26.0, 86, .075)]:
        note(at, midi, vel, "bell", .85, .27)
    for i, at in enumerate(np.arange(21.025, 27.1, .75)):
        place(stem, felt_tap(0.12, 295 if i % 2 == 0 else 365), float(at), .031, .30)
    # A warm, intentionally short IV–V–I ending. Nothing drones under the cut.
    for at, chord in [(27.775, [67, 71]), (28.40, [69, 73]), (28.96, [66, 69, 74])]:
        for k, midi in enumerate(chord):
            note(at + k * .033, midi, .10 if at < 28.9 else .12, "wood", .95, -.22 + k * .22)
    note(28.99, 86, .063, "bell", .94, .25)
    stem = small_room(stem, .17)
    stem *= music_pause_envelope(n, pauses)[:, None]
    return stem, notes


def make_ambience(n: int, pauses: list[list[float]]) -> np.ndarray:
    seconds = n / SR
    stem = np.zeros((n, 2), dtype=np.float64)
    t = np.arange(n) / SR
    for c in range(2):
        air = noise(seconds, 150, 3000)
        low_room = noise(seconds, 65, 180) * .25
        # The room is quiet indoor air, no hum tone or fake birds/talking.
        stem[:, c] = (air + low_room) * .00105 * (0.93 + .07 * np.sin(TAU * .11 * t + c))
    for a, b in pauses:
        stem[frames(a):frames(b)] *= .42
    stem[:frames(.10)] *= np.linspace(0, 1, frames(.10))[:, None]
    stem[-frames(.20):] *= np.linspace(1, 0, frames(.20))[:, None]
    return stem


def measure(path: Path) -> dict:
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-vn", "-af",
           f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=11:print_format=json", "-f", "null", "-"]
    process = subprocess.run(cmd, capture_output=True, text=True, check=True)
    # The only JSON object in loudnorm's stderr is the measured meter report.
    report = json.loads(process.stderr[process.stderr.rfind("{"):process.stderr.rfind("}") + 1])
    return {k: float(v) if k != "normalization_type" else v for k, v in report.items()}


def decoded_audio(path: Path) -> np.ndarray:
    proc = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True)
    return np.frombuffer(proc.stdout, dtype="<f4").reshape(-1, 2)


def describe_file(path: Path, audio: np.ndarray, meter: dict) -> dict:
    peak = float(np.max(np.abs(audio)))
    return {
        "path": str(path.relative_to(HERE)),
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "sample_rate_hz": SR,
        "channels": 2,
        "decoded_frames": len(audio),
        "decoded_duration_s": len(audio) / SR,
        "sample_peak_dbfs": round(db(peak), 3),
        "true_peak_dbtp": meter["input_tp"],
        "integrated_lufs": meter["input_i"],
        "loudness_range_lu": meter["input_lra"],
        "rms_dbfs": round(db(rms(audio)), 3),
        "crest_factor_db": round(db(peak) - db(rms(audio)), 3),
        "clipped_samples": int(np.count_nonzero(np.abs(audio) >= 1)),
        "finite": bool(np.isfinite(audio).all()),
    }


def main() -> None:
    global RNG
    RNG = np.random.default_rng(SEED)
    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg is required for the local meter and MP3 encoder")
    cue_map = json.loads((HERE / "cue-map.json").read_text())
    duration = float(cue_map["duration"])
    n = frames(duration)
    if duration != 30 or float(cue_map["bpm"]) != 80:
        raise ValueError("This original score is arranged for the approved 30 s / 80 BPM treatment")
    pauses = cue_map["silences"]
    out = HERE / "out"
    out.mkdir(exist_ok=True)
    music, notes = make_music(n, pauses)
    ambient = make_ambience(n, pauses)
    action = np.zeros((n, 2), dtype=np.float64)
    coverage = []
    step_index = 0
    for i, cue in enumerate(cue_map["cues"]):
        sound, pan, material = foley(cue["type"], cue.get("pitch"))
        if cue["type"] == "step":
            pan = [-.57, -.42, -.25, -.08][step_index]
            step_index += 1
        gain = {
            "cloth": .43, "load": .90, "door": .67, "step": .76,
            "gasp": .47, "shot": .72, "bounce": .83, "hit": .76,
            "cushion": .76, "wobble": .76, "fuse": .74, "bow": .95,
            "title": .72, "ready": .84,
        }[cue["type"]]
        # This one quiet hand movement belongs to the second near-silence.
        if cue["type"] == "cloth" and cue["t"] == 18.8:
            gain *= .56
        place(action, sound, float(cue["t"]), gain, pan)
        synth_start = frames(cue["t"]) / SR
        coverage.append({
            "index": i, "type": cue["type"], "requested_t_s": cue["t"],
            "synth_start_s": synth_start,
            "sync_error_ms": round((synth_start - float(cue["t"])) * 1000, 8),
            "duration_s": len(sound) / SR, "pan": pan, "material": material,
            "pre_master_peak_dbfs": round(db(float(np.max(np.abs(sound))) * gain), 2),
        })
    action = small_room(action, .105)
    # Let the important contacts read without flattening the whole music bus.
    for at, width, depth in [(12.1, .26, .48), (13.05, .16, .30), (13.3, .16, .30), (14.25, .29, .36), (15.0, .35, .32), (22.5, .60, .25), (27.8, .32, .20)]:
        a, b = frames(at), min(n, frames(at + width))
        music[a:b] *= (1 - depth * np.sin(np.linspace(np.pi / 2, np.pi, b-a)) ** 2)[:, None]
    mixed = music + action + ambient
    # Remove inaudible rumble/DC. No hard clipper or brickwall limiter is used.
    mixed = signal.sosfilt(signal.butter(2, 38, "highpass", fs=SR, output="sos"), mixed, axis=0)
    mixed[-frames(.05):] *= np.cos(np.linspace(0, np.pi / 2, frames(.05)))[:, None] ** 2
    mixed[0] = mixed[-1] = 0
    if not np.isfinite(mixed).all():
        raise ValueError("Non-finite samples in synthesis")
    mixed *= .84 / max(np.max(np.abs(mixed)), 1e-12)

    wav_path, mp3_path = out / "mix.wav", HERE / "score.mp3"
    with tempfile.TemporaryDirectory(prefix="rongboy-score-") as temporary:
        scratch = Path(temporary)
        raw_path = scratch / "raw.wav"
        sf.write(raw_path, mixed, SR, subtype="FLOAT")
        first = measure(raw_path)
        filter_spec = (
            f"loudnorm=I={TARGET_I}:TP={TARGET_TP}:LRA=11:"
            f"measured_I={first['input_i']}:measured_TP={first['input_tp']}:"
            f"measured_LRA={first['input_lra']}:measured_thresh={first['input_thresh']}:"
            f"offset={first['target_offset']}:linear=true:print_format=json"
        )
        proc = subprocess.run([
            "ffmpeg", "-y", "-hide_banner", "-nostats", "-i", str(raw_path),
            "-af", filter_spec, "-ar", str(SR), "-ac", "2", "-t", str(duration),
            "-c:a", "pcm_s24le", str(wav_path),
        ], capture_output=True, text=True, check=True)
        normalization = json.loads(proc.stderr[proc.stderr.rfind("{"):proc.stderr.rfind("}") + 1])
        final_audio, sr = sf.read(wav_path, always_2d=True)
        if len(final_audio) != n or sr != SR:
            raise ValueError("Unexpected output sample count or sample rate")
        wav_meter = measure(wav_path)
        subprocess.run([
            "ffmpeg", "-y", "-v", "error", "-i", str(wav_path), "-map_metadata", "-1",
            "-c:a", "libmp3lame", "-b:a", "160k", "-ar", str(SR), "-ac", "2",
            "-write_xing", "1", str(mp3_path),
        ], check=True)
        mp3_meter = measure(mp3_path)
        mp3_audio = decoded_audio(mp3_path)
        # Lossy encoders may raise intersample peaks: keep both delivered files
        # below -1 dBTP. Only lower the MP3 if the encoder needs extra headroom.
        mp3_trim_db = min(0, -1.10 - mp3_meter["input_tp"])
        if mp3_trim_db < 0:
            subprocess.run([
                "ffmpeg", "-y", "-v", "error", "-i", str(wav_path),
                "-af", f"volume={mp3_trim_db:.3f}dB", "-map_metadata", "-1",
                "-c:a", "libmp3lame", "-b:a", "160k", "-ar", str(SR), "-ac", "2",
                "-write_xing", "1", str(mp3_path),
            ], check=True)
            mp3_meter, mp3_audio = measure(mp3_path), decoded_audio(mp3_path)

    segments = []
    for a, b, label in [(0, 6.5, "careful loading"), (6.5, 10.8, "curious approach"),
                        (10.8, 12.1, "first near-silence"), (12.1, 15.3, "shot and two ricochets"),
                        (15.3, 18.6, "sofa reaction"), (18.6, 20.5, "second near-silence"),
                        (20.5, 24, "new arrivals"), (24, 30, "title and first-person cadence")]:
        excerpt = final_audio[frames(a):frames(b)]
        segments.append({"from_s": a, "to_s": b, "label": label,
                         "rms_dbfs": round(db(rms(excerpt)), 2),
                         "sample_peak_dbfs": round(db(float(np.max(np.abs(excerpt)))), 2)})
    # Coarse spectral checks use the synthesis before the static loudness gain.
    freq, power = signal.welch(mixed, SR, nperseg=8192, axis=0)
    power = power.mean(axis=1)
    bands = {}
    for lo, hi in [(20, 120), (120, 500), (500, 2000), (2000, 8000), (8000, 20000)]:
        mask = (freq >= lo) & (freq < hi)
        bands[f"{lo}-{hi}_hz_percent"] = round(float(power[mask].sum() / power.sum() * 100), 2)
    files = {"wav": describe_file(wav_path, final_audio, wav_meter), "mp3": describe_file(mp3_path, mp3_audio, mp3_meter)}
    checks = {
        "exactly_30_seconds_decoded": all(f["decoded_frames"] == n for f in files.values()),
        "48k_stereo": all(f["sample_rate_hz"] == SR and f["channels"] == 2 for f in files.values()),
        "true_peak_at_most_minus_1_dbtp": all(f["true_peak_dbtp"] <= -1 for f in files.values()),
        "loudness_within_1_lu_of_minus14": all(abs(f["integrated_lufs"] + 14) <= 1 for f in files.values()),
        "no_clipped_or_nonfinite_samples": all(f["clipped_samples"] == 0 and f["finite"] for f in files.values()),
        "every_cue_covered": len(coverage) == len(cue_map["cues"]),
        "cue_sync_within_one_sample": all(abs(c["sync_error_ms"]) <= 1000 / SR for c in coverage),
        "music_fully_off_in_both_pauses": all(float(np.max(np.abs(music[frames(a):frames(b)]))) == 0 for a, b in pauses),
    }
    report = {
        "title": "RONGBOY · 一颗毛球惹的祸 — original procedural sound",
        "seed": SEED, "duration_s": duration, "bpm": cue_map["bpm"],
        "dependencies": ["numpy", "scipy", "soundfile", "ffmpeg (meter / local encoding only)"],
        "sources": "All music, room noise and foley synthesized locally in score.py; no third-party audio, external APIs or speech.",
        "files": files,
        "mastering": {"target_integrated_lufs": TARGET_I, "target_true_peak_dbtp": TARGET_TP,
                       "process": "38 Hz highpass; two-pass EBU R128 loudnorm; 24-bit PCM. No hard clipper.",
                       "normalization_type": normalization["normalization_type"],
                       "pre_normalization": first, "mp3_extra_gain_db": mp3_trim_db},
        "music": {"key": "D major with B minor / G reveal", "note_count": len(notes),
                  "palette": ["damped wooden-string plucks", "toy glock inharmonic mallet modes", "short harmonic bass plucks", "soft felt wood taps"],
                  "notes": notes},
        "near_silences": [{"from_s": a, "to_s": b,
                           "music_peak_dbfs": round(db(float(np.max(np.abs(music[frames(a):frames(b)])))), 2),
                           "ambience_pre_master_rms_dbfs": round(db(rms(ambient[frames(a):frames(b)])), 2),
                           "retained_foley": [c["type"] for c in coverage if a <= c["requested_t_s"] < b]} for a, b in pauses],
        "event_coverage": coverage, "segment_measurements": segments,
        "spectral_energy": bands,
        "checks": checks,
        "mp3_duration_note": "MP3 containers include codec padding; the Xing/LAME gapless metadata decodes to exactly 1,440,000 frames (30.000 s).",
    }
    report_path = out / "audio-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"files": files, "checks": checks, "report": str(report_path)}, ensure_ascii=False, indent=2))
    if not all(checks.values()):
        raise SystemExit("Audio validation failed; inspect out/audio-report.json")


if __name__ == "__main__":
    main()
