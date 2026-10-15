import { CAR } from '../constants';

export const STEER_MAX_DEG_LOW = 35; // at 0 km/h
export const STEER_MAX_DEG_HIGH = 6; // at 200 km/h
export const STEER_REF_KMH = 200;
export const STEER_RAMP_UP = 4; // units/s toward the target
export const STEER_RETURN = 6; // units/s back to center
const DEG = Math.PI / 180;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Max front-wheel angle (degrees) as a function of speed: 35° @0 km/h -> 6° @200 km/h. Monotonic. */
export function maxSteerAngleDeg(speedKmh: number): number {
  const t = clamp(Math.abs(speedKmh) / STEER_REF_KMH, 0, 1);
  return STEER_MAX_DEG_HIGH + (STEER_MAX_DEG_LOW - STEER_MAX_DEG_HIGH) * Math.pow(1 - t, 1.6);
}

/** Smooth the steering input: ramp toward target ~4/s, return to center ~6/s. No overshoot. */
export function smoothSteer(current: number, target: number, dt: number): number {
  const returning =
    target === 0 || (Math.sign(target) === Math.sign(current) && Math.abs(target) < Math.abs(current));
  const rate = returning ? STEER_RETURN : STEER_RAMP_UP;
  const maxStep = rate * dt;
  const diff = target - current;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

/** Deadzone + rescale so output still reaches +-1. */
export function applyDeadzone(v: number, deadzone = 0.12): number {
  const a = Math.abs(v);
  if (a <= deadzone) return 0;
  return Math.sign(v) * Math.min(1, (a - deadzone) / (1 - deadzone));
}

/**
 * Front wheel angle in radians. Positive = LEFT turn (counter-clockwise from above, +yaw rate).
 * steerInput: -1 = full left, +1 = full right.
 */
export function steerInputToWheelAngle(steerInput: number, speedKmh: number, sensitivity = 1): number {
  const maxDeg = Math.min(45, maxSteerAngleDeg(speedKmh) * sensitivity);
  return -clamp(steerInput, -1, 1) * maxDeg * DEG;
}

/**
 * Grip-aware limiter ("steering assist"): lateral acceleration v²·tanδ/L may not exceed aLatMax.
 * Keeps normal corners at 120 km/h from turning into a slide-off.
 */
export function limitSteerByGrip(wheelAngle: number, speedMs: number, aLatMax: number, wheelbase: number = CAR.wheelbase): number {
  const v2 = Math.max(speedMs * speedMs, 1e-3);
  const lim = Math.atan((aLatMax * wheelbase) / v2);
  return clamp(wheelAngle, -lim, lim);
}

/** Kinematic (bicycle-model) yaw rate in rad/s. +ve = counter-clockwise from above. */
export function yawRateFromWheelAngle(wheelAngle: number, speedMs: number, wheelbase: number = CAR.wheelbase): number {
  return (speedMs * Math.tan(wheelAngle)) / wheelbase;
}

/** Yaw rate that a steer input produces (used by the unit test for the sign convention). */
export function yawRateForSteerInput(steerInput: number, speedMs: number, sensitivity = 1): number {
  const angle = steerInputToWheelAngle(steerInput, speedMs * 3.6, sensitivity);
  return yawRateFromWheelAngle(angle, speedMs);
}
