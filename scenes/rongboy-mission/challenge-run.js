import { isBoardReturnHit } from './garden-feedback.js';

export function createChallengeRun(spec) {
  return { spec, progress: 0, pulse: null, failure: '' };
}

export function recordChallengeZap(run, targets, nextBallId, expires) {
  if (run.spec.id === 'static-followup' && targets.length === run.spec.target && !run.progress) {
    run.pulse = { targets: new Set(targets), nextBallId, expires };
  }
}

export function recordChallengeHit(run, hit, enemy, time) {
  if (run.spec.id === 'shield-bank' && enemy.type === 'shielded' && isBoardReturnHit(hit)) run.progress = 1;
  const pulse = run.pulse;
  if (run.spec.id !== 'static-followup' || hit.hp > 0 || !pulse || time >= pulse.expires || enemy.stun <= 0) return;
  if (hit.source === 'ball' && hit.weapon === 'single' && hit.ballId >= pulse.nextBallId && pulse.targets.delete(hit.id)) run.progress++;
}

export function recordChallengeArrow(run, impact) {
  if (run.spec.id === 'dodge-arrows' && impact !== 'player') run.progress = Math.min(run.spec.target, run.progress + 1);
}

export function challengeOutcome(run, state) {
  const { time, health, damageTaken, enemies, enemyShots } = state;
  const { spec, progress, pulse } = run;
  const alive = enemies.filter(enemy => enemy.alive).length;
  if (health <= 0) run.failure = '绒仔被击倒了，再试一次。';
  else if (spec.id === 'dodge-arrows' && damageTaken > 0) run.failure = '这局挨了一箭。等红线定住再横移。';
  else if (progress >= spec.target) return 'won';
  else if (time >= spec.seconds) run.failure = '时间到了，再试一次。';
  else if (!alive && spec.id === 'shield-bank') run.failure = '持盾者已倒下。要用墙板反弹打中后背才能盖章。';
  else if (!alive && spec.id === 'dodge-arrows' && progress + enemyShots.length < spec.target) run.failure = '弓手已倒下。留它射完三箭。';
  else if (spec.id === 'static-followup' && (alive + progress < spec.target || (progress > 0 && time >= pulse.expires))) {
    run.failure = '要趁同一张电网还定着两只，用手枪先后击倒。';
  }
  return run.failure ? 'lost' : null;
}
