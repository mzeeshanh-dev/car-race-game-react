import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rt } from '../state/runtime';
import { useApp } from '../state/store';

/** Bounded ring of road decals sampled from the two rear wheel contact points. */
export function SkidMarks() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const state = useRef({ cursor: 0, time: 0, initialized: false });
  useFrame((_, delta) => {
    const m = mesh.current; if (!m) return;
    const s = state.current;
    if (!s.initialized) {
      dummy.scale.setScalar(0); dummy.updateMatrix();
      for (let i = 0; i < 240; i++) m.setMatrixAt(i, dummy.matrix);
      m.instanceMatrix.needsUpdate = true; s.initialized = true;
    }
    if (useApp.getState().screen !== 'play') return;
    s.time += delta;
    const sim = rt.sim;
    if (!sim || s.time < 0.06 || sim.live.speedKmh < 18 || sim.live.slip < 2 || !sim.live.onRoad) return;
    s.time = 0;
    for (const wheel of sim.rearWheels) {
      if (!sim.controller.wheelIsInContact(wheel)) continue;
      const p = sim.controller.wheelContactPoint(wheel);
      if (!p) continue;
      dummy.position.set(p.x, p.y + 0.025, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, -rt.car.yaw);
      dummy.scale.set(0.24, Math.min(1.5, Math.max(0.35, sim.live.speedKmh / 3.6 * 0.065)), 1);
      dummy.updateMatrix(); m.setMatrixAt(s.cursor++ % 240, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, 240]} frustumCulled={false}>
    <planeGeometry /><meshBasicMaterial color="#11141a" transparent opacity={0.38} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
  </instancedMesh>;
}
