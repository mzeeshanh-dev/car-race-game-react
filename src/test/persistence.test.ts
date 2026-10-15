import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, Persistence, sanitizeSettings } from '../persistence/db';

describe('persistence (idb) round trip', () => {
  it('settings, camera and car colour survive a "reload" (new instance, same DB)', async () => {
    const a = new Persistence('t1');
    expect((await a.loadSettings()).sensitivity).toBe(1);
    await a.saveSettings({ ...DEFAULT_SETTINGS, sensitivity: 1.3, cameraMode: 3, carColor: '#112233', quality: 'high' });
    const b = new Persistence('t1');
    const s = await b.loadSettings();
    expect(s).toMatchObject({ sensitivity: 1.3, cameraMode: 3, carColor: '#112233', quality: 'high' });
  });
  it('best lap only improves', async () => {
    const p = new Persistence('t2');
    expect(await p.submitLap('x', 90)).toBe(true);
    expect(await p.submitLap('x', 95)).toBe(false);
    expect(await p.submitLap('x', 80.5)).toBe(true);
    expect((await new Persistence('t2').getBest('x')).bestLap).toBe(80.5);
  });
  it('race snapshot round trip + clear', async () => {
    const p = new Persistence('t3');
    const snap = { trackId: 'x', lap: 2, next: 4, lastGate: 3, total: 100, lapTime: 20, laps: [80], car: { x: 1, y: 2, z: 3, yaw: 0.5 }, savedAt: 1 };
    await p.saveRace(snap);
    expect(await new Persistence('t3').loadRace()).toEqual(snap);
    await p.clearRace();
    expect(await new Persistence('t3').loadRace()).toBeNull();
  });
  it('sanitises corrupt settings', () => {
    const s = sanitizeSettings({ ...DEFAULT_SETTINGS, sensitivity: 9, cameraMode: 99, carColor: 'red', quality: 'ultra' as never });
    expect(s.sensitivity).toBe(1.5);
    expect(s.cameraMode).toBe(5);
    expect(s.carColor).toBe(DEFAULT_SETTINGS.carColor);
    expect(s.quality).toBe('medium');
  });
});
