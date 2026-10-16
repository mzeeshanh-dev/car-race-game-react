import { create } from 'zustand';
import { createVehicleLive, type VehicleLive } from '../vehicle/VehicleSim';

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface RaceLive {
  progress: number;
  remaining: number;
  missedGate: boolean;
  phase: RacePhase;
  countdown: number; // seconds remaining incl. GO window
  lap: number;
  totalLaps: number;
  lapTime: number;
  total: number;
  best: number | null;
  position: number;
  racers: number;
  wrongWay: boolean;
  nextGate: number;
  gateCount: number;
}

export interface MapDot { x: number; z: number; yaw: number }

export interface LiveData {
  vehicle: VehicleLive;
  race: RaceLive;
  car: MapDot;
  ai: MapDot[];
  cameraName: string;
}

export function createLive(): LiveData {
  return {
    vehicle: createVehicleLive(),
    race: {
      progress: 0, remaining: 0, missedGate: false,
      phase: 'countdown', countdown: 3, lap: 1, totalLaps: 3, lapTime: 0, total: 0, best: null,
      position: 1, racers: 4, wrongWay: false, nextGate: 1, gateCount: 12,
    },
    car: { x: 0, z: 0, yaw: 0 },
    ai: [],
    cameraName: '',
  };
}

/**
 * Transient store: the `live` object is mutated in place every frame by the game loop and read by the HUD
 * through `useTelemetry.getState().live` inside requestAnimationFrame. Nothing here ever triggers a React re-render.
 */
export const useTelemetry = create<{ live: LiveData }>(() => ({ live: createLive() }));
export const live = (): LiveData => useTelemetry.getState().live;
