import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { VehicleSpec } from '../vehicle/catalog';
import type { WheelFeed } from '../state/runtime';
import { useApp } from '../state/store';
import { hudBus } from '../state/hudBus';
import { FallbackCar } from './FallbackCar';

const assets = new Map<string, Promise<THREE.Group>>();
function load(file: string) {
  if (!assets.has(file)) assets.set(file, new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${file}`).then(g => g.scene));
  return assets.get(file)!;
}
type Props = { spec: VehicleSpec; color: string; feed: WheelFeed; bodyRef: React.RefObject<THREE.Group | null> };
export function GarageModel(props: Props) {
  const [source, setSource] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let active = true;
    load(props.spec.model).then(s => { if (active) setSource(s); }).catch(() => {
      if (active) hudBus.toast({ kind: 'warn', text: 'Model unavailable — recovery vehicle active' });
    });
    return () => { active = false; };
  }, [props.spec.model]);
  const night = useApp(s => s.settings.environment === 'night');
  const [target] = useState(() => { const t = new THREE.Object3D(); t.position.set(0, -0.7, -32); return t; });
  return <>
    {source ? <Loaded key={props.spec.id} {...props} source={source} /> : props.spec.kind === 'car' ? <FallbackCar {...props} /> : <group ref={props.bodyRef}>
      <mesh position={[0, 0.05, 0]}><capsuleGeometry args={[0.22, 0.75, 4, 8]} /><meshStandardMaterial color={props.color} /></mesh>
      {[-0.72, 0.72].map(z => <mesh key={z} position={[0, -0.4, z]} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.25, 0.07, 8, 20]} /><meshStandardMaterial color="#111" /></mesh>)}
    </group>}
    <primitive object={target} />
    {(props.spec.kind === 'bike' ? [0] : [-0.65, 0.65]).map(x => <spotLight key={x} position={[x, props.spec.kind === 'bike' ? 0.25 : 0.08, props.spec.kind === 'bike' ? -0.9 : -2.2]} target={target} color="#daefff" intensity={night ? 200 : 0} distance={80} angle={0.42} penumbra={0.65} decay={1.2} />)}
  </>;
}
function Loaded({ source, spec, color, feed, bodyRef }: Props & { source: THREE.Group }) {
  const [model] = useState(() => {
    const scene = source.clone(true); const materials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    scene.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      o.castShadow = o.receiveShadow = true;
      const material = o.material as THREE.MeshStandardMaterial;
      if (!materials.has(material)) { const m = material.clone(); if (m.name === 'paint') m.color.set(color); materials.set(material, m); }
      o.material = materials.get(material)!;
    });
    const wheels = Array.from({ length: spec.kind === 'bike' ? 2 : 4 }, (_, i) => scene.getObjectByName(`wheel-${i}`)!);
    return { scene, wheels, materials: [...materials.values()] };
  });
  const spin = useRef(0);
  useEffect(() => { model.materials.forEach(m => { if (m.name === 'paint') m.color.set(color); }); }, [color, model]);
  useEffect(() => () => model.materials.forEach(m => m.dispose()), [model]);
  useFrame((_, delta) => {
    const app = useApp.getState();
    if (app.screen === 'play') spin.current -= feed.speedMs / spec.chassis.wheelRadius * Math.min(delta, 0.05);
    model.wheels.forEach((wheel, i) => {
      wheel.position.y = spec.chassis.hardPointY - feed.susp[i];
      wheel.rotation.order = 'YXZ';
      wheel.rotation.y = i < (spec.kind === 'bike' ? 1 : 2) ? feed.steer : 0;
      wheel.rotation.x = spin.current;
    });
    model.materials.forEach(m => {
      if (m.name === 'taillight') m.emissiveIntensity = feed.brake ? 4 : app.settings.environment === 'night' ? 1.5 : 0.35;
      if (m.name === 'headlight') m.emissiveIntensity = app.settings.environment === 'night' ? 3 : 0.4;
    });
  });
  return <group ref={bodyRef} name="garage-vehicle" userData={{ vehicle: spec.id }}><primitive object={model.scene} dispose={null} /></group>;
}
