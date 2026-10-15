/** Pure lap-timing logic (seconds). */
export class LapTimer {
  total = 0;
  lapTime = 0;
  best: number | null;
  laps: number[] = [];
  running = false;

  constructor(best: number | null = null) { this.best = best; }

  start(): void { this.running = true; }
  stop(): void { this.running = false; }

  reset(): void { this.total = 0; this.lapTime = 0; this.laps = []; this.running = false; }

  tick(dt: number): void {
    if (!this.running) return;
    this.total += dt;
    this.lapTime += dt;
  }

  /** Complete the current lap. Returns { time, isBest }. */
  completeLap(): { time: number; isBest: boolean } {
    const time = this.lapTime;
    this.laps.push(time);
    const isBest = this.best === null || time < this.best;
    if (isBest) this.best = time;
    this.lapTime = 0;
    return { time, isBest };
  }

  restore(total: number, lapTime: number, laps: number[], best: number | null): void {
    this.total = total; this.lapTime = lapTime; this.laps = laps.slice(); this.best = best;
  }
}

export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !isFinite(seconds)) return '--:--.---';
  const ms = Math.max(0, Math.round(seconds * 1000));
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return `${m}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
}
