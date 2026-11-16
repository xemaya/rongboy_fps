# Rongboy 30-second Intro Implementation Plan

> **Archived historical plan:** The user declined the visual result and shelved this experiment. Source is retained independently; the game menu has no intro entry. The checklist below records the original production plan.

**Goal:** Produce a watchable 30-second game intro, using existing models, with audio, MP4 and native interactive source.

**Architecture:** A pure time-based timeline drives native Three.js cast poses, cine-engine camera shots, material-preserving props and sound cues. A standalone page exposes READY/render(t)/DUR for offline capture; gameplay only receives a link to the intro.

**Tech Stack:** Existing Three.js and cine-engine, GLB models, deterministic headless Chromium capture, procedural original audio, ffmpeg.

- [ ] Create `scenes/rongboy-intro/timeline.js`: full 0–30 shot coverage, path with two geometrically consistent ricochets, event cue map and actor action phases. Verify duration, reflected trajectory and finite poses with a small meaningful check.
- [ ] Create `stage.js`, `cast.js`, `camera.js`: reuse plush scene parts and exact authored models; pose loading/reaching/falling/aiming; derive hand/muzzle positions; keep the gag in readable framing.
- [ ] Create `main.js` and `index.html`: deterministic render hook, restrained title, keyboard transport, replay and game link. Extend build loader for the score asset, add an intro link to the game menu.
- [ ] Create `score.py`: original ambience, wood plucks, toy chimes and event-aligned felt/impact sounds. Export a 30-second WAV and normalize the final audio.
- [ ] Create `build.sh`: build the page, render 720 frames, mix/mux 30-second MP4. Keep render caches ignored; retain poster, contact sheet and QA report.
- [ ] Render style frames and key action strips; correct framing, prop contacts and motion. Render and inspect the full movie; check media duration/frame count/loudness/black frames/freeze. Deliver source, MP4, poster and credits.
