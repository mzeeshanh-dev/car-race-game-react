/** Contact impulses drive all impact consumers; cooldown prevents sustained-contact spam. */
export const effects = { serial: 0, strength: 0, x: 0, y: 0, z: 0, time: -Infinity };
export function reportImpact(force: number, dt: number, mass: number, x: number, y: number, z: number, now: number) {
  const deltaV = force * dt / mass;
  if (deltaV < 1.2 || now - effects.time < 250) return;
  effects.serial++; effects.strength = Math.min(1, deltaV / 12);
  effects.x = x; effects.y = y; effects.z = z; effects.time = now;
}
