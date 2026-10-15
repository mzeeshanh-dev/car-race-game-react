import * as THREE from 'three';
import { TRACK_CFG } from '../constants';
import type { CarRuntime } from '../state/runtime';
import { createNearest, nearestOnTrack, type TrackData } from '../track/trackData';
import {
  BLEND_SECONDS, CAMERA_MODES, MODE_COUNT, PARAM_COUNT, damp, dampAngle, modeToParams, smoothstep, speedFov,
} from './modes';

const BARRIER_INNER = TRACK_CFG.barrierOffset - TRACK_CFG.barrierHalfThickness - 0.5;

/**
 * Racing-game camera. It uses ONLY the car's position and yaw (never its quaternion), keeps camera.up = (0,1,0)
 * and uses lookAt, so the horizon can never tilt in any mode. All smoothing is frame-rate independent.
 */
export class CameraController {
  modeIndex = 0;
  hideBody = false;
  interior = false;
  fov = 60;
  private from = new Float64Array(PARAM_COUNT);
  private cur = new Float64Array(PARAM_COUNT);
  private to = new Float64Array(PARAM_COUNT);
  private blendT = 1;
  private smoothYaw = 0;
  private smoothY = 0;
  private lookBack = 0;
  private time = 0;
  private ready = false;
  private prevMode = 0;
  private readonly near = createNearest();
  private hint = -1;

  constructor(private track: TrackData | null = null) {
    modeToParams(CAMERA_MODES[0], this.cur);
    modeToParams(CAMERA_MODES[0], this.to);
    modeToParams(CAMERA_MODES[0], this.from);
  }

  setTrack(t: TrackData | null): void { this.track = t; }

  /** Switch mode with a ~0.4 s blend. */
  setMode(i: number, instant = false): void {
    const idx = ((i % MODE_COUNT) + MODE_COUNT) % MODE_COUNT;
    if (idx === this.modeIndex && this.ready) return;
    this.prevMode = this.modeIndex;
    this.from.set(this.cur);
    modeToParams(CAMERA_MODES[idx], this.to);
    this.modeIndex = idx;
    this.blendT = instant ? 1 : 0;
    if (instant) { this.cur.set(this.to); this.prevMode = idx; }
  }

  snap(car: CarRuntime): void {
    this.smoothYaw = car.yaw;
    this.smoothY = car.y + this.cur[1];
    this.ready = true;
  }

  update(camera: THREE.PerspectiveCamera, dtRaw: number, car: CarRuntime, lookBackHeld: boolean): void {
    const dt = Math.min(Math.max(dtRaw, 1e-4), 0.1);
    if (!this.ready) this.snap(car);
    this.time += dt;
    const cur = this.cur;

    if (this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dt / BLEND_SECONDS);
      const e = smoothstep(this.blendT);
      for (let i = 0; i < PARAM_COUNT; i++) cur[i] = this.from[i] + (this.to[i] - this.from[i]) * e;
    } else {
      cur.set(this.to);
    }
    const shown = this.blendT > 0.5 ? CAMERA_MODES[this.modeIndex] : CAMERA_MODES[this.prevMode];
    this.hideBody = shown.hideBody;
    this.interior = shown.interior;

    const speedNorm = Math.min(1, car.speedKmh / 220);
    this.smoothYaw = dampAngle(this.smoothYaw, car.yaw, cur[6], dt);
    this.lookBack = damp(this.lookBack, lookBackHeld ? 1 : 0, 9, dt);

    const yaw = this.smoothYaw;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const ox = cur[0];
    const oz = cur[2] * (1 + cur[11] * speedNorm);
    let px = car.x + ox * c + oz * s;
    let pz = car.z - ox * s + oz * c;
    this.smoothY = damp(this.smoothY, car.y + cur[1], cur[7], dt);
    let py = this.smoothY;

    // subtle speed shake (position only, never roll)
    const amp = 0.02 * cur[9] * speedNorm * speedNorm;
    if (amp > 0) {
      const sx = Math.sin(this.time * 41.3) + Math.sin(this.time * 27.9 + 1.7);
      const sy = Math.sin(this.time * 37.1 + 0.4) + Math.sin(this.time * 53.3);
      py += sy * amp * 0.5;
      px += c * sx * amp * 0.3;
      pz += -s * sx * amp * 0.3;
    }

    // look-ahead into corners (+ look back, which only rotates the look target)
    const lead = Math.max(-0.4, Math.min(0.4, car.yawRate * 0.22 * cur[10]));
    const ly = yaw + lead + Math.PI * this.lookBack;
    const lc = Math.cos(ly);
    const ls = Math.sin(ly);
    const tx = car.x + cur[3] * lc + cur[5] * ls;
    const tz = car.z - cur[3] * ls + cur[5] * lc;
    const ty = this.smoothY + (cur[4] - cur[1]);

    // never clip into the ground or barriers
    const tr = this.track;
    if (tr) {
      const n = nearestOnTrack(tr, px, pz, this.hint, this.near, 30);
      this.hint = n.index;
      let lat = n.lateral;
      const absLat = Math.abs(lat);
      // camera inside the barrier zone => pull it back onto the road side of the wall
      if (absLat > BARRIER_INNER && absLat < TRACK_CFG.barrierOffset + 1.6) {
        const sg = Math.sign(lat);
        const push = absLat - BARRIER_INNER;
        px -= tr.rx[n.index] * sg * push;
        pz -= tr.rz[n.index] * sg * push;
        lat = sg * BARRIER_INNER;
      }
      const base = Math.abs(lat) <= TRACK_CFG.barrierOffset ? n.y : TRACK_CFG.groundY;
      if (py < base + 0.45) py = base + 0.45;
    } else if (py < 0.45) py = 0.45;

    camera.position.set(px, py, pz);
    camera.up.set(0, 1, 0);
    camera.lookAt(tx, ty, tz);

    const targetFov = speedFov(car.speedKmh) + cur[8];
    this.fov = damp(this.fov, targetFov, 6, dt);
    if (Math.abs(camera.fov - this.fov) > 0.01) {
      camera.fov = this.fov;
      camera.updateProjectionMatrix();
    }
  }
}
