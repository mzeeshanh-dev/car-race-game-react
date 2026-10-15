import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraController } from '../game/camera/CameraController';
import { CAMERA_MODES, damp, speedFov } from '../game/camera/modes';
import type { CarRuntime } from '../game/state/runtime';
import { buildTrack } from '../game/track/trackData';

const car = (o: Partial<CarRuntime> = {}): CarRuntime => ({ x: 0, y: 1, z: 0, yaw: 0.3, fx: 0, fz: -1, speedKmh: 150, yawRate: 0.2, steer: 0.3, upY: 1, valid: true, ...o });

describe('camera', () => {
  it('has the 6 required modes', () => { expect(CAMERA_MODES).toHaveLength(6); });
  it('never rolls: up stays (0,1,0) and the camera right vector stays horizontal in every mode', () => {
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
    const track = buildTrack();
    for (let m = 0; m < 6; m++) {
      const c = new CameraController(track);
      c.setMode(m, true);
      const state = car({ x: track.px[100], z: track.pz[100], y: track.py[100] + 0.8 });
      for (let i = 0; i < 120; i++) {
        state.yaw = 0.3 + Math.sin(i / 10); // wild heading changes; pitch/roll of the body are simply never read
        c.update(cam, 1 / 60, state, i % 50 > 30);
        cam.updateMatrixWorld();
        const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        expect(Math.abs(right.y)).toBeLessThan(1e-6);
        expect(cam.up.toArray()).toEqual([0, 1, 0]);
      }
    }
  });
  it('FOV widens 60 -> 80 with speed', () => {
    expect(speedFov(0)).toBeCloseTo(60, 5);
    expect(speedFov(220)).toBeCloseTo(80, 5);
    expect(speedFov(110)).toBeGreaterThan(60);
  });
  it('mode blend takes ~0.4 s and is continuous', () => {
    const cam = new THREE.PerspectiveCamera();
    const c = new CameraController(null);
    c.setMode(0, true);
    const s = car({ y: 2 });
    for (let i = 0; i < 30; i++) c.update(cam, 1 / 60, s, false);
    const before = cam.position.clone();
    c.setMode(3);
    c.update(cam, 1 / 60, s, false);
    expect(cam.position.distanceTo(before)).toBeLessThan(1.5); // no teleport
    for (let i = 0; i < 40; i++) c.update(cam, 1 / 60, s, false);
    expect(c.interior).toBe(true);
    expect(c.hideBody).toBe(true);
  });
  it('damping is frame-rate independent', () => {
    let a = 0, b = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 1, 6, 1 / 60);
    for (let i = 0; i < 240; i++) b = damp(b, 1, 6, 1 / 240);
    expect(a).toBeCloseTo(b, 6);
  });
  it('never goes below the road surface', () => {
    const cam = new THREE.PerspectiveCamera();
    const t = buildTrack();
    const c = new CameraController(t);
    c.setMode(4, true);
    const s = car({ x: t.px[50], z: t.pz[50], y: t.py[50] - 3 });
    for (let i = 0; i < 30; i++) c.update(cam, 1 / 60, s, false);
    expect(cam.position.y).toBeGreaterThanOrEqual(t.py[50] + 0.4);
  });
});
