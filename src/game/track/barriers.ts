import * as THREE from 'three';
import { TRACK_CFG } from '../constants';
import type { TrackData } from './trackData';

export interface BarrierSegment {
  cx: number; cy: number; cz: number;
  hx: number; hy: number; hz: number; // half extents (thickness, height, length)
  qx: number; qy: number; qz: number; qw: number;
  side: -1 | 1;
}

const STEP = 2; // samples per segment (~6 m)

/** Solid guard-rail segments on both sides of the road (shared by collider and instanced visuals). */
export function buildBarrierSegments(t: TrackData): BarrierSegment[] {
  const out: BarrierSegment[] = [];
  const N = t.count;
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const f = new THREE.Vector3();
  const r = new THREE.Vector3();
  const u = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  const halfH = TRACK_CFG.barrierHeight / 2;
  for (const side of [-1, 1] as const) {
    const lat = side * TRACK_CFG.barrierOffset;
    for (let i = 0; i < N; i += STEP) {
      const j = (i + STEP) % N;
      A.set(t.px[i] + t.rx[i] * lat, t.py[i], t.pz[i] + t.rz[i] * lat);
      B.set(t.px[j] + t.rx[j] * lat, t.py[j], t.pz[j] + t.rz[j] * lat);
      f.subVectors(B, A);
      const len = f.length();
      f.normalize();
      r.crossVectors(f, Y).normalize();
      u.crossVectors(r, f).normalize();
      m.makeBasis(r, u, f.clone().negate());
      q.setFromRotationMatrix(m);
      out.push({
        cx: (A.x + B.x) / 2, cy: (A.y + B.y) / 2 + halfH - 0.35, cz: (A.z + B.z) / 2,
        hx: TRACK_CFG.barrierHalfThickness, hy: halfH, hz: len / 2 + 0.3,
        qx: q.x, qy: q.y, qz: q.z, qw: q.w, side,
      });
    }
  }
  return out;
}
