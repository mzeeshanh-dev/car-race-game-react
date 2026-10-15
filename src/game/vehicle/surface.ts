export type Surface = 'asphalt' | 'grass';

export interface SurfaceParams {
  friction: number; // multiplies tyre friction
  power: number; // multiplies engine force
  dragBase: number; // m/s² constant deceleration at full coverage
  dragPerSpeed: number; // extra m/s² per m/s
}

export const SURFACES: Record<Surface, SurfaceParams> = {
  asphalt: { friction: 1.0, power: 1.0, dragBase: 0, dragPerSpeed: 0 },
  grass: { friction: 0.5, power: 0.6, dragBase: 2.5, dragPerSpeed: 0.1 },
};

/** Deceleration (m/s²) caused by the surface for a given speed and fraction of wheels on it (0..1). */
export function surfaceDrag(surface: Surface, speedMs: number, coverage: number): number {
  const p = SURFACES[surface];
  return coverage * (p.dragBase + p.dragPerSpeed * Math.abs(speedMs));
}
