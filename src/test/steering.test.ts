import { describe, expect, it } from 'vitest';
import {
  applyDeadzone, limitSteerByGrip, maxSteerAngleDeg, smoothSteer, steerInputToWheelAngle, yawRateForSteerInput,
} from '../game/input/steering';
import { makeRig } from './harness';

describe('steering sign (-Z forward, +Y up, yaw CCW from above)', () => {
  it('formula: input -1 (left) => positive yaw rate, +1 (right) => negative', () => {
    expect(yawRateForSteerInput(-1, 20)).toBeGreaterThan(0);
    expect(yawRateForSteerInput(1, 20)).toBeLessThan(0);
    expect(yawRateForSteerInput(0, 20)).toBeCloseTo(0, 10);
  });
  it('real Rapier vehicle: left key yaws CCW and moves toward -X, right key the opposite', async () => {
    for (const [steer, sign] of [[-1, 1], [1, -1]] as const) {
      const rig = await makeRig();
      rig.step({}, 60);
      rig.step({ throttle: 1, steer }, 90);
      expect(Math.sign(rig.sim.body.angvel().y)).toBe(sign);
      expect(Math.sign(rig.yaw())).toBe(sign);
      expect(Math.sign(rig.pos().x)).toBe(-sign); // left = -X when facing -Z
    }
  });
});

describe('speed-sensitive steering curve', () => {
  it('is ~35° at 0 km/h and ~6° at 200 km/h', () => {
    expect(maxSteerAngleDeg(0)).toBeCloseTo(35, 5);
    expect(maxSteerAngleDeg(200)).toBeCloseTo(6, 5);
    expect(maxSteerAngleDeg(400)).toBeCloseTo(6, 5);
  });
  it('is monotonically decreasing', () => {
    let prev = Infinity;
    for (let v = 0; v <= 220; v += 5) { const a = maxSteerAngleDeg(v); expect(a).toBeLessThanOrEqual(prev); prev = a; }
  });
  it('sensitivity scales the angle', () => {
    const a = Math.abs(steerInputToWheelAngle(1, 60, 0.5));
    const b = Math.abs(steerInputToWheelAngle(1, 60, 1.5));
    expect(b / a).toBeCloseTo(3, 5);
  });
  it('grip limiter caps wheel angle at high speed but not when crawling', () => {
    const big = 0.6;
    expect(limitSteerByGrip(big, 33, 12.5)).toBeLessThan(0.05);
    expect(limitSteerByGrip(big, 2, 12.5)).toBeCloseTo(big, 5);
    expect(limitSteerByGrip(-big, 33, 12.5)).toBeLessThan(0);
  });
});

describe('input smoothing', () => {
  it('ramps toward the target at ~4/s (0.5 s => ~2 clamped to 1)', () => {
    let v = 0;
    for (let i = 0; i < 15; i++) v = smoothSteer(v, 1, 1 / 60); // 0.25 s
    expect(v).toBeCloseTo(1, 5);
    v = 0;
    for (let i = 0; i < 6; i++) v = smoothSteer(v, 1, 1 / 60); // 0.1 s
    expect(v).toBeCloseTo(0.4, 5);
  });
  it('returns to centre at ~6/s (faster than it ramps)', () => {
    let v = 1;
    for (let i = 0; i < 6; i++) v = smoothSteer(v, 0, 1 / 60); // 0.1 s
    expect(v).toBeCloseTo(0.4, 5);
  });
  it('never overshoots and is frame-rate stable', () => {
    expect(smoothSteer(0.99, 1, 1)).toBe(1);
    let a = 0, b = 0;
    for (let i = 0; i < 30; i++) a = smoothSteer(a, 0.8, 1 / 120);
    for (let i = 0; i < 15; i++) b = smoothSteer(b, 0.8, 1 / 60);
    expect(a).toBeCloseTo(b, 5);
  });
  it('crossing from left to right uses the ramp rate', () => {
    expect(smoothSteer(-1, 1, 0.1)).toBeCloseTo(-0.6, 5);
  });
  it('gamepad deadzone', () => {
    expect(applyDeadzone(0.1)).toBe(0);
    expect(applyDeadzone(-0.05)).toBe(0);
    expect(applyDeadzone(1)).toBe(1);
    expect(applyDeadzone(-1)).toBe(-1);
    expect(applyDeadzone(0.56)).toBeCloseTo(0.5, 2);
  });
});
