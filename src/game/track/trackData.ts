import * as THREE from 'three';
import { TRACK_CFG } from '../constants';

/** 16 control points [x, y, z] (metres). Closed centripetal Catmull-Rom => smooth corners, gentle elevation. */
const RAW_POINTS: ReadonlyArray<readonly [number, number, number]> = [
  [582, 3.6, 0], [523, 3.4, 161], [370, 2.3, 274], [154, 1.3, 275],
  [0, 1.0, 181], [-78, 1.0, 139], [-263, 0.9, 195], [-599, 1.1, 184],
  [-795, 2.1, 0], [-625, 3.3, -192], [-279, 3.7, -206], [-74, 2.5, -131],
  [0, 0.5, -159], [149, -0.6, -267], [386, 0.2, -286], [549, 2.2, -169],
];
export const CONTROL_POINT_COUNT = RAW_POINTS.length;

export interface TrackData {
  count: number;
  length: number;
  step: number;
  px: Float32Array; py: Float32Array; pz: Float32Array; // centre line
  tx: Float32Array; ty: Float32Array; tz: Float32Array; // 3D unit tangent
  fx: Float32Array; fz: Float32Array; // flat (XZ) unit tangent
  rx: Float32Array; rz: Float32Array; // flat unit right vector (T x Y)
  curv: Float32Array; // |curvature| 1/m
  gates: number[]; // sample index of each checkpoint gate, gates[0] = start/finish
  gateS: number[]; // arc position of each gate
  controlPoints: THREE.Vector3[];
}

function makePoints(rotate: number, origin: THREE.Vector3 | null): THREE.Vector3[] {
  const c = Math.cos(rotate);
  const s = Math.sin(rotate);
  return RAW_POINTS.map(([x, y, z]) => {
    const ox = origin ? x - origin.x : x;
    const oz = origin ? z - origin.z : z;
    // yaw rotation by `rotate` about +Y
    const rx = (ox * c + oz * s) * TRACK_CFG.scale;
    const rz = (-ox * s + oz * c) * TRACK_CFG.scale;
    return new THREE.Vector3(rx, y + 1.0, rz);
  });
}

let cached: TrackData | null = null;

export function buildTrack(): TrackData {
  if (cached) return cached;
  // 1st pass: find the start tangent so we can rotate the circuit so the start line points to -Z.
  const first = new THREE.CatmullRomCurve3(makePoints(0, new THREE.Vector3(RAW_POINTS[0][0], 0, RAW_POINTS[0][2])), true, 'centripetal');
  const t0 = first.getTangentAt(0);
  const yawT = Math.atan2(-t0.x, -t0.z);
  const pts = makePoints(-yawT, new THREE.Vector3(RAW_POINTS[0][0], 0, RAW_POINTS[0][2]));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');

  const N = TRACK_CFG.sampleCount;
  const length = curve.getLength();
  const spaced = curve.getSpacedPoints(N); // N+1 points, last == first
  const mk = () => new Float32Array(N);
  const d: TrackData = {
    count: N, length, step: length / N,
    px: mk(), py: mk(), pz: mk(), tx: mk(), ty: mk(), tz: mk(),
    fx: mk(), fz: mk(), rx: mk(), rz: mk(), curv: mk(),
    gates: [], gateS: [], controlPoints: pts,
  };
  for (let i = 0; i < N; i++) {
    d.px[i] = spaced[i].x; d.py[i] = spaced[i].y; d.pz[i] = spaced[i].z;
  }
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N;
    const b = (i + 1) % N;
    let x = d.px[b] - d.px[a];
    let y = d.py[b] - d.py[a];
    let z = d.pz[b] - d.pz[a];
    const l = Math.hypot(x, y, z) || 1;
    d.tx[i] = x / l; d.ty[i] = y / l; d.tz[i] = z / l;
    const fl = Math.hypot(x, z) || 1;
    d.fx[i] = x / fl; d.fz[i] = z / fl;
    // right = forward x up ; (fx,0,fz) x (0,1,0) = (-fz, 0, fx)... with -Z forward: (0,0,-1) -> (+1,0,0)
    d.rx[i] = -d.fz[i];
    d.rz[i] = d.fx[i];
    x = 0; y = 0; z = 0;
  }
  for (let i = 0; i < N; i++) {
    const a = (i - 3 + N) % N;
    const b = (i + 3) % N;
    const cross = d.fx[a] * d.fz[b] - d.fz[a] * d.fx[b];
    const dot = d.fx[a] * d.fx[b] + d.fz[a] * d.fz[b];
    d.curv[i] = Math.abs(Math.atan2(cross, dot)) / (6 * d.step);
  }
  const K = TRACK_CFG.checkpointCount;
  for (let k = 0; k < K; k++) {
    const idx = Math.round((k * N) / K) % N;
    d.gates.push(idx);
    d.gateS.push(idx * d.step);
  }
  cached = d;
  return d;
}

export interface NearestResult {
  index: number;
  lateral: number; // metres, +right
  dist: number; // planar distance to the nearest centre-line sample
  s: number; // arc-length position 0..length
  y: number; // road height at that sample
}

export function createNearest(): NearestResult {
  return { index: 0, lateral: 0, dist: 0, s: 0, y: 0 };
}

/** Allocation-free nearest-sample queries, windowed around a hint index with global fallback. */
export function nearestOnTrack(t: TrackData, x: number, z: number, hint: number, out: NearestResult, window = 40): NearestResult {
  const N = t.count;
  let best = -1;
  let bestD = Infinity;
  if (hint >= 0) {
    for (let k = -window; k <= window; k++) {
      const i = (hint + k + N) % N;
      const dx = x - t.px[i];
      const dz = z - t.pz[i];
      const dd = dx * dx + dz * dz;
      if (dd < bestD) { bestD = dd; best = i; }
    }
  }
  if (best < 0 || bestD > 45 * 45) {
    for (let i = 0; i < N; i++) {
      const dx = x - t.px[i];
      const dz = z - t.pz[i];
      const dd = dx * dx + dz * dz;
      if (dd < bestD) { bestD = dd; best = i; }
    }
  }
  const dx = x - t.px[best];
  const dz = z - t.pz[best];
  const along = dx * t.fx[best] + dz * t.fz[best];
  out.index = best;
  out.lateral = dx * t.rx[best] + dz * t.rz[best];
  out.dist = Math.sqrt(bestD);
  out.s = (((best * t.step + along) % t.length) + t.length) % t.length;
  out.y = t.py[best];
  return out;
}

/** Heading (yaw, +CCW from above) of the track at sample i. */
export function trackYaw(t: TrackData, i: number): number {
  return Math.atan2(-t.fx[i], -t.fz[i]);
}

/** Interpolated centre-line position/tangent at arc length s. Writes into `out` (x,y,z,fx,fz,rx,rz,curv). */
export function sampleAt(t: TrackData, s: number, out: { x: number; y: number; z: number; fx: number; fz: number; rx: number; rz: number; curv: number; yaw: number }): void {
  const f = (((s / t.step) % t.count) + t.count) % t.count;
  const i = Math.floor(f);
  const j = (i + 1) % t.count;
  const a = f - i;
  out.x = t.px[i] + (t.px[j] - t.px[i]) * a;
  out.y = t.py[i] + (t.py[j] - t.py[i]) * a;
  out.z = t.pz[i] + (t.pz[j] - t.pz[i]) * a;
  let fx = t.fx[i] + (t.fx[j] - t.fx[i]) * a;
  let fz = t.fz[i] + (t.fz[j] - t.fz[i]) * a;
  const l = Math.hypot(fx, fz) || 1;
  fx /= l; fz /= l;
  out.fx = fx; out.fz = fz; out.rx = -fz; out.rz = fx;
  out.curv = t.curv[i] + (t.curv[j] - t.curv[i]) * a;
  out.yaw = Math.atan2(-fx, -fz);
}
