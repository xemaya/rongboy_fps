// 主界面：左边几项菜单（毛球当光标），右边是一个活的小场景——绒仔站着，旁边一只僵尸在打瞌睡。
// 按空格朝它打一颗毛球：第一下它哼一声，第二下抬头找了一圈，第三下气醒了蹦两下，然后又睡回去。
// 顺便教会玩家"空格是射击"。纯键盘：W / S 选，A / D 换地图，Enter 确定。
import * as T from 'three';

// ---------- 菜单（DOM） ----------
// items: [{ id, label, pick?（当前选中的值，比如地图名）, note? }]
export function createMenu(root, items, { onActivate }) {
  let index = 0;
  root.innerHTML = '<i class="cursor" aria-hidden="true"></i>' + items.map((it, i) =>
    `<div class="item" role="menuitem" tabindex="-1" data-i="${i}">${it.label}${it.pick ? `<span class="pick">‹ ${it.pick} ›</span>` : ''}${it.note ? `<small>${it.note}</small>` : ''}</div>`).join('');
  const rows = [...root.querySelectorAll('.item')], cursor = root.querySelector('.cursor');
  function select(i, hop = true) {
    index = (i + items.length) % items.length;
    rows.forEach((row, k) => { row.classList.toggle('sel', k === index); row.setAttribute('aria-current', k === index ? 'true' : 'false'); });
    const row = rows[index];
    cursor.style.transform = `translateY(${row.offsetTop + (row.offsetHeight - cursor.offsetHeight) / 2}px)`;
    if (hop) { cursor.classList.remove('hop'); void cursor.offsetWidth; cursor.classList.add('hop'); }
  }
  rows.forEach((row, i) => {
    row.addEventListener('mouseenter', () => select(i, false));
    row.addEventListener('click', () => { select(i, false); onActivate(items[i]); });
  });
  select(0, false);
  return { move: d => select(index + d), activate: () => onActivate(items[index]), layout: () => select(index, false), get current() { return items[index]; } };
}

// ---------- 小场景 ----------
const clamp01 = v => Math.min(1, Math.max(0, v));
const ease = k => k * k * (3 - 2 * k);
const win = (t, a, b, fade = 0.25) => clamp01((t - a) / fade) * clamp01((b - t) / fade);   // [a, b] 里是 1，两头各淡 fade 秒

// stage：两个角色站在哪（关卡的 menu 或出生点）；ball：一颗毛球模型；mood(text)：头顶气泡的材质；part(actor, name)：取关节
export function createMenuToy({ stage, hero, zombie, ball, mood, part, sfx, burst, ring }) {
  const HX = stage.x - 1.75, HZ = stage.z - 0.35, ZX = stage.x - 0.55, ZZ = stage.z - 1.0;
  const toZombie = Math.atan2(ZX - HX, ZZ - HZ), toHero = Math.atan2(HX - ZX, HZ - ZZ), REST = 0.5;
  const head = new T.Vector3(ZX - 0.2, 1.36, ZZ), from = new T.Vector3(), axis = new T.Vector3();
  const sprite = new T.Sprite(mood('Zzz')); sprite.renderOrder = 4; zombie.world.add(sprite);
  ball.visible = false;
  let time = 0, hits = 0, kind = 0, since = 99, flight = -1, landed = false, leave = 0;
  const lerpAngle = (a, b, k) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

  return {
    heroHeading: toZombie,
    // 开一枪。球还在飞、或者它正气得直蹦的时候不接受
    shoot(muzzle) { if (flight >= 0 || leave > 0 || (kind === 3 && since < 3.4)) return false; flight = 0; landed = false; from.copy(muzzle); return true; },
    // 出发：僵尸被吓醒蹦到一边，给镜头让路；k 是出发动画的进度
    depart(k) { leave = k; },
    reset() { leave = 0; kind = 0; since = 99; flight = -1; ball.visible = false; },
    update(dt) {
      time += dt; since += dt;
      // ---- 球：0.2 秒飞到它头上，弹起来往后落
      if (flight >= 0) {
        flight += dt;
        const k = flight / 0.2;
        if (k < 1) { ball.visible = true; ball.position.lerpVectors(from, head, k); ball.position.y += Math.sin(k * Math.PI) * 0.12; ball.scale.setScalar(0.11); }
        else {
          if (!landed) { landed = true; hits++; kind = (hits - 1) % 3 + 1; since = 0; sfx('hit', { weapon: 'single', strength: 0.7 }); burst(head.x, head.z, 7, 0.7, 0xe7ddbc, head.y); ring(head, kind === 3 ? 0xffd27a : 0xfff0d8, 0.5, 0.18); }
          const b = (flight - 0.2) / 0.6;
          if (b < 1) { ball.position.set(head.x - b * 0.9, head.y + Math.sin(b * Math.PI) * 0.7 - b * b * 1.2, head.z + b * 0.5); ball.scale.setScalar(0.11 * (1 - b * b)); }
          else { flight = -1; ball.visible = false; }
        }
        ball.rotation.x += dt * 14; ball.rotation.z += dt * 5;
      }
      // ---- 僵尸
      const span = kind === 1 ? 1.3 : kind === 2 ? 2.1 : kind === 3 ? 3.2 : 0;
      const wake = Math.max(span ? win(since, 0, span, kind === 3 ? 0.35 : 0.25) : 0, clamp01(leave * 6));
      const angry = Math.max(kind === 3 ? wake : 0, clamp01(leave * 6));
      const sleep = 1 - wake * (angry ? 1 : kind === 2 ? 0.85 : 0.45);
      const jolt = since < 1 ? Math.max(0, Math.sin(since * 18) * Math.exp(-since * 6)) : 0, breathe = Math.sin(time * 1.9);
      const hopT = leave > 0 ? leave * 4.2 : kind === 3 && since > 0.3 && since < 2.5 ? (since - 0.3) * 2.6 : 0, hop = Math.abs(Math.sin(hopT * Math.PI)) * (leave > 0 || hopT > 0 ? 0.17 : 0);
      const heading = leave > 0 ? lerpAngle(REST, Math.PI / 2, clamp01(leave * 5)) : lerpAngle(REST, toHero, ease(angry));
      zombie.reset();
      zombie.world.position.set(ZX + ease(clamp01(leave * 1.25)) * 2.3, hop, ZZ + ease(clamp01(leave * 1.25)) * 0.4);
      zombie.model.rotation.y = heading;
      zombie.world.scale.setScalar(1 - ease(clamp01((leave - 0.72) / 0.28)));
      zombie.tilt.scale.set(1 + jolt * 0.08 - breathe * 0.012 * sleep, 1 - jolt * 0.14 + breathe * 0.022 * sleep, 1 + jolt * 0.08 - breathe * 0.012 * sleep);
      const body = part(zombie, 'Body'), hd = part(zombie, 'Head');
      if (body) body.rotation.x += 0.12 + sleep * (0.28 + breathe * 0.02);
      if (hd) { hd.rotation.x += -0.06 + sleep * (0.42 + breathe * 0.04); hd.rotation.z += sleep * 0.12; hd.rotation.y += kind === 2 ? wake * Math.sin(since * 4.2) * 0.6 : 0; }
      for (const sign of [-1, 1]) {
        const arm = part(zombie, sign < 0 ? 'ArmL' : 'ArmR'), leg = part(zombie, sign < 0 ? 'LegL' : 'LegR');
        if (arm) { arm.rotation.x -= 1.18 * angry; arm.rotation.z += sign * 0.08; }
        if (leg) leg.rotation.x += Math.min(1, hop / 0.17) * 0.38;
      }
      zombie.flash(since < 0.18 ? (0.18 - since) * 4 : 0);
      const text = sleep > 0.7 ? 'Zzz' : angry ? '!' : '?';
      sprite.material = mood(text); sprite.visible = leave < 0.7;
      sprite.position.set(0.25, 1.74 + (text === 'Zzz' ? Math.sin(time * 1.6) * 0.05 : 0.12) - hop * 0.6, 0);
      sprite.scale.set(text === 'Zzz' ? 0.5 : 0.42, 0.3, 1);
      // ---- 绒仔：它一发火就往后仰一下；出发时转身走出画
      // 绒仔是迈步走的（蹦着走的是僵尸）：腿跟着走过的距离摆
      const gone = ease(clamp01(leave * 1.25)) * 1.34, ph = gone / 0.42 * Math.PI, live = Math.min(1, gone / 0.12);
      hero.world.position.set(HX - gone * 0.894, Math.abs(Math.sin(ph)) * 0.016 * live, HZ - gone * 0.447);
      if (leave > 0) { hero.model.rotation.y = lerpAngle(toZombie, Math.atan2(-0.894, -0.447), clamp01(leave * 6)); for (const sign of [-1, 1]) { const leg = part(hero, 'CTRL / leg ' + sign); if (leg) leg.rotation.x += sign * Math.sin(ph) * 0.5 * live; } }
      hero.world.scale.setScalar(1 - ease(clamp01((leave - 0.72) / 0.28)));
      axis.set(Math.cos(toZombie), 0, -Math.sin(toZombie));
      hero.tilt.quaternion.setFromAxisAngle(axis, -0.16 * (kind === 3 ? win(since, 0.1, 2.6, 0.3) : 0));
    },
  };
}
