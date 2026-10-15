export const GEAR_RATIOS = [3.55, 2.35, 1.72, 1.34, 1.08, 0.9] as const;
export const REVERSE_RATIO = 3.4;
export const FINAL_DRIVE = 4.4;
export const IDLE_RPM = 900;
export const REDLINE_RPM = 7000;
export const LIMITER_RPM = 7400;
export const UPSHIFT_RPM = 6600;
export const DOWNSHIFT_RPM = 3000;
export const DRIVETRAIN_EFFICIENCY = 0.88;
export const PEAK_TORQUE = 390; // Nm
/** launch/traction management: lower gears deliver less of the theoretical force (keeps wheelspin and wheelies out) */
export const GEAR_FORCE_SCALE = [0.5, 0.6, 0.72, 0.88, 1, 1] as const;

/** Engine torque curve in Nm (peak ~4800 rpm, fades toward the limiter). */
export function engineTorque(rpm: number): number {
  if (rpm >= LIMITER_RPM) return 0;
  const x = (rpm - 4800) / 3600;
  return PEAK_TORQUE * Math.max(0.28, 1 - 0.75 * x * x);
}

function ratioFor(gear: number): number {
  return gear <= 0 ? REVERSE_RATIO : GEAR_RATIOS[Math.min(gear, 6) - 1];
}

export function rpmFromWheelSpeed(speedMs: number, gear: number, wheelRadius: number): number {
  const wheelRpm = (Math.abs(speedMs) / (2 * Math.PI * wheelRadius)) * 60;
  return Math.max(IDLE_RPM, wheelRpm * ratioFor(gear) * FINAL_DRIVE);
}

/** Total force (N) at the contact patches for the given gear / rpm / throttle. */
export function driveForce(rpm: number, gear: number, throttle: number, wheelRadius: number): number {
  const scale = gear <= 0 ? 1 : GEAR_FORCE_SCALE[Math.min(gear, 6) - 1];
  return (engineTorque(rpm) * ratioFor(gear) * FINAL_DRIVE * DRIVETRAIN_EFFICIENCY * throttle * scale) / wheelRadius;
}

/** Simple automatic gearbox with hysteresis and a short shift cooldown. */
export class Gearbox {
  gear = 1; // 0 = reverse, 1..6 forward
  rpm = IDLE_RPM;
  private cooldown = 0;

  reset(): void {
    this.gear = 1;
    this.rpm = IDLE_RPM;
    this.cooldown = 0;
  }

  update(forwardSpeedMs: number, throttle: number, reversing: boolean, dt: number, wheelRadius: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (reversing) {
      this.gear = 0;
    } else {
      if (this.gear === 0) this.gear = 1;
      const rpmNow = rpmFromWheelSpeed(forwardSpeedMs, this.gear, wheelRadius);
      if (this.cooldown <= 0) {
        if (rpmNow > UPSHIFT_RPM && this.gear < 6) {
          this.gear++;
          this.cooldown = 0.25;
        } else if (rpmNow < DOWNSHIFT_RPM && this.gear > 1) {
          this.gear--;
          this.cooldown = 0.25;
        }
      }
    }
    const target = rpmFromWheelSpeed(forwardSpeedMs, this.gear, wheelRadius);
    const launch = this.gear <= 1 && forwardSpeedMs < 6 ? IDLE_RPM + throttle * 3200 : IDLE_RPM;
    const goal = Math.max(target, launch);
    this.rpm += (goal - this.rpm) * Math.min(1, dt * 14);
  }
}
