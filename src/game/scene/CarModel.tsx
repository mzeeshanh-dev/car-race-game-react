import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CAR } from '../constants';
import type { WheelFeed } from '../state/runtime';
import { useApp } from '../state/store';
import { FallbackCar } from './FallbackCar';
import { hudBus } from '../state/hudBus';

let source: Promise<THREE.Group> | undefined;
const load = () => source ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/sports-car.glb`).then(g => g.scene);
const positions = [[-CAR.wheelX, -CAR.wheelZ], [CAR.wheelX, -CAR.wheelZ], [-CAR.wheelX, CAR.wheelZ], [CAR.wheelX, CAR.wheelZ]];
type Props = { color: string; feed: WheelFeed; bodyRef?: React.RefObject<THREE.Group | null> };

/** Quaternius CC0 Sports Car, normalized from +Z to -Z forward. */
export function CarModel(props: Props) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let alive = true;
    load().then(g => { if (alive) setModel(g); }).catch(() => {
      if (alive && props.bodyRef) hudBus.toast({ kind: 'warn', text: 'Car model unavailable - using recovery model' });
    });
    return () => { alive = false; };
  }, []);
  return model ? <SportsCar {...props} source={model} /> : <FallbackCar {...props} />;
}

function SportsCar({ source, color, feed, bodyRef }: Props & { source: THREE.Group }) {
  const [parts] = useState(() => {
    const materials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const clone = (obj: THREE.Object3D) => {
      const result = obj.clone(true);
      result.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        o.castShadow = true; o.receiveShadow = true;
        const mat = o.material as THREE.MeshStandardMaterial;
        if (!materials.has(mat)) {
          const m = mat.clone();
          if (m.name === 'White') { m.color.set(color); m.metalness = 0.65; m.roughness = 0.25; }
          if (m.name === 'Windows') { m.metalness = 0.55; m.roughness = 0.12; }
          if (m.name === 'Grey') { m.metalness = 0.8; m.roughness = 0.3; }
          if (m.name === 'TailLights') m.emissive.set('#ff1825');
          if (m.name === 'Headlights') { m.color.set('#f2f6ff'); m.emissive.set('#dceaff'); }
          materials.set(mat, m);
        }
        o.material = materials.get(mat)!;
      });
      return result;
    };
    const body = clone(source.children.find(o => !o.name.includes('Wheel')) ?? source.children[0]);
    const wheelSource = source.children.find(o => o.name.includes('FrontLeftWheel'))!;
    const wheelCenter = new THREE.Box3().setFromObject(wheelSource).getCenter(new THREE.Vector3());
    const wheels = positions.map(() => {
      const wheel = clone(wheelSource);
      wheel.position.sub(wheelCenter);
      const pivot = new THREE.Group(); pivot.add(wheel);
      pivot.scale.setScalar(CAR.wheelRadius / 0.2803935);
      return pivot;
    });
    return { body, wheels, materials: [...materials.values()] };
  });
  const pivots = useRef<(THREE.Group | null)[]>([]);
  const spin = useRef(0);
  const night = useApp(s => s.settings.environment === 'night');
  useEffect(() => { parts.materials.forEach(m => { if (m.name === 'White') m.color.set(color); }); }, [color, parts]);
  useEffect(() => () => parts.materials.forEach(m => m.dispose()), [parts]);
  useFrame((_, delta) => {
    if (useApp.getState().screen === 'play') spin.current -= feed.speedMs / CAR.wheelRadius * Math.min(delta, 0.05);
    parts.wheels.forEach((w, i) => {
      const p = pivots.current[i];
      if (p) { p.position.y = CAR.hardPointY - feed.susp[i]; p.rotation.y = i < 2 ? feed.steer : 0; }
      w.rotation.set(spin.current, 0, i % 2 ? 0 : Math.PI);
    });
    parts.materials.forEach(m => {
      if (m.name === 'TailLights') m.emissiveIntensity = feed.brake ? 4 : night ? 1.5 : 0.25;
      if (m.name === 'Headlights') m.emissiveIntensity = night ? 3 : 0.3;
    });
  });
  return <>
    <group ref={bodyRef} name="sports-car-body">
      <group rotation={[0, Math.PI, 0]} position={[0, -0.705, -0.07]} scale={[1.02, 1, 1.0372]}>
        <primitive object={parts.body} dispose={null} />
      </group>
    </group>
    {positions.map(([x, z], i) => <group key={i} ref={g => { pivots.current[i] = g; }} position={[x, -0.44, z]}>
      <primitive object={parts.wheels[i]} dispose={null} />
    </group>)}
    {bodyRef && <Headlights night={night} />}
  </>;
}

function Headlights({ night }: { night: boolean }) {
  const [target] = useState(() => { const o = new THREE.Object3D(); o.position.set(0, -0.9, -32); return o; });
  return <group>
    <primitive object={target} />
    {[-0.62, 0.62].map(x => <spotLight key={x} position={[x, -0.05, -1.8]} target={target}
      color="#dceaff" intensity={night ? 220 : 0} distance={85} angle={0.42} penumbra={0.65} decay={1.2} />)}
  </group>;
}
