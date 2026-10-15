/**
 * WORLD CONVENTION (single source of truth for the whole project)
 *   -Z = forward, +Y = up, +X = right  (right-handed)
 *   yaw  = rotation about +Y, counter-clockwise seen from above (positive = turning LEFT)
 *   car forward for yaw θ : (-sinθ, 0, -cosθ)
 *   car right   for yaw θ : ( cosθ, 0, -sinθ)
 *   steer input: -1 = left, +1 = right  ->  front wheel angle δ = -input * maxAngle  (δ>0 = left = +yaw rate)
 */
export const CAR = {
  mass: 1200,
  length: 4.2,
  width: 1.9,
  halfExtents: [0.95, 0.4, 2.1] as const,
  colliderOffsetY: 0.1,
  centerOfMass: { x: 0, y: -0.35, z: 0 },
  // principal inertia (x = pitch, y = yaw, z = roll). Roll/pitch intentionally high => stable.
  inertia: { x: 3000, y: 2400, z: 2600 },
  wheelRadius: 0.34,
  wheelWidth: 0.26,
  wheelX: 0.86,
  wheelZ: 1.3, // front = -Z, rear = +Z
  wheelbase: 2.6,
  hardPointY: -0.1,
  suspensionRest: 0.34,
  suspensionTravel: 0.26,
  suspensionStiffness: 38,
  suspensionCompression: 3.2,
  suspensionRelaxation: 4.4,
  maxSuspensionForce: 60000,
  baseFrictionSlip: 3.4,
  baseSideStiffness: 1.0,
} as const;

export const TRACK_CFG = {
  roadWidth: 20,
  shoulder: 4,
  embankment: 14,
  barrierOffset: 14.5,
  barrierHalfThickness: 0.35,
  barrierHeight: 1.5,
  groundY: -0.5,
  texRepeat: 16,
  sampleCount: 960,
  scale: 0.85,
  lapCount: 3,
  checkpointCount: 12,
} as const;

export const KMH = 3.6;
export const MAX_FOV = 80;
export const MIN_FOV = 60;
export const PHYSICS_HZ = 60;
export const FIXED_DT = 1 / PHYSICS_HZ;
export const TOP_SPEED_KMH = 220;
export const ROAD_HALF = TRACK_CFG.roadWidth / 2;
