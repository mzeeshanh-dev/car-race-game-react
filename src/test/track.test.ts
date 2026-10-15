import { describe, expect, it } from 'vitest';
import { TRACK_CFG } from '../game/constants';
import { buildBarrierSegments } from '../game/track/barriers';
import { COLUMNS, buildRoadGeometry } from '../game/track/geometry';
import { CONTROL_POINT_COUNT, buildTrack, nearestOnTrack, createNearest, trackYaw } from '../game/track/trackData';

describe('track', () => {
  const t = buildTrack();
  it('closed spline from >= 12 control points, 20 m road', () => {
    expect(CONTROL_POINT_COUNT).toBeGreaterThanOrEqual(12);
    expect(TRACK_CFG.roadWidth).toBe(20);
    const g = buildRoadGeometry(t);
    const roadWidthAtSample = Math.abs(COLUMNS[3] - COLUMNS[2]);
    expect(roadWidthAtSample).toBe(20);
    // closed: last ring duplicates the first
    const cols = COLUMNS.length;
    for (let c = 0; c < cols * 3; c++) expect(g.positions[(t.count * cols) * 3 + c]).toBeCloseTo(g.positions[c], 4);
  });
  it('corners are wide enough for the road (min radius > road half-width + margin) and gently sloped', () => {
    let maxCurv = 0;
    for (let i = 0; i < t.count; i++) maxCurv = Math.max(maxCurv, t.curv[i]);
    expect(1 / maxCurv).toBeGreaterThan(40);
    let slope = 0;
    for (let i = 0; i < t.count; i++) slope = Math.max(slope, Math.abs(t.py[(i + 1) % t.count] - t.py[i]) / t.step);
    expect(slope).toBeLessThan(0.06);
  });
  it('never overlaps itself', () => {
    let min = Infinity;
    for (let i = 0; i < t.count; i += 3)
      for (let j = i + 1; j < t.count; j += 3) {
        const arc = Math.min(j - i, t.count - (j - i)) * t.step;
        if (arc < 150) continue;
        min = Math.min(min, Math.hypot(t.px[i] - t.px[j], t.pz[i] - t.pz[j]));
      }
    expect(min).toBeGreaterThan(60);
  });
  it('starts heading -Z', () => {
    expect(t.fz[0]).toBeLessThan(-0.95);
    expect(Math.abs(trackYaw(t, 0))).toBeLessThan(0.3);
  });
  it('barriers cover both sides and sit outside the road', () => {
    const segs = buildBarrierSegments(t);
    expect(segs.some((s) => s.side === -1)).toBe(true);
    expect(segs.some((s) => s.side === 1)).toBe(true);
    const n = createNearest();
    for (const s of segs.slice(0, 40)) {
      nearestOnTrack(t, s.cx, s.cz, -1, n);
      expect(Math.abs(n.lateral)).toBeGreaterThan(TRACK_CFG.roadWidth / 2 + 3);
    }
  });
  it('nearest query is consistent with / without a hint', () => {
    const a = createNearest(), b = createNearest();
    nearestOnTrack(t, t.px[300] + 3, t.pz[300] + 2, -1, a);
    nearestOnTrack(t, t.px[300] + 3, t.pz[300] + 2, 290, b);
    expect(a.index).toBe(b.index);
  });
});
