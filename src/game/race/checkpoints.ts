/** Shortest signed arc distance from a to b on a loop of length L (result in (-L/2, L/2]). */
export function wrapDelta(a: number, b: number, L: number): number {
  let d = (b - a) % L;
  if (d > L / 2) d -= L;
  else if (d <= -L / 2) d += L;
  return d;
}

/** True if moving from sPrev to sCurr (forward) crossed `gate`. */
export function crossedForward(sPrev: number, sCurr: number, gate: number, L: number): boolean {
  const move = wrapDelta(sPrev, sCurr, L);
  if (move <= 0) return false;
  const toGate = wrapDelta(sPrev, gate, L);
  return toGate > 0 && toGate <= move;
}

export type CheckpointEvent =
  | { type: 'none' }
  | { type: 'checkpoint'; index: number }
  | { type: 'lap'; lap: number } // lap just completed (1-based)
  | { type: 'finish'; lap: number };

/**
 * Ordered checkpoint tracker. gates[0] is the start/finish line. A lap only counts when gates 1..K-1 were
 * crossed in order and then gate 0 is crossed again - so shortcuts / reversing across the line never count.
 */
export class CheckpointTracker {
  next = 1;
  lap = 1;
  lastGate = 0; // last gate passed (for respawn)
  finished = false;
  private prevS: number;
  private readonly maxJump: number;

  constructor(
    private readonly gateS: readonly number[],
    private readonly length: number,
    private readonly totalLaps: number,
    startS: number,
    maxJump = 60,
  ) {
    this.prevS = startS;
    this.maxJump = maxJump;
  }

  get gateCount(): number { return this.gateS.length; }

  /** teleport (respawn/resume) without triggering crossings */
  sync(s: number): void { this.prevS = s; }

  restore(lap: number, next: number, lastGate: number, s: number): void {
    this.lap = lap; this.next = next; this.lastGate = lastGate; this.prevS = s; this.finished = false;
  }

  update(s: number): CheckpointEvent {
    if (this.finished) { this.prevS = s; return { type: 'none' }; }
    const move = wrapDelta(this.prevS, s, this.length);
    let ev: CheckpointEvent = { type: 'none' };
    if (Math.abs(move) <= this.maxJump && crossedForward(this.prevS, s, this.gateS[this.next], this.length)) {
      const idx = this.next;
      if (idx === 0) {
        const done = this.lap;
        this.lastGate = 0;
        if (done >= this.totalLaps) { this.finished = true; ev = { type: 'finish', lap: done }; }
        else { this.lap = done + 1; this.next = 1; ev = { type: 'lap', lap: done }; }
      } else {
        this.lastGate = idx;
        this.next = (idx + 1) % this.gateS.length;
        ev = { type: 'checkpoint', index: idx };
      }
    }
    this.prevS = s;
    return ev;
  }

  /** total distance driven along the race (for position ranking) */
  progress(s: number): number {
    // before the first line crossing the grid sits just "behind" the line (s close to the loop length)
    const adj = this.lap === 1 && this.next === 1 && s > this.length * 0.75 ? s - this.length : s;
    return (this.lap - 1) * this.length + adj;
  }
}
