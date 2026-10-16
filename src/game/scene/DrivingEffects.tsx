import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rt } from '../state/runtime';
import { effects } from '../state/effects';
import { useApp } from '../state/store';

/** Fixed particle pool: no per-frame geometries, timers or React updates. */
export function DrivingEffects() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const pool = useMemo(() => Array.from({ length: 96 }, () => ({ x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, spark: false })), []);
  const state = useRef({ serial: effects.serial, cursor: 0, interval: 0 });
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame((_, delta) => {
    const m = mesh.current; if (!m) return;
    const dt = useApp.getState().screen === 'play' ? Math.min(delta, 0.05) : 0;
    const s = state.current; const car = rt.car; const sim = rt.sim;
    const emit = (spark: boolean, count: number) => {
      for (let j = 0; j < count; j++) {
        const p = pool[s.cursor++ % pool.length];
        p.spark = spark; p.life = spark ? 0.35 : 0.8;
        p.x = spark ? effects.x : car.x - car.fx * 1.3 + (Math.random() - 0.5) * 1.5;
        p.y = spark ? effects.y : car.y - 0.55;
        p.z = spark ? effects.z : car.z - car.fz * 1.3;
        p.vx = (Math.random() - 0.5) * (spark ? 14 : 2); p.vz = (Math.random() - 0.5) * (spark ? 14 : 2);
        p.vy = spark ? Math.random() * 5 : 0.8;
      }
    };
    if (dt && s.serial !== effects.serial) { s.serial = effects.serial; emit(true, useApp.getState().settings.quality === 'low' ? 12 : 28); }
    s.interval += dt;
    if (dt && sim && s.interval > 0.055 && sim.live.grounded > 1 && sim.live.speedKmh > 18 && (sim.live.slip > 2 || sim.live.grassCoverage > 0.4)) {
      s.interval = 0; emit(false, 2);
    }
    pool.forEach((p, i) => {
      p.life = Math.max(0, p.life - dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.spark) p.vy -= 9.8 * dt;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.life ? p.spark ? 0.035 : (0.85 - p.life) * 0.5 : 0);
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
      color.set(p.spark ? '#ffb451' : sim?.live.grassCoverage ? '#9d8868' : '#999fa6'); m.setColorAt(i, color);
    });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, pool.length]} frustumCulled={false}>
    <icosahedronGeometry args={[1, 0]} /><meshBasicMaterial transparent opacity={0.45} depthWrite={false} />
  </instancedMesh>;
}
