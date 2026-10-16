import { describe, expect, it } from 'vitest';
import { screenLean, TiltInput } from '../game/input/tilt';
import { effects, reportImpact } from '../game/state/effects';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../persistence/db';
import { makeRig } from './harness';

describe('upgrade regressions', () => {
  it('maps screen rotation, calibrates tilt, applies deadzone and expires stale sensors', () => {
    expect(screenLean(20, 0, 90)).toBeCloseTo(20);
    expect(screenLean(20, 0, 270)).toBeCloseTo(-20);
    const tilt = new TiltInput(); tilt.enabled = true;
    tilt.receive(0, 10, 0, 100); expect(tilt.sample(101)).toBe(0);
    tilt.receive(0, 11, 0, 110); expect(tilt.sample(111)).toBe(0);
    tilt.receive(0, 35, 0, 120); expect(tilt.sample(121)).toBe(1);
    tilt.calibrate(); expect(tilt.sample(130)).toBe(0);
    tilt.receive(0, 10, 0, 140); expect(tilt.sample(141)).toBe(-1);
    expect(tilt.sample(1000)).toBe(0);
    tilt.receive(20, 0, 90, 1100); expect(tilt.sample(1101)).toBe(0);
  });
  it('ignores resting contact and rate limits impact feedback', () => {
    effects.serial = 0; effects.time = -Infinity;
    reportImpact(12000, 1 / 60, 1200, 0, 0, 0, 0); expect(effects.serial).toBe(0);
    reportImpact(300000, 1 / 60, 1200, 1, 2, 3, 100); expect(effects.serial).toBe(1);
    expect(effects.strength).toBeGreaterThan(0); expect(effects.x).toBe(1);
    reportImpact(300000, 1 / 60, 1200, 0, 0, 0, 200); expect(effects.serial).toBe(1);
    reportImpact(300000, 1 / 60, 1200, 0, 0, 0, 400); expect(effects.serial).toBe(2);
  });
  it('migrates old settings without losing explicit zero volume', () => {
    const old = { sensitivity: 1, quality: 'high', cameraMode: 2, carColor: '#ffffff', volume: 0, muted: false };
    expect(sanitizeSettings(old as typeof DEFAULT_SETTINGS)).toMatchObject({ environment: 'day', sfxVolume: 0.6, volume: 0, tilt: false });
  });
  it('reports true speed and lateral slip, including a sideways slide', async () => {
    const rig = await makeRig(); rig.step({}, 60);
    rig.sim.body.setLinvel({ x: 10, y: 0, z: 0 }, true); rig.step({});
    expect(rig.sim.live.speedKmh).toBeCloseTo(36, 0);
    expect(rig.sim.live.slip).toBeCloseTo(10, 0);
    rig.world.free();
  });
});
