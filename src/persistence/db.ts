import { openDB, type IDBPDatabase } from 'idb';
import { vehicleSpec, type VehicleId } from '../game/vehicle/catalog';

export type Quality = 'low' | 'medium' | 'high';

export interface Settings {
  vehicle: VehicleId;
  raceLaps: number;
  sensitivity: number; // 0.5 .. 1.5
  quality: Quality;
  cameraMode: number; // 0..5
  carColor: string;
  volume: number; // 0..1
  muted: boolean;
  environment: 'day' | 'night';
  sfxVolume: number;
  cameraShake: boolean;
  tilt: boolean;
  tiltSensitivity: number;
}

export const DEFAULT_SETTINGS: Settings = {
  vehicle: 'apex', raceLaps: 1,
  sensitivity: 1,
  quality: 'medium',
  cameraMode: 0,
  carColor: '#e63946',
  volume: 0.5,
  muted: false,
  environment: 'day', sfxVolume: 0.6, cameraShake: true, tilt: false, tiltSensitivity: 1,
};

export interface SavedRace {
  vehicle?: VehicleId;
  totalLaps?: number;
  trackId: string;
  lap: number;
  next: number;
  lastGate: number;
  total: number;
  lapTime: number;
  laps: number[];
  car: { x: number; y: number; z: number; yaw: number };
  savedAt: number;
}

export interface RaceResult {
  vehicle?: VehicleId;
  totalLaps?: number;
  trackId: string;
  total: number;
  laps: number[];
  best: number;
  position: number;
  racers: number;
  date: number;
}

export const TRACK_ID = 'apex-ring';

interface KV { key: string; value: unknown }
interface Best { trackId: string; bestLap: number | null; bestTotal: number | null }

/**
 * Thin idb wrapper. Falls back to an in-memory map if IndexedDB is unavailable (private mode, blocked, SSR).
 */
export class Persistence {
  private dbp: Promise<IDBPDatabase | null> | null = null;
  private mem = new Map<string, unknown>();
  private memBest = new Map<string, Best>();

  constructor(private readonly name = 'apex-racing') {}

  private db(): Promise<IDBPDatabase | null> {
    if (!this.dbp) {
      this.dbp = (async () => {
        try {
          if (typeof indexedDB === 'undefined') return null;
          return await openDB(this.name, 1, {
            upgrade(db) {
              db.createObjectStore('kv', { keyPath: 'key' });
              db.createObjectStore('bests', { keyPath: 'trackId' });
            },
          });
        } catch {
          return null;
        }
      })();
    }
    return this.dbp;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const db = await this.db();
    if (!db) return this.mem.get(key) as T | undefined;
    try {
      const row = (await db.get('kv', key)) as KV | undefined;
      return row?.value as T | undefined;
    } catch {
      return this.mem.get(key) as T | undefined;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    const db = await this.db();
    this.mem.set(key, value);
    if (!db) return;
    try { await db.put('kv', { key, value } satisfies KV); } catch { /* ignore */ }
  }

  async del(key: string): Promise<void> {
    const db = await this.db();
    this.mem.delete(key);
    if (!db) return;
    try { await db.delete('kv', key); } catch { /* ignore */ }
  }

  async loadSettings(): Promise<Settings> {
    const s = await this.get<Partial<Settings>>('settings');
    return sanitizeSettings({ ...DEFAULT_SETTINGS, ...(s ?? {}) });
  }

  async saveSettings(s: Settings): Promise<void> { await this.set('settings', s); }

  async getBest(trackId: string): Promise<Best> {
    const db = await this.db();
    const empty: Best = { trackId, bestLap: null, bestTotal: null };
    if (!db) return this.memBest.get(trackId) ?? empty;
    try { return ((await db.get('bests', trackId)) as Best | undefined) ?? empty; } catch { return this.memBest.get(trackId) ?? empty; }
  }

  /** Records a lap time; returns true if it is a new best lap. */
  async submitLap(trackId: string, seconds: number): Promise<boolean> {
    const cur = await this.getBest(trackId);
    if (cur.bestLap !== null && cur.bestLap <= seconds) return false;
    await this.putBest({ ...cur, bestLap: seconds });
    return true;
  }

  async submitTotal(trackId: string, seconds: number): Promise<boolean> {
    const cur = await this.getBest(trackId);
    if (cur.bestTotal !== null && cur.bestTotal <= seconds) return false;
    await this.putBest({ ...cur, bestTotal: seconds });
    return true;
  }

  private async putBest(b: Best): Promise<void> {
    this.memBest.set(b.trackId, b);
    const db = await this.db();
    if (!db) return;
    try { await db.put('bests', b); } catch { /* ignore */ }
  }

  saveRace(r: SavedRace): Promise<void> { return this.set('race', r); }
  async loadRace(): Promise<SavedRace | null> { return (await this.get<SavedRace>('race')) ?? null; }
  clearRace(): Promise<void> { return this.del('race'); }
  saveResult(r: RaceResult): Promise<void> { return this.set('result', r); }
  async loadResult(): Promise<RaceResult | null> { return (await this.get<RaceResult>('result')) ?? null; }
}

export function sanitizeSettings(s: Settings): Settings {
  const q: Quality[] = ['low', 'medium', 'high'];
  return {
    vehicle: vehicleSpec(s.vehicle).id,
    raceLaps: [1, 2, 3].includes(s.raceLaps) ? s.raceLaps : 1,
    sensitivity: Math.min(1.5, Math.max(0.5, Number(s.sensitivity) || 1)),
    quality: q.includes(s.quality) ? s.quality : 'medium',
    cameraMode: Math.min(5, Math.max(0, Math.round(Number(s.cameraMode) || 0))),
    carColor: /^#[0-9a-fA-F]{6}$/.test(s.carColor) ? s.carColor : DEFAULT_SETTINGS.carColor,
    volume: Math.min(1, Math.max(0, Number.isFinite(Number(s.volume)) ? Number(s.volume) : 0.5)),
    muted: !!s.muted,
    environment: s.environment === 'night' ? 'night' : 'day',
    sfxVolume: Number.isFinite(s.sfxVolume) ? Math.min(1, Math.max(0, s.sfxVolume)) : 0.6,
    cameraShake: s.cameraShake !== false,
    tilt: !!s.tilt,
    tiltSensitivity: Number.isFinite(s.tiltSensitivity) ? Math.min(2, Math.max(0.5, s.tiltSensitivity)) : 1,
  };
}

export const persistence = new Persistence();
