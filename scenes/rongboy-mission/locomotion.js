// Stride lengths are in world metres, so the animation follows the distance the enemy actually moved.
export const GAITS = {
  leaper: { stride: .92, stance: .53, lift: .089, lean: .25, sway: .037, drop: .018, arms: -.55, armSwing: .62 },
  heavy: { stride: .76, stance: .74, lift: .066, lean: .105, sway: .060, drop: .056, arms: -.24, armSwing: .16 },
  shielded: { stride: .52, stance: .75, lift: .036, lean: .077, sway: .018, drop: .019, arms: -.38, armSwing: .11 },
  bomber: { stride: .72, stance: .65, lift: .064, lean: .048, sway: .041, drop: .028, arms: -.51, armSwing: .19 },
  archer: { stride: .62, stance: .57, lift: .046, lean: .055, sway: .020, drop: .015, arms: -.60, armSwing: .13 },
  'boss-warden': { stride: .98, stance: .78, lift: .084, lean: .14, sway: .074, drop: .079, arms: -.13, armSwing: .35 },
  'boss-leech': { stride: .69, stance: .82, lift: .026, lean: .22, sway: .053, drop: .028, arms: -.61, armSwing: .39 },
};

const SMOOTH_TRAVEL = .15 + 1.55 * .78 * 2 / Math.PI;

export function travelPace(enemy, periodScale, heightScale, phaseOffset = 0) {
  if (enemy.type !== 'walker') {
    enemy.hop = enemy.hopPhase = 0;
    return enemy.type === 'crawler' ? .92 : SMOOTH_TRAVEL;
  }
  enemy.hopPhase = ((enemy.age + phaseOffset) % (enemy.hopPeriod * periodScale)) / (enemy.hopPeriod * periodScale);
  const lift = Math.sin(Math.min(1, enemy.hopPhase / .78) * Math.PI);
  enemy.hop = lift * enemy.hopHeight * heightScale;
  return .15 + 1.55 * lift;
}

// Count only the part of the intended step that got through collision, and discount knockback.
export function strideTravel(enemy, startX, startZ, wantedX, wantedZ, startHeading, dt) {
  const gait = GAITS[enemy.type];
  if (!gait && enemy.type !== 'crawler') return false;
  const canStep = enemy.alive && enemy.stun <= 0 && enemy.hit <= 0 && enemy.action !== 'pounce' && enemy.action !== 'crawler-strike';
  const wanted = Math.hypot(wantedX, wantedZ);
  const actual = canStep && wanted > 1e-7 ? Math.max(0, Math.min(wanted,
    ((enemy.x - startX) * wantedX + (enemy.z - startZ) * wantedZ) / wanted)) : 0;
  const ease = 1 - Math.exp(-18 * dt);
  if (enemy.type === 'crawler') {
    enemy.crawlDistance = (enemy.crawlDistance || 0) + actual;
    enemy.crawlWeight = enemy.stun > 0 ? 0 : (enemy.crawlWeight || 0) * (1 - ease) + (actual > 1e-6 ? ease : 0);
    return false;
  }
  const turn = Math.atan2(Math.sin(enemy.heading - startHeading), Math.cos(enemy.heading - startHeading));
  const pivot = canStep && enemy.type === 'shielded' && enemy.action === 'chase' && actual < 1e-6 ? Math.abs(turn) * enemy.radius * .65 : 0;
  const travel = actual + pivot;
  const previous = enemy.stepDistance || 0;
  enemy.stepDistance = previous + travel;
  enemy.stepWeight = enemy.stun > 0 ? 0 : (enemy.stepWeight || 0) * (1 - ease) + (travel > 1e-6 ? ease : 0);
  if (travel > 1e-6) {
    const sin = Math.sin(enemy.heading), cos = Math.cos(enemy.heading);
    enemy.stepForward = actual ? (wantedX * sin + wantedZ * cos) / wanted : 0;
    enemy.stepSide = actual ? (wantedX * cos - wantedZ * sin) / wanted : 0;
    enemy.stepPivot = pivot ? Math.sign(turn) : 0;
  }
  return actual > 1e-6 && Math.floor(previous * 2 / gait.stride) !== Math.floor(enemy.stepDistance * 2 / gait.stride);
}
