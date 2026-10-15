import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky } from '@react-three/drei';
import * as THREE from 'three';
import { QUALITY } from '../quality';
import { rt } from '../state/runtime';
import { useApp } from '../state/store';

const SUN = new THREE.Vector3(120, 160, 70);

export function Lighting() {
  const quality = useApp((s) => s.settings.quality);
  const q = QUALITY[quality];
  const light = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();
  const fog = useMemo(() => new THREE.Fog('#bcd3e6', 150, q.fogFar), [q.fogFar]);

  useEffect(() => {
    scene.fog = fog;
    scene.background = new THREE.Color('#bcd3e6');
    return () => { scene.fog = null; };
  }, [scene, fog]);

  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const c = rt.car;
    l.position.set(c.x + SUN.x, c.y + SUN.y, c.z + SUN.z);
    l.target.position.set(c.x, c.y, c.z);
    l.target.updateMatrixWorld();
  }, -4);

  return (
    <>
      <hemisphereLight args={['#dfeaff', '#4b6a3a', 0.85]} />
      <directionalLight
        ref={light}
        intensity={2.2}
        castShadow={q.shadows}
        shadow-mapSize={[q.shadowMap, q.shadowMap]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={10}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
      />
      {q.sky && <Sky distance={4500} sunPosition={[SUN.x, SUN.y * 0.6, SUN.z]} turbidity={6} rayleigh={1.6} />}
    </>
  );
}
