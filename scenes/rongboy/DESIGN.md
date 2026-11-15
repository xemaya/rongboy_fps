# Rongboy playable presentation study

2026-11-13 · visual candidate; user authorized target image, playable slice and comparison.

Preserve original level-7 (Chain Builder), long-legs buff and all game rules. Source snapshot: xemaya/combo-hopper at local HEAD 6d91d28. No edits to original repository. Vendored game sources remain unchanged; original runtime icon URL is defined at bundle time.

## Stage and camera
8×8 board, 1 metre cell spacing, centered x/z; top at y=0.26. Walnut tray 9×9; felt tiles 0.96 square; fixed high oblique perspective, full board visible. Cream and amber HUD sits outside battle area. Warm sun from upper left, forest fill. Peripheral felt trees, stones and mushrooms stay outside board. Small articulated scout, walker, runner and tank; crawler retained because level-7 contains it.

## Reuse / new
Existing: cine renderer, sky, shadows, tone mapping, noise, quality governor. New library module: felt texture, rounded tile, puppet parts, forest stage. No runtime external image/model. Generated target image is reference only.

## Interaction
Pointer raycast uses actual board plane; targets differentiate walk / jump / apex. Hover clones original state and executes original clickCell, then previews endTurn only when chain exhausted or explicitly requested. Never mutate live state for preview. Show destination, damage, continuation and enemy-turn risk. Preserve original 800ms auto-end delay. Inputs during animation are ignored; next choice becomes available after landing. Space ends chain; R restart; Escape clears preview. Touch: tap previews, second tap commits. Keyboard arrow selection + Enter commits.

## Comparison
Toggle new vs original-style flat board using the SAME live state and rules; label flat mode as reconstructed, not original. Original playable build served separately for independent same-level comparison. Deterministic action tape, state hashes, replay and pure-rule parity checks. Performance measurement separate from visual acceptance.

## Verification — 2026-11-13

- `node scripts/build-rongboy.mjs rongboy` builds standalone full and fragment HTML.
- `node scripts/tests/rongboy.mjs`: 217 sampled original-vs-snapshot transitions identical; preview clone leaves live state untouched; runtime level pack matches source level-7; solution 12 actions / 6 turns / maximum combo 5 / tank stun once.
- Browser: original dist-itch build and new slice both played with level-7 + long-legs, the exact 12-click tape; both clear in 6 turns. Original's kill counter is 9 for 8 enemies because rules count the tank's surviving hit too. Preserved this behavior.
- Browser: keyboard selection/commit, C7 surround-risk preview, restart, flat-mode toggle and solution replay exercised. No page error in inspected state. Touch and narrow-screen behavior implemented but not verified on a physical mobile device.
- `reference/benchmark.json`: in-app browser, viewport 1280×900, medium, dynamic resolution off, internal 1088×605, 5×16 idle update+render+GPU-completion frames: mean 17.10ms, batch means 6.51–28.52ms. This is idle scene measurement, not full combat benchmark or frame-rate guarantee.
- Screens: target-v1.png = generated visual target (built-in imagegen); playable-risk-v1.png = actual runtime; original-level7.png/original-win.png = original browser.

## Comparison findings and remaining visual work

Action meaning: distinguish walk vs jump; one-step forecast explains enemy advance and surround risk before committing. Coordinates stay attached to board plane through raycast. In original all available actions are yellow tiles; original warning can remain after danger passes. New preview clears on action.

Timing: original normal jump arc 600ms; candidate 280–430ms according to chain count, reduced-motion skips travel. New input remains gated until landing; no timed decision pressure. Human assessment of feel remains pending.

Current puppets are deliberately compact procedural candidates, below target-image detail. Need fuller facial silhouettes, visible cloth fibers and seams, more expressive limb posing, stronger material differentiation and less repetitive peripheral vegetation before claiming target visual fidelity. This slice validates interactions and renderer integration; it is not accepted final art. Level selection, progression and draw ceremony remain in original, while this sample fixes level and equipment for comparison.

## Run / inspect

`node scripts/build-rongboy.mjs rongboy` then `PORT=5188 node scripts/build.mjs --serve rongboy`.
Original build: `python3 -m http.server 8767 --bind 127.0.0.1 --directory ../combo-hopper/dist-itch`, open `http://127.0.0.1:8767/?skipOpening&unlockAll`, select 7 and Long Legs. New slice: `http://localhost:5188/rongboy.html`.

`?q=medium&dynres=0&bench=1` performs synchronous idle scene measurement. `Flat comparison` is a reconstruction using live state, explicitly not the original renderer. Reference prompt is saved in `reference/prompt.txt`; generated reference is not used as runtime scenery.
