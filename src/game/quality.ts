import type { Quality } from '../persistence/db';

export interface QualityPreset {
  dprMax: number; // clamped to [1, 2]
  shadows: boolean;
  shadowMap: number; // <= 2048
  trees: number;
  antialias: boolean;
  sky: boolean;
  fogFar: number;
}

export const QUALITY: Record<Quality, QualityPreset> = {
  low: { dprMax: 1, shadows: false, shadowMap: 512, trees: 120, antialias: false, sky: false, fogFar: 700 },
  medium: { dprMax: 1.5, shadows: true, shadowMap: 1024, trees: 260, antialias: true, sky: true, fogFar: 1100 },
  high: { dprMax: 2, shadows: true, shadowMap: 2048, trees: 480, antialias: true, sky: true, fogFar: 1600 },
};
