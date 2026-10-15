import * as THREE from 'three';

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function finish(t: THREE.CanvasTexture, maxAniso: number): THREE.CanvasTexture {
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

/** Asphalt with edge lines and a dashed centre line. u spans the 20 m road, v repeats every 16 m. */
export function makeRoadTexture(aniso = 8): THREE.CanvasTexture {
  const w = 512, h = 512;
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#3b3e44';
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // tyre wear bands
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(w * 0.18, 0, w * 0.1, h);
  ctx.fillRect(w * 0.72, 0, w * 0.1, h);
  // edge lines (white) 0.35 m from each side
  ctx.fillStyle = '#e9e9e9';
  ctx.fillRect(w * 0.025, 0, w * 0.014, h);
  ctx.fillRect(w * 0.961, 0, w * 0.014, h);
  // dashed centre line: 3 m dash / 5 m gap (v repeats per 16 m => 2 dashes)
  ctx.fillStyle = '#f2d21b';
  for (let k = 0; k < 2; k++) ctx.fillRect(w * 0.4935, k * (h / 2), w * 0.013, h * (3 / 16));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return finish(t, aniso);
}

export function makeGrassTexture(aniso = 8): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#4c7a34';
  ctx.fillRect(0, 0, 256, 256);
  const r = rng(11);
  for (let i = 0; i < 5200; i++) {
    const g = 90 + r() * 70;
    ctx.fillStyle = `rgba(${40 + r() * 30},${g},${30 + r() * 20},0.55)`;
    ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return finish(t, aniso);
}

export function makeCheckerTexture(cols: number, rows: number): THREE.CanvasTexture {
  const px = 16;
  const [c, ctx] = canvas(cols * px, rows * px);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#111' : '#f5f5f5';
      ctx.fillRect(x * px, y * px, px, px);
    }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return finish(t, 4);
}

export { rng };
