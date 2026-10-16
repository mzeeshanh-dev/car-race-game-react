/** Screen-relative lean; neutral is session-local and recalibrated on rotation. */
export function screenLean(beta: number, gamma: number, angle: number): number {
  const a = angle * Math.PI / 180;
  return gamma * Math.cos(a) + beta * Math.sin(a);
}
export class TiltInput {
  enabled = false;
  sensitivity = 1;
  private neutral: number | null = null;
  private latest = 0;
  private lastEvent = 0;
  private angle = 0;
  calibrate() { this.neutral = this.lastEvent ? this.latest : null; }
  receive(beta: number, gamma: number, angle: number, now = performance.now()) {
    if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;
    this.latest = screenLean(beta, gamma, angle);
    if (this.neutral === null || angle !== this.angle) this.neutral = this.latest;
    this.angle = angle; this.lastEvent = now;
  }
  sample(now = performance.now()) {
    if (!this.enabled || this.neutral === null || now - this.lastEvent > 500) return 0;
    const lean = (this.latest - this.neutral) * this.sensitivity;
    return Math.sign(lean) * Math.min(1, Math.max(0, Math.abs(lean) - 2) / 23);
  }
  async request(): Promise<string> {
    this.enabled = false;
    if (typeof DeviceOrientationEvent === 'undefined') return 'Tilt unavailable. Touch steering remains available.';
    try {
      const event = DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
      if (event.requestPermission && await event.requestPermission() !== 'granted') return 'Permission denied. Use touch steering.';
      this.enabled = true; this.neutral = null;
      return 'Tilt enabled. Hold neutral, then calibrate. If no sensor is available, use touch.';
    } catch { return 'Sensor permission failed. Use touch steering.'; }
  }
}
export const tilt = new TiltInput();
