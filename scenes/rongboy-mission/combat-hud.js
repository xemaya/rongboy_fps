import * as T from 'three';

const WEAPON_ICONS = {
  single: 'M11 14 Q11 8 18 8 H37 Q43 8 43 14 H69 Q75 14 75 22 L69 27 H49 L54 40 Q54 44 48 44 H38 L31 27 H18 Q11 27 11 22 Z',
  scatter: 'M9 10 Q9 6 14 6 H36 Q41 6 44 11 H73 Q80 11 80 17 V24 L73 28 H47 L52 41 H42 L33 28 H14 Q9 28 9 24 Z',
  heavy: 'M9 12 L17 5 H28 V9 H39 L44 3 H60 L65 10 H78 Q87 10 87 18 V27 L80 31 H62 L67 43 H56 L47 31 H29 V34 H17 L9 27 Z',
  stun: 'M9 9 Q9 6 14 6 H30 L37 12 H71 Q78 12 78 19 V25 L68 29 H46 L52 42 H41 L34 29 H13 Q9 29 9 25 Z',
  freeze: 'M8 14 Q8 8 14 8 H26 L29 3 H39 L42 8 H59 L64 12 H77 L80 16 V25 L77 29 H58 L57 42 H44 L38 29 H16 Q8 29 8 23 Z',
  sewing: 'M9 10 Q9 5 15 5 H51 Q61 5 69 10 L76 17 H25 V21 H76 Q81 21 81 26 L73 31 H53 L57 43 H47 L40 31 H12 Q9 31 9 27 Z',
  needle: 'M3 19 L32 16 H42 V11 Q42 8 49 8 H72 Q80 8 80 16 V24 L71 28 H61 L65 43 H53 L47 28 Q42 28 42 24 H32 Z',
};
const ICON_SEAMS = {
  single: 'M18 12 V23 M27 11 V23 M39 12 V23',
  scatter: 'M14 11 H29 M14 17 H29 M14 23 H29',
  heavy: 'M19 9 V29 M25 9 V29 M46 10 H61 M54 15 V27',
  stun: 'M15 11 H24 M15 16 H24 M15 21 H24 M33 14 V25',
  freeze: 'M31 10 H38 L44 16 H56 V24 H22 L15 18 L21 13 Z',
  sewing: 'M34 25 H57 M17 9 H42',
  needle: 'M50 12 V24 M57 12 V24 M64 12 V24',
};

const ICON_FABRIC = {
  single: ['#cdb57a','#645836','#ad6547'],
  scatter: ['#b4b97d','#48543c','#c98154'],
  heavy: ['#b5b3a0','#454e4b','#e2ac52'],
  stun: ['#a6bea0','#426357','#83cbbc'],
  freeze: ['#c9f4ef','#3c7d91','#ffe0aa'],
  sewing: ['#d5a377','#614c3a','#b95d4d'],
  needle: ['#c0bdc4','#555269','#b685a7'],
};

const ICON_INLAYS = {
  single: 'M12 14 H20 V26 H13 Z',
  scatter: 'M10 11 H17 V27 H11 Z',
  heavy: 'M10 16 L17 8 H21 V34 H17 L10 27 Z M43 10 H62 V14 H43 Z',
  stun: 'M11 10 H25 V28 H12 Z',
  freeze: 'M12 23 H34 M53 12 V25 M69 16 V26',
  sewing: 'M11 7 H51 Q63 7 73 16 H11 Z',
  needle: 'M47 11 H70 Q74 11 76 16 H47 Z',
};

function canvas(w, h, draw) {
  const element = document.createElement('canvas');
  element.width = w; element.height = h;
  draw(element.getContext('2d'));
  return element;
}

export function heartImage(filled) {
  return canvas(124, 116, ctx => {
    ctx.scale(2, 2);
    const heart = new Path2D('M31 51 C25 47 5 34 4 20 C3 8 17 4 25 10 C28 12 30 14 31 17 C34 10 40 7 46 7 C56 7 60 14 58 24 C56 35 38 48 31 51 Z');
    ctx.lineJoin = 'round';
    if (filled) {
      const coral = ctx.createLinearGradient(0, 6, 0, 54);
      coral.addColorStop(0, '#ee8b66'); coral.addColorStop(.54, '#d66548'); coral.addColorStop(1, '#a53f31');
      ctx.fillStyle = coral;
      ctx.fill(heart);
      ctx.save(); ctx.clip(heart);
      for (let i = 0; i < 120; i++) {
        const x = (i * 43 % 111) * .56, y = (i * 71 % 101) * .55;
        ctx.fillStyle = i % 4 ? '#ffdfae38' : '#672a2950';
        ctx.fillRect(x, y, 1.05, .55);
      }
      ctx.restore();
    }
    ctx.strokeStyle = filled ? '#71352b' : '#fff0c2';
    ctx.lineWidth = filled ? 1.4 : 2.0;
    ctx.stroke(heart);
    if (filled) {
      ctx.translate(31, 28); ctx.scale(.86, .84); ctx.translate(-31, -28);
      ctx.strokeStyle = '#ffe7ba'; ctx.lineWidth = 1.30; ctx.setLineDash([2.7, 2.1]);
      ctx.stroke(heart);
    }
  }).toDataURL();
}

// 血瓶的小图标：带着的是实心的，空位只有一圈轮廓
export function potionImage(filled) {
  return canvas(80, 116, ctx => {
    ctx.scale(2, 2);
    const bottle = new Path2D('M16 9 L24 9 L24 18 C24 24 36 26 36 38 C36 50 30 55 20 55 C10 55 4 50 4 38 C4 26 16 24 16 18 Z');
    ctx.lineJoin = 'round';
    if (filled) {
      const coral = ctx.createLinearGradient(0, 8, 0, 56);
      coral.addColorStop(0, '#ee8b66'); coral.addColorStop(.54, '#d66548'); coral.addColorStop(1, '#a53f31');
      ctx.fillStyle = coral; ctx.fill(bottle);
      ctx.save(); ctx.clip(bottle);
      ctx.fillStyle = '#f0dab6'; ctx.fillRect(0, 32, 40, 13);   // 肚子上的布贴
      ctx.fillStyle = '#d66548'; ctx.fill(new Path2D('M20 43 C18 41.6 14.6 39.4 14.6 36.8 C14.6 34.6 17.6 34 20 36.4 C22.4 34 25.4 34.6 25.4 36.8 C25.4 39.4 22 41.6 20 43 Z'));
      ctx.restore();
      ctx.fillStyle = '#c9955c'; ctx.strokeStyle = '#71352b'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(15, 2.5, 10, 7, 2); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = filled ? '#71352b' : '#fff0c2';
    ctx.lineWidth = filled ? 1.4 : 2.0;
    ctx.stroke(bottle);
  }).toDataURL();
}

export function weaponImage(id) {
  return canvas(288, 144, ctx => {
    ctx.scale(3,3);
    ctx.translate(3,1.5);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const outline = new Path2D(WEAPON_ICONS[id]), [light,dark,trim] = ICON_FABRIC[id];
    const wool = ctx.createLinearGradient(0,5,0,44);
    wool.addColorStop(0,light);
    wool.addColorStop(1,dark);
    ctx.fillStyle = wool;
    ctx.fill(outline);
    ctx.save();
    ctx.clip(outline);
    ctx.fillStyle = trim;
    ctx.fill(new Path2D(ICON_INLAYS[id]));
    ctx.strokeStyle = '#fff1cdbd';
    ctx.lineWidth = 1.45;
    ctx.stroke(new Path2D(ICON_SEAMS[id]));
    ctx.restore();
    ctx.strokeStyle = '#332919';
    ctx.lineWidth = 3.2;
    ctx.stroke(outline);
    ctx.strokeStyle = '#ffe5b1';
    ctx.lineWidth = 1.65;
    ctx.stroke(outline);
  }).toDataURL();
}

const healthMaterials = new Map();

export function enemyHealthMaterial(hp, maxHp) {
  const key = maxHp + ':' + hp;
  if (!healthMaterials.has(key)) {
    const image = canvas(256, 36, ctx => {
      const count = Math.min(maxHp, 10), height = 21, gap = 5, y = 8;
      const width = (248 - (count - 1) * gap) / count;
      const colour = ctx.createLinearGradient(0, y, 0, y + height);
      colour.addColorStop(0, '#f6ca6b'); colour.addColorStop(1, '#bc772b');
      for (let i = 0; i < count; i++) {
        const x = 4 + i * (width + gap), filled = Math.max(0, Math.min(1, hp * count / maxHp - i));
        ctx.beginPath(); ctx.roundRect(x, y, width, height, 5);
        ctx.fillStyle = '#25271e'; ctx.fill();
        if (filled > 0) {
          ctx.save(); ctx.clip(); ctx.fillStyle = colour;
          ctx.fillRect(x, y, width * filled, height);
          ctx.restore();
        }
        ctx.lineWidth = 2.25; ctx.strokeStyle = '#edca8acf'; ctx.stroke();
      }
    });
    const map = new T.CanvasTexture(image); map.colorSpace = T.SRGBColorSpace;
    healthMaterials.set(key, new T.SpriteMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
  }
  return healthMaterials.get(key);
}
