import { MAX_FOV, MIN_FOV, TOP_SPEED_KMH } from '../constants';

/** Offsets are in car-local, yaw-only space: +x right, +y up, +z BEHIND the car (forward is -Z). */
export interface CameraMode {
  id: string;
  name: string;
  offset: [number, number, number];
  look: [number, number, number];
  yawLambda: number; // follow stiffness of the smoothed heading (higher = tighter)
  yLambda: number;
  fovOffset: number;
  shake: number;
  lookAhead: number;
  hideBody: boolean;
  interior: boolean;
  stretch: number; // distance growth with speed
}

export const CAMERA_MODES: readonly CameraMode[] = [
  { id: 'chase-near', name: 'Chase (near)', offset: [0, 2.4, 6.2], look: [0, 1.2, -9], yawLambda: 7, yLambda: 9, fovOffset: 0, shake: 1, lookAhead: 1, hideBody: false, interior: false, stretch: 0.12 },
  { id: 'chase-far', name: 'Chase (far)', offset: [0, 3.9, 11.5], look: [0, 1.4, -16], yawLambda: 5, yLambda: 7, fovOffset: 0, shake: 0.8, lookAhead: 1.2, hideBody: false, interior: false, stretch: 0.2 },
  { id: 'hood', name: 'Hood', offset: [0, 1.28, -0.8], look: [0, 1.12, -40], yawLambda: 40, yLambda: 40, fovOffset: 0, shake: 1.4, lookAhead: 0.5, hideBody: false, interior: false, stretch: 0 },
  { id: 'cockpit', name: 'Cockpit', offset: [-0.38, 1.08, 0.15], look: [-0.38, 1.06, -40], yawLambda: 40, yLambda: 40, fovOffset: 4, shake: 1.2, lookAhead: 0.35, hideBody: true, interior: true, stretch: 0 },
  { id: 'bumper', name: 'Bumper', offset: [0, 0.62, -2.35], look: [0, 0.55, -40], yawLambda: 40, yLambda: 40, fovOffset: 0, shake: 1.8, lookAhead: 0.4, hideBody: false, interior: false, stretch: 0 },
  { id: 'tv', name: 'TV / Helicopter', offset: [6, 16, -26], look: [0, 0.6, 0], yawLambda: 1.5, yLambda: 3, fovOffset: -6, shake: 0, lookAhead: 0, hideBody: false, interior: false, stretch: 0 },
];

export const MODE_COUNT = CAMERA_MODES.length;
/** number of scalar parameters blended between modes */
export const PARAM_COUNT = 13;

export function modeToParams(m: CameraMode, out: Float64Array): Float64Array {
  out[0] = m.offset[0]; out[1] = m.offset[1]; out[2] = m.offset[2];
  out[3] = m.look[0]; out[4] = m.look[1]; out[5] = m.look[2];
  out[6] = m.yawLambda; out[7] = m.yLambda; out[8] = m.fovOffset; out[9] = m.shake; out[10] = m.lookAhead; out[11] = m.stretch;
  out[12] = 0;
  return out;
}

/** Frame-rate independent exponential smoothing factor. */
export function dampFactor(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt);
}
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * dampFactor(lambda, dt);
}
export function wrapAngle(a: number): number {
  const TWO = Math.PI * 2;
  return a - TWO * Math.floor((a + Math.PI) / TWO);
}
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + wrapAngle(target - current) * dampFactor(lambda, dt);
}
export function smoothstep(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** FOV widens from 60 to 80 with speed. */
export function speedFov(speedKmh: number): number {
  const t = Math.min(1, Math.max(0, speedKmh / TOP_SPEED_KMH));
  return MIN_FOV + (MAX_FOV - MIN_FOV) * Math.pow(t, 1.15);
}

export const BLEND_SECONDS = 0.4;
