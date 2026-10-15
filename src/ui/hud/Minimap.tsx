import { useEffect, useRef } from 'react';
import { buildTrack, type TrackData } from '../../game/track/trackData';
import { live } from '../../game/state/telemetry';

const SIZE = 320;
const PAD = 22;

function makeBackground(t: TrackData): { canvas: HTMLCanvasElement; map: (x: number, z: number) => [number, number] } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < t.count; i++) {
    minX = Math.min(minX, t.px[i]); maxX = Math.max(maxX, t.px[i]);
    minZ = Math.min(minZ, t.pz[i]); maxZ = Math.max(maxZ, t.pz[i]);
  }
  const scale = Math.min((SIZE - PAD * 2) / (maxX - minX), (SIZE - PAD * 2) / (maxZ - minZ));
  const ox = (SIZE - (maxX - minX) * scale) / 2 - minX * scale;
  const oz = (SIZE - (maxZ - minZ) * scale) / 2 - minZ * scale;
  const map = (x: number, z: number): [number, number] => [x * scale + ox, z * scale + oz];
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const g = c.getContext('2d');
  if (g) {
    const path = () => {
      g.beginPath();
      for (let i = 0; i <= t.count; i += 4) {
        const k = i % t.count;
        const [x, y] = map(t.px[k], t.pz[k]);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
    };
    g.lineJoin = 'round';
    g.lineCap = 'round';
    path(); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 13; g.stroke();
    path(); g.strokeStyle = '#242a38'; g.lineWidth = 9; g.stroke();
    // start / finish
    const gi = t.gates[0];
    const [sx, sy] = map(t.px[gi], t.pz[gi]);
    g.fillStyle = '#fff';
    g.fillRect(sx - 9, sy - 2, 18, 4);
  }
  return { canvas: c, map };
}

/** Track outline + live car position/heading. Drawn imperatively in requestAnimationFrame (no React renders). */
export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const bg = makeBackground(buildTrack());
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const L = live();
      g.clearRect(0, 0, SIZE, SIZE);
      g.drawImage(bg.canvas, 0, 0);
      for (let i = 0; i < L.ai.length; i++) {
        const a = L.ai[i];
        const [x, y] = bg.map(a.x, a.z);
        g.fillStyle = ['#2a9d8f', '#f4a261', '#3a86ff'][i % 3];
        g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
      }
      const [px, py] = bg.map(L.car.x, L.car.z);
      // heading: forward = (-sin yaw, -cos yaw) in world (x right, z down on the map)
      const ang = Math.atan2(-Math.cos(L.car.yaw), -Math.sin(L.car.yaw));
      g.save();
      g.translate(px, py);
      g.rotate(ang);
      g.fillStyle = '#ffd166';
      g.strokeStyle = '#000';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(13, 0); g.lineTo(-9, 8); g.lineTo(-5, 0); g.lineTo(-9, -8); g.closePath();
      g.fill(); g.stroke();
      g.restore();
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="minimap" width={SIZE} height={SIZE} aria-label="Minimap" />;
}
