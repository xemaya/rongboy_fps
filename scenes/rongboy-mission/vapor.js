import * as T from 'three';

let vaporMap;

function vaporTexture() {
  if (vaporMap) return vaporMap;
  const size = 96, pixels = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const x = (column + .5) / size * 2 - 1, y = (row + .5) / size * 2 - 1;
    const curl = .14 * Math.sin(4.6 * y + .45) + .06 * Math.sin(9 * y);
    const swath = Math.exp(-(((x - curl) / .38) ** 2 + ((y + .08) / .63) ** 2));
    const edge = Math.max(0, 1 - x * x - y * y);
    const strands = .79 + .11 * Math.sin(13 * x + 5 * y) + .10 * Math.sin(22 * x - 8 * y);
    const i = (row * size + column) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = Math.round(255 * swath * edge ** 1.4 * strands);
  }
  vaporMap = new T.DataTexture(pixels, size, size);
  vaporMap.minFilter = T.LinearMipmapLinearFilter;
  vaporMap.magFilter = T.LinearFilter;
  vaporMap.generateMipmaps = true;
  vaporMap.needsUpdate = true;
  return vaporMap;
}

// The same soft texture keeps the steam and chimney smoke in the fabric world.
// Opacity fades at both ends, and scene depth hides the sprites behind solids.
export function createVapor({ parent, x = 0, y = 0, z = 0, count = 6, color = 0xf4e9d7,
  duration = 1.05, opacity = .44, rise = .76, size = .52, drift = .15, loop = false }) {
  const sprites = Array.from({ length: count }, () => {
    const material = new T.SpriteMaterial({ map:vaporTexture(), color, transparent:true, depthTest:true, depthWrite:false });
    const sprite = new T.Sprite(material);
    sprite.visible = false;
    parent.add(sprite);
    return sprite;
  });
  return time => {
    for (const [i, sprite] of sprites.entries()) {
      const t = loop ? (time / duration + i / count) % 1 : (time - i * .061) / duration;
      sprite.visible = t > 0 && t < 1;
      if (!sprite.visible) continue;
      const curl = Math.sin(i * 2.17 + t * 4.6);
      sprite.position.set(x + drift * t * t + size * curl * .13 * t, y + rise * t,
        z + size * Math.cos(t * 4.1 + i * 2.17) * .095 * t);
      const width = size * (.37 + t * .79);
      sprite.scale.set(width, width * (1.45 - t * .22), 1);
      sprite.material.rotation = curl * .34 - t * .29;
      const enter = T.MathUtils.smoothstep(t, 0, .13);
      sprite.material.opacity = opacity * enter * (1 - t) ** 1.24;
    }
  };
}
