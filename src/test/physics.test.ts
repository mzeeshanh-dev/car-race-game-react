import { describe, expect, it } from 'vitest';
import { buildTrack } from '../game/track/trackData';
import { TUNING } from '../game/vehicle/VehicleSim';
import { makeRig, type Rig } from './harness';

const T = buildTrack();

function yawOf(rig: Rig): number { return rig.yaw(); }

async function pursuit(targetKmh: number, seconds: number, opts: { fullLockAt?: number } = {}) {
  const rig = await makeRig({ track: true });
  rig.step({}, 60);
  let idx = 0, maxLat = 0, minUp = 1, offRoad = 0, maxKmh = 0;
  const target = targetKmh / 3.6;
  const ahead = Math.round(25 / T.step);
  for (let i = 0; i < 60 * seconds; i++) {
    const p = rig.pos();
    const L = rig.sim.live;
    let bi = idx, bd = 1e9;
    for (let k = -20; k <= 20; k++) { const j = (idx + k + T.count) % T.count; const d = Math.hypot(p.x - T.px[j], p.z - T.pz[j]); if (d < bd) { bd = d; bi = j; } }
    idx = bi;
    let kmax = 0;
    for (let k = 0; k < 40; k += 4) kmax = Math.max(kmax, T.curv[(bi + k) % T.count]);
    const vt = Math.min(target, Math.sqrt(8 / Math.max(kmax, 1e-4)));
    const tj = (bi + ahead) % T.count;
    const want = Math.atan2(-(T.px[tj] - p.x), -(T.pz[tj] - p.z));
    let err = want - yawOf(rig);
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    const steer = Math.max(-1, Math.min(1, -err * 2.5));
    rig.step({ throttle: L.speedMs < vt ? 0.9 : 0, brake: L.speedMs > vt + 2 ? 0.5 : 0, steer }, 1);
    maxLat = Math.max(maxLat, Math.abs(L.lateral)); minUp = Math.min(minUp, L.upY); maxKmh = Math.max(maxKmh, L.speedKmh);
    if (!L.onRoad) offRoad++;
  }
  return { maxLat, minUp, offRoad, maxKmh, idx };
}

describe('vehicle physics (Rapier DynamicRayCastVehicleController)', () => {
  it('0-100 km/h in about 6 s and top speed about 220 km/h', async () => {
    const rig = await makeRig();
    rig.step({}, 90);
    let t100 = -1;
    for (let i = 0; i < 60 * 50; i++) { rig.step({ throttle: 1 }); if (t100 < 0 && rig.sim.live.speedKmh >= 100) t100 = i / 60; }
    expect(t100).toBeGreaterThan(5);
    expect(t100).toBeLessThan(7);
    expect(rig.sim.live.speedKmh).toBeGreaterThan(205);
    expect(rig.sim.live.speedKmh).toBeLessThan(235);
    expect(rig.sim.live.gear).toBe(6);
  });

  it('S brakes while moving forward and only reverses when nearly stopped', async () => {
    const rig = await makeRig();
    rig.step({}, 60);
    rig.sim.body.setLinvel({ x: 0, y: 0, z: -25 }, true);
    rig.step({ brake: 1 }, 30);
    expect(rig.sim.live.speedMs).toBeGreaterThan(0); // still rolling forward, not reversing yet
    expect(rig.sim.live.gear).toBeGreaterThan(0);
    rig.step({ brake: 1 }, 60 * 8);
    expect(rig.sim.live.speedMs).toBeLessThan(-1); // now reversing
    expect(rig.sim.live.gear).toBe(0);
  });

  it('chassis stays upright and near-level at all speeds', async () => {
    const rig = await makeRig();
    rig.step({}, 60);
    let minUp = 1;
    for (let i = 0; i < 60 * 25; i++) { rig.step({ throttle: 1, steer: Math.sin(i / 40) }); minUp = Math.min(minUp, rig.sim.live.upY); }
    expect(minUp).toBeGreaterThan(0.93);
  });

  it('a normal 120 km/h lap stays on the road and never flips', async () => {
    const r = await pursuit(120, 110);
    expect(r.offRoad).toBe(0);
    expect(r.maxLat).toBeLessThan(10);
    expect(r.minUp).toBeGreaterThan(0.95);
    expect(r.maxKmh).toBeGreaterThan(100);
  });

  it('full-lock keyboard steering at 120 km/h does not flip the car', async () => {
    const rig = await makeRig();
    rig.step({}, 60);
    rig.sim.body.setLinvel({ x: 0, y: 0, z: -33.3 }, true);
    let minUp = 1;
    for (let i = 0; i < 60 * 6; i++) { rig.step({ throttle: 0.4, steer: 1 }); minUp = Math.min(minUp, rig.sim.live.upY); }
    expect(minUp).toBeGreaterThan(0.9);
  });

  it('handbrake makes the rear break away (more yaw than without)', async () => {
    const run = async (hand: boolean) => {
      const rig = await makeRig();
      rig.step({}, 60);
      rig.sim.body.setLinvel({ x: 0, y: 0, z: -22 }, true);
      let maxYawRate = 0;
      for (let i = 0; i < 90; i++) { rig.step({ throttle: 0.6, steer: 0.8, handbrake: hand }); maxYawRate = Math.max(maxYawRate, Math.abs(rig.sim.live.yawRate)); }
      return { maxYawRate, minUp: rig.sim.live.upY };
    };
    const normal = await run(false);
    const drift = await run(true);
    expect(drift.maxYawRate).toBeGreaterThan(normal.maxYawRate * 1.1);
    expect(drift.minUp).toBeGreaterThan(0.85);
  });

  it('barriers keep the car on the circuit when hit at speed (30° into the wall)', async () => {
    const rig = await makeRig({ track: true });
    rig.step({}, 60);
    // straight section after the start line: aim 30° toward the right wall at 150 km/h
    const yaw = yawOf(rig) - 0.5; // turn right (negative yaw)
    rig.sim.respawn(T.px[20], T.py[20] + 1, T.pz[20], yaw);
    rig.step({}, 20);
    const v = 150 / 3.6;
    rig.sim.body.setLinvel({ x: -Math.sin(yaw) * v, y: 0, z: -Math.cos(yaw) * v }, true);
    let maxLat = 0, minUp = 1;
    for (let i = 0; i < 60 * 8; i++) {
      rig.step({ throttle: 0.5 });
      maxLat = Math.max(maxLat, Math.abs(rig.sim.live.lateral)); minUp = Math.min(minUp, rig.sim.live.upY);
    }
    expect(maxLat).toBeLessThan(15.2); // never beyond the outer wall face
    expect(minUp).toBeGreaterThan(0.3);
  });

  it('asphalt vs grass: grass is clearly slower and has less grip', async () => {
    const accel = async (offset: number) => {
      const rig = await makeRig({ track: true });
      const i = 10;
      rig.sim.respawn(T.px[i] + T.rx[i] * offset, T.py[i] + 1, T.pz[i] + T.rz[i] * offset, Math.atan2(-T.fx[i], -T.fz[i]));
      rig.step({}, 60);
      for (let k = 0; k < 60 * 4; k++) rig.step({ throttle: 1 });
      return rig.sim.live.speedKmh;
    };
    const road = await accel(0);
    const grass = await accel(11.5); // shoulder
    expect(road).toBeGreaterThan(grass * 1.25);
  });

  it('surface constants', async () => {
    const { SURFACES } = await import('../game/vehicle/surface');
    expect(SURFACES.asphalt.friction).toBe(1.0);
    expect(SURFACES.grass.friction).toBe(0.5);
    expect(TUNING.downforce).toBeGreaterThan(0);
  });
});
