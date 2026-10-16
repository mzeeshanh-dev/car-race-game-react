import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { QUALITY } from '../quality';
import { rt } from '../state/runtime';
import { useApp } from '../state/store';
const SUN = new THREE.Vector3(120, 160, 70);
export function Lighting() {
  const quality = useApp(s => s.settings.quality);
  const night = useApp(s => s.settings.environment === 'night');
  const q = QUALITY[quality];
  const light = useRef<THREE.DirectionalLight>(null);
  const { scene, gl } = useThree();
  const fog = useMemo(() => new THREE.Fog(night ? '#071020' : '#bcd3e6', night ? 80 : 150, q.fogFar), [q.fogFar, night]);
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = generator.fromScene(room, 0.04);
    scene.environment = env.texture;
    room.dispose(); generator.dispose();
    return () => { scene.environment = null; env.dispose(); };
  }, [gl, scene]);
  useEffect(() => {
    scene.fog = fog;
    scene.background = new THREE.Color(night ? '#071020' : '#bcd3e6');
    scene.environmentIntensity = night ? 0.22 : 0.65;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = night ? 0.85 : 1.05;
    return () => { scene.fog = null; };
  }, [scene, fog, gl, night]);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const c = rt.car;
    l.position.set(c.x + SUN.x, c.y + SUN.y, c.z + SUN.z);
    l.target.position.set(c.x, c.y, c.z); l.target.updateMatrixWorld();
  }, -4);
  return <>
    <hemisphereLight args={[night ? '#637dad' : '#dfeaff', night ? '#101722' : '#4b6a3a', night ? 0.45 : 0.85]} />
    <directionalLight ref={light} intensity={night ? 0.35 : 2.2} color={night ? '#9ab6ef' : '#fff2dc'} castShadow={q.shadows}
      shadow-mapSize={[q.shadowMap, q.shadowMap]} shadow-camera-left={-70} shadow-camera-right={70}
      shadow-camera-top={70} shadow-camera-bottom={-70} shadow-camera-near={10} shadow-camera-far={400} shadow-bias={-0.0004} />
    {q.sky && !night && <Sky distance={4500} sunPosition={[SUN.x, SUN.y * 0.6, SUN.z]} turbidity={6} rayleigh={1.6} />}
    {night && <Stars radius={1300} depth={300} count={quality === 'low' ? 400 : 1400} factor={3} fade speed={0} />}
  </>;
}
