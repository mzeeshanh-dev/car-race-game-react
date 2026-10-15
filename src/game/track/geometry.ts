import { TRACK_CFG } from '../constants';
import type { TrackData } from './trackData';

/** lateral offsets of the cross-section columns: embankment | shoulder | ROAD | shoulder | embankment */
const R = TRACK_CFG.roadWidth / 2;
const S = R + TRACK_CFG.shoulder;
const E = S + TRACK_CFG.embankment;
export const COLUMNS = [-E, -S, -R, R, S, E] as const;
export const STRIPS = COLUMNS.length - 1;
/** strip order -> material: 0 embankment, 1 shoulder, 2 road, 3 shoulder, 4 embankment */
export const ROAD_STRIP = 2;

export interface RoadGeometryData {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  groups: { start: number; count: number; materialIndex: number }[];
}

/**
 * ONE source of truth: this exact vertex/index data is used for the rendered road mesh AND the trimesh collider,
 * so visuals and physics always match.
 */
export function buildRoadGeometry(t: TrackData): RoadGeometryData {
  const N = t.count;
  const rings = N + 1; // duplicate first ring to close the loop
  const cols = COLUMNS.length;
  const positions = new Float32Array(rings * cols * 3);
  const uvs = new Float32Array(rings * cols * 2);
  for (let r = 0; r < rings; r++) {
    const i = r % N;
    for (let c = 0; c < cols; c++) {
      const lat = COLUMNS[c];
      const v = r * cols + c;
      let y = t.py[i];
      if (c === 0 || c === cols - 1) y = TRACK_CFG.groundY + 0.02; // embankment drops to the ground
      positions[v * 3] = t.px[i] + t.rx[i] * lat;
      positions[v * 3 + 1] = y;
      positions[v * 3 + 2] = t.pz[i] + t.rz[i] * lat;
      uvs[v * 2] = (lat + R) / (2 * R);
      uvs[v * 2 + 1] = (r * t.step) / TRACK_CFG.texRepeat;
    }
  }
  const indices = new Uint32Array(N * STRIPS * 6);
  const groups: RoadGeometryData['groups'] = [];
  let w = 0;
  for (let strip = 0; strip < STRIPS; strip++) {
    const start = w;
    for (let r = 0; r < N; r++) {
      const a = r * cols + strip;
      const b = a + 1;
      const c = (r + 1) * cols + strip;
      const d = c + 1;
      indices[w++] = a; indices[w++] = b; indices[w++] = c;
      indices[w++] = b; indices[w++] = d; indices[w++] = c;
    }
    groups.push({ start, count: w - start, materialIndex: strip });
  }
  return { positions, uvs, indices, groups };
}
