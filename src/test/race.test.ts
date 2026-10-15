import { describe, expect, it } from 'vitest';
import { CheckpointTracker, crossedForward, wrapDelta } from '../game/race/checkpoints';
import { LapTimer, formatTime } from '../game/race/lapTimer';

const L = 1000;
const gates = Array.from({ length: 10 }, (_, k) => (k * L) / 10); // 0,100,...,900

function drive(tr: CheckpointTracker, from: number, to: number, step = 5) {
  const events = [];
  for (let s = from + step; s <= to + 1e-9; s += step) {
    const e = tr.update(((s % L) + L) % L);
    if (e.type !== 'none') events.push(e);
  }
  return events;
}

describe('checkpoint ordering', () => {
  it('wrapDelta / crossedForward', () => {
    expect(wrapDelta(990, 10, L)).toBe(20);
    expect(wrapDelta(10, 990, L)).toBe(-20);
    expect(crossedForward(95, 105, 100, L)).toBe(true);
    expect(crossedForward(105, 95, 100, L)).toBe(false); // backwards
    expect(crossedForward(990, 10, 0, L)).toBe(true); // across the line
  });
  it('counts gates in order and completes a lap only at the line', () => {
    const tr = new CheckpointTracker(gates, L, 3, 950);
    const ev = drive(tr, 950, 2005);
    expect(ev.filter((e) => e.type === 'checkpoint').map((e) => (e as { index: number }).index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(ev.filter((e) => e.type === 'lap')).toHaveLength(1);
    expect(tr.lap).toBe(2);
  });
  it('shortcuts do not count: skipping gates blocks the lap', () => {
    const tr = new CheckpointTracker(gates, L, 3, 950);
    drive(tr, 950, 1050); // pass line (ignored: expecting gate 1 first), gate 1 @100
    tr.sync(450); // teleport past gates 2..4 (shortcut)
    const ev = drive(tr, 450, 1450);
    expect(tr.lap).toBe(1);
    expect(ev.some((e) => e.type === 'lap')).toBe(false);
  });
  it('driving backwards over a gate does not advance', () => {
    const tr = new CheckpointTracker(gates, L, 3, 150);
    tr.restore(1, 3, 2, 150);
    const ev = drive(tr, 150, 50, -5);
    expect(ev).toHaveLength(0);
    expect(tr.next).toBe(3);
  });
  it('crossing the start line right after GO does not count as a lap', () => {
    const tr = new CheckpointTracker(gates, L, 3, 990);
    const ev = drive(tr, 990, 1020);
    expect(ev.some((e) => e.type === 'lap' || e.type === 'finish')).toBe(false);
    expect(tr.lap).toBe(1);
  });
  it('finishes after 3 laps', () => {
    const tr = new CheckpointTracker(gates, L, 3, 950);
    const ev = drive(tr, 950, 4005);
    expect(ev.filter((e) => e.type === 'lap')).toHaveLength(2);
    expect(ev.filter((e) => e.type === 'finish')).toHaveLength(1);
    expect(tr.finished).toBe(true);
  });
  it('ignores teleports (respawn) as crossings', () => {
    const tr = new CheckpointTracker(gates, L, 3, 50);
    expect(tr.update(500).type).toBe('none');
  });
});

describe('lap timing', () => {
  it('accumulates only while running and tracks best lap', () => {
    const t = new LapTimer();
    t.tick(5);
    expect(t.total).toBe(0);
    t.start();
    for (let i = 0; i < 60; i++) t.tick(1 / 60);
    expect(t.lapTime).toBeCloseTo(1, 6);
    const a = t.completeLap();
    expect(a.isBest).toBe(true);
    expect(t.lapTime).toBe(0);
    t.tick(2);
    const b = t.completeLap();
    expect(b.isBest).toBe(false);
    t.tick(0.5);
    expect(t.completeLap().isBest).toBe(true);
    expect(t.best).toBeCloseTo(0.5, 6);
    expect(t.total).toBeCloseTo(3.5, 6);
    expect(t.laps).toHaveLength(3);
  });
  it('formats', () => {
    expect(formatTime(75.321)).toBe('1:15.321');
    expect(formatTime(null)).toBe('--:--.---');
  });
});
