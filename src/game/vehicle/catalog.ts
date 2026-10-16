import { CAR } from '../constants';

export type VehicleId = 'apex' | 'mercedes-gt' | 'vortex' | 'superbike-1000' | 'superbike-600';
export type Chassis = { mass: number; halfExtents: readonly [number, number, number]; colliderOffsetY: number; centerOfMass: { x: number; y: number; z: number }; inertia: { x: number; y: number; z: number }; wheelRadius: number; wheelWidth: number; wheelX: number; wheelZ: number; wheelbase: number; hardPointY: number; suspensionRest: number; suspensionTravel: number; suspensionStiffness: number; suspensionCompression: number; suspensionRelaxation: number; maxSuspensionForce: number; baseFrictionSlip: number; baseSideStiffness: number };
export interface VehicleSpec {
  id: VehicleId; name: string; kind: 'car' | 'bike'; description: string; model: string;
  chassis: Chassis; topSpeed: number; power: number; grip: number; aero: number; brake: number; pitch: number;
}
const bike: Chassis = { ...CAR, mass: 270, halfExtents: [0.3, 0.48, 1.02], colliderOffsetY: 0.12,
  centerOfMass: { x: 0, y: -0.15, z: 0 }, inertia: { x: 230, y: 210, z: 85 },
  wheelRadius: 0.32, wheelWidth: 0.17, wheelX: 0, wheelZ: 0.72, wheelbase: 1.44,
  hardPointY: -0.15, suspensionRest: 0.25, suspensionTravel: 0.16, suspensionStiffness: 65,
  suspensionCompression: 4.5, suspensionRelaxation: 6, maxSuspensionForce: 12000,
  baseFrictionSlip: 4, baseSideStiffness: 1.2 };
export const VEHICLES: VehicleSpec[] = [
  { id: 'apex', name: 'Apex Sport', kind: 'car', description: 'Balanced rear-wheel-drive sports coupe', model: 'sports-car.glb', chassis: CAR, topSpeed: 220, power: 1, grip: 1, aero: 0.42, brake: 60, pitch: 1 },
  { id: 'mercedes-gt', name: 'Mercedes-Benz GT', kind: 'car', description: 'Original stylized fan model · planted grand tourer', model: 'mercedes-gt.glb', chassis: { ...CAR, mass: 1550, halfExtents: [0.98, 0.4, 2.28], inertia: { x: 3800, y: 3100, z: 3300 } }, topSpeed: 245, power: 1.45, grip: 1.08, aero: 0.46, brake: 82, pitch: 0.75 },
  { id: 'vortex', name: 'Vortex R', kind: 'car', description: 'Lightweight track supercar · sharp steering', model: 'vortex.glb', chassis: { ...CAR, mass: 1050 }, topSpeed: 260, power: 1.3, grip: 1.16, aero: 0.35, brake: 62, pitch: 1.15 },
  { id: 'superbike-1000', name: 'R1000 Superbike', kind: 'bike', description: 'Two-wheel suspension · fast acceleration · assisted lean', model: 'superbike.glb', chassis: bike, topSpeed: 265, power: 0.36, grip: 1.05, aero: 0.18, brake: 29, pitch: 1.9 },
  { id: 'superbike-600', name: 'R600 Supersport', kind: 'bike', description: 'Lighter, gentler power delivery · agile cornering', model: 'superbike.glb', chassis: { ...bike, mass: 240 }, topSpeed: 225, power: 0.27, grip: 1.1, aero: 0.17, brake: 26, pitch: 2.2 },
];
export function vehicleSpec(id: unknown): VehicleSpec { return VEHICLES.find(v => v.id === id) ?? VEHICLES[0]; }
export function raceRecordId(vehicle: VehicleId, laps: number) { return `apex-ring:${vehicle}:${laps}`; }
