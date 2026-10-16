import { applyDeadzone, smoothSteer } from './steering';
import { tilt } from './tilt';

export type InputAction = 'cycleCamera' | 'respawn' | 'pause' | 'mute' | { camera: number };
type ActionHandler = (a: InputAction) => void;

export interface TouchState { left: boolean; right: boolean; gas: boolean; brake: boolean; hand: boolean }

/**
 * Keyboard + gamepad + touch input. Produces smoothed steering in [-1, 1] (-1 = LEFT, +1 = RIGHT).
 * `sample(dt)` is called once per fixed physics step; nothing allocates per call except navigator.getGamepads().
 */
export class InputManager {
  throttle = 0;
  brake = 0;
  steer = 0; // smoothed
  steerTarget = 0; // raw target
  handbrake = false;
  lookBack = false;
  usingGamepad = false;
  readonly touch: TouchState = { left: false, right: false, gas: false, brake: false, hand: false };
  private keys = new Set<string>();
  private handlers = new Set<ActionHandler>();
  private attached = false;
  deadzone = 0.12;

  onAction(h: ActionHandler): () => void { this.handlers.add(h); return () => { this.handlers.delete(h); }; }
  private emit(a: InputAction) { this.handlers.forEach((h) => h(a)); }

  attach(): void {
    if (this.attached || typeof window === 'undefined') return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    window.addEventListener('deviceorientation', this.onTilt);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
    window.removeEventListener('deviceorientation', this.onTilt);
    this.clear();
  }

  clear = (): void => {
    this.reset();
    this.keys.clear();
    this.touch.left = this.touch.right = this.touch.gas = this.touch.brake = this.touch.hand = false;
  };

  private static readonly PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

  private onKeyDown = (e: KeyboardEvent): void => {
    if (InputManager.PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) { return; }
    this.keys.add(e.code);
    switch (e.code) {
      case 'KeyC': this.emit('cycleCamera'); break;
      case 'KeyR': this.emit('respawn'); break;
      case 'Escape': case 'KeyP': this.emit('pause'); break;
      case 'KeyM': this.emit('mute'); break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5': case 'Digit6':
        this.emit({ camera: Number(e.code.slice(5)) - 1 });
        break;
      default: break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.code); };

  private down(...codes: string[]): boolean {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  private onTilt = (e: DeviceOrientationEvent) => {
    if (e.beta !== null && e.gamma !== null) tilt.receive(e.beta, e.gamma, screen.orientation?.angle ?? 0);
  };

  /** Advance input state by dt seconds (call from the fixed physics step). */
  sample(dt: number): void {
    const k = this.keys;
    const t = this.touch;
    let thr = k.size && this.down('KeyW', 'ArrowUp') ? 1 : 0;
    let brk = k.size && this.down('KeyS', 'ArrowDown') ? 1 : 0;
    let target = (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
    let hand = this.down('Space');
    if (target === 0) target = tilt.sample();
    this.lookBack = this.down('KeyB');

    if (t.gas) thr = 1;
    if (t.brake) brk = 1;
    if (t.right || t.left) target = (t.right ? 1 : 0) - (t.left ? 1 : 0);
    if (t.hand) hand = true;

    // gamepad (first connected pad): analog steer with deadzone, analog triggers
    this.usingGamepad = false;
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad || !pad.connected) continue;
        const ax = applyDeadzone(pad.axes[0] ?? 0, this.deadzone);
        const rt = pad.buttons[7]?.value ?? 0;
        const lt = pad.buttons[6]?.value ?? 0;
        if (ax !== 0) { target = ax; this.usingGamepad = true; }
        if (rt > 0.02) thr = Math.max(thr, rt);
        if (lt > 0.02) brk = Math.max(brk, lt);
        if (pad.buttons[0]?.pressed || pad.buttons[2]?.pressed) hand = true;
        if (pad.buttons[4]?.pressed) this.lookBack = true;
        this.padEdge(pad);
        break;
      }
    }
    this.throttle = thr;
    this.brake = brk;
    this.handbrake = hand;
    this.steerTarget = target;
    this.steer = smoothSteer(this.steer, target, dt);
  }

  private padPrev = { y: false, back: false, start: false };
  private padEdge(pad: Gamepad): void {
    const y = !!pad.buttons[3]?.pressed;
    const back = !!pad.buttons[8]?.pressed;
    const start = !!pad.buttons[9]?.pressed;
    if (y && !this.padPrev.y) this.emit('cycleCamera');
    if (back && !this.padPrev.back) this.emit('respawn');
    if (start && !this.padPrev.start) this.emit('pause');
    this.padPrev.y = y; this.padPrev.back = back; this.padPrev.start = start;
  }

  reset(): void { this.steer = 0; this.steerTarget = 0; this.throttle = 0; this.brake = 0; this.handbrake = false; }
}

export const input = new InputManager();
