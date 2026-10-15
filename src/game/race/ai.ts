import { sampleAt, type TrackData } from '../track/trackData';

export interface AIDef { name: string; color: string; topKmh: number; lateral: number; gridSlot: number }

export const AI_DEFS: readonly AIDef[] = [
  { name: 'Viper', color: '#2a9d8f', topKmh: 178, lateral: 4, gridSlot: 0 },
  { name: 'Comet', color: '#f4a261', topKmh: 170, lateral: -4, gridSlot: 1 },
  { name: 'Orca', color: '#3a86ff', topKmh: 162, lateral: 4, gridSlot: 2 },
];

/** Grid slots (0 = pole). AI take slots 0-2, the player starts in slot 3 so nobody can rear-end a stationary car. */
export function gridSlot(slot: number): { back: number; lateral: number } {
  return { back: 9 + slot * 8, lateral: slot % 2 === 0 ? -4 : 4 };
}

export const AI_ACCEL = 6.5;
export const AI_BRAKE = 13;
export const AI_LAT_G = 9.5;

/** Target speed (m/s) at arc position s: top speed, limited by upcoming corners with braking distance. */
export function planSpeed(track: TrackData, s: number, topMs: number, aLat = AI_LAT_G, brake = AI_BRAKE * 0.7): number {
  let v = topMs;
  for (let d = 0; d <= 120; d += 12) {
    const f = ((((s + d) / track.step) % track.count) + track.count) % track.count;
    const i = Math.floor(f);
    const k = Math.max(track.curv[i], track.curv[(i + 1) % track.count], 1e-4);
    const vc = Math.sqrt(aLat / k);
    v = Math.min(v, Math.sqrt(vc * vc + 2 * brake * d));
  }
  return v;
}

export interface AIState { s: number; v: number; dist: number; lateral: number; x: number; y: number; z: number; yaw: number; pitch: number }

const tmp = { x: 0, y: 0, z: 0, fx: 0, fz: 0, rx: 0, rz: 0, curv: 0, yaw: 0 };
const tmp2 = { x: 0, y: 0, z: 0, fx: 0, fz: 0, rx: 0, rz: 0, curv: 0, yaw: 0 };

export function stepAI(track: TrackData, st: AIState, def: AIDef, dt: number): void {
  const vt = planSpeed(track, st.s, def.topKmh / 3.6);
  const dv = vt - st.v;
  st.v += Math.max(-AI_BRAKE * dt, Math.min(AI_ACCEL * dt, dv));
  const ds = st.v * dt;
  st.s = (st.s + ds) % track.length;
  st.dist += ds;
  placeAI(track, st);
}

export function placeAI(track: TrackData, st: AIState): void {
  sampleAt(track, st.s, tmp);
  st.x = tmp.x + tmp.rx * st.lateral;
  st.z = tmp.z + tmp.rz * st.lateral;
  sampleAt(track, st.s + 3, tmp2);
  st.pitch = Math.atan2(tmp2.y - tmp.y, 3);
  st.y = tmp.y + 0.72;
  st.yaw = tmp.yaw;
}

export function initAI(track: TrackData, def: AIDef): AIState {
  const g = gridSlot(def.gridSlot);
  const s = (((track.gateS[0] - g.back) % track.length) + track.length) % track.length;
  const st: AIState = { s, v: 0, dist: -g.back, lateral: g.lateral, x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  placeAI(track, st);
  return st;
}
