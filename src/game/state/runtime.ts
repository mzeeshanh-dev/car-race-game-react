import type { VehicleSim } from '../vehicle/VehicleSim';

/** Mutable per-frame scene state shared between systems (never React state). */
export interface CarRuntime {
  x: number; y: number; z: number; // interpolated position
  yaw: number; // +CCW from above
  fx: number; fz: number; // planar forward
  speedKmh: number;
  yawRate: number;
  steer: number;
  upY: number;
  valid: boolean;
}

export const rt = {
  car: { x: 0, y: 0, z: 0, yaw: 0, fx: 0, fz: -1, speedKmh: 0, yawRate: 0, steer: 0, upY: 1, valid: false } as CarRuntime,
  sim: null as VehicleSim | null,
  cameraModeIndex: 0,
  respawnRequested: false,
  hideBody: false,
  ai: [] as { dist: number; x: number; z: number; yaw: number }[],
  steerVisual: 0,
};

export const FEED_DEFAULT = () => ({ susp: [0.3, 0.3, 0.3, 0.3], speedMs: 0, steer: 0, brake: false, headlights: true });
export type WheelFeed = ReturnType<typeof FEED_DEFAULT>;
