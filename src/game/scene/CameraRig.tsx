import { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CameraController } from '../camera/CameraController';
import { CAMERA_MODES } from '../camera/modes';
import { input } from '../input/InputManager';
import { hudBus } from '../state/hudBus';
import { rt } from '../state/runtime';
import { useApp } from '../state/store';
import { live } from '../state/telemetry';
import type { TrackData } from '../track/trackData';

/** Cockpit dashboard + steering wheel, parented to the CAMERA so it never tilts and always lines up. */
function CockpitInterior({ wheel, color }: { wheel: React.RefObject<THREE.Group | null>; color: string }) {
  return (
    <>
      <mesh position={[0, -0.5, -0.95]} rotation={[-0.18, 0, 0]}>
        <boxGeometry args={[1.9, 0.26, 0.55]} />
        <meshStandardMaterial color="#14161b" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.62, -1.9]} rotation={[0.06, 0, 0]}>
        <boxGeometry args={[1.8, 0.1, 1.5]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
      </mesh>
      {[-0.92, 0.92].map((x) => (
        <mesh key={x} position={[x, 0.18, -1.15]} rotation={[0.1, 0, x < 0 ? -0.35 : 0.35]}>
          <boxGeometry args={[0.07, 0.95, 0.09]} />
          <meshStandardMaterial color="#0e0f13" />
        </mesh>
      ))}
      <mesh position={[0, 0.58, -0.8]}>
        <boxGeometry args={[1.9, 0.05, 0.9]} />
        <meshStandardMaterial color="#101218" />
      </mesh>
      {/* instrument hood + wheel (driver sits on the left: x = -0.38 relative to the car, camera is at the driver) */}
      <group ref={wheel} position={[0, -0.33, -0.62]} rotation={[-0.35, 0, 0]}>
        <mesh>
          <torusGeometry args={[0.19, 0.027, 10, 28]} />
          <meshStandardMaterial color="#0c0c0e" roughness={0.6} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.34, 0.03, 0.03]} />
          <meshStandardMaterial color="#202228" />
        </mesh>
        <mesh position={[0, -0.09, 0]}>
          <boxGeometry args={[0.03, 0.18, 0.03]} />
          <meshStandardMaterial color="#202228" />
        </mesh>
        <mesh position={[0, 0.19, 0.005]}>
          <boxGeometry args={[0.05, 0.03, 0.03]} />
          <meshStandardMaterial color="#e63946" emissive="#e63946" emissiveIntensity={0.6} />
        </mesh>
      </group>
    </>
  );
}

export function CameraRig({ track }: { track: TrackData }) {
  const { camera, scene } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const ctrl = useMemo(() => new CameraController(track), [track]);
  const interior = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);
  const color = useApp((s) => s.settings.carColor);

  useEffect(() => {
    scene.add(camera);
    ctrl.setMode(useApp.getState().settings.cameraMode, true);
    rt.cameraModeIndex = ctrl.modeIndex;
    return () => { scene.remove(camera); rt.hideBody = false; };
  }, [camera, scene, ctrl]);

  useEffect(() => input.onAction((a) => {
    const app = useApp.getState();
    if (app.screen === 'menu') return;
    const cur = app.settings.cameraMode;
    let next = cur;
    if (a === 'cycleCamera') next = (cur + 1) % CAMERA_MODES.length;
    else if (typeof a === 'object') next = Math.min(CAMERA_MODES.length - 1, a.camera);
    else return;
    app.updateSettings({ cameraMode: next });
    hudBus.toast({ kind: 'camera', text: CAMERA_MODES[next].name });
  }), []);

  useFrame((_, dt) => {
    if (!rt.car.valid) return;
    const want = useApp.getState().settings.cameraMode;
    if (want !== ctrl.modeIndex) { ctrl.setMode(want); rt.cameraModeIndex = want; }
    ctrl.update(cam, dt, rt.car, input.lookBack);
    rt.hideBody = ctrl.hideBody;
    live().cameraName = CAMERA_MODES[ctrl.modeIndex].name;
    if (interior.current) interior.current.visible = ctrl.interior;
    if (wheel.current) wheel.current.rotation.z = -rt.car.steer * 1.7;
  }, -5);

  return createPortal(
    <group ref={interior} visible={false}>
      <CockpitInterior wheel={wheel} color={color} />
    </group>,
    cam,
  );
}
