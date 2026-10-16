import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROAD_HALF } from '../constants';
import type { TrackData } from '../track/trackData';
import { useApp } from '../state/store';
import { rt } from '../state/runtime';

/** Circuit furniture is instanced; only the two nearest lamps emit real light. */
export function TrackDetails({ track }: { track: TrackData }) {
  const night = useApp(s => s.settings.environment === 'night');
  const quality = useApp(s => s.settings.quality);
  const curb = useRef<THREE.InstancedMesh>(null);
  const posts = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const polePositions = useMemo(() => {
    const result: THREE.Vector3[] = [];
    for (let i = 0; i < track.count; i += 40) result.push(new THREE.Vector3(track.px[i] + track.rx[i] * 16, track.py[i] + 6, track.pz[i] + track.rz[i] * 16));
    return result;
  }, [track]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D(); const color = new THREE.Color();
    let n = 0;
    for (let i = 0; i < track.count; i += 2) for (const side of [-1, 1]) {
      o.position.set(track.px[i] + track.rx[i] * (ROAD_HALF - 0.25) * side, track.py[i] + 0.025, track.pz[i] + track.rz[i] * (ROAD_HALF - 0.25) * side);
      o.rotation.set(0, Math.atan2(-track.fx[i], -track.fz[i]), 0);
      o.scale.set(0.55, 0.04, track.step * 2.05); o.updateMatrix();
      curb.current?.setMatrixAt(n, o.matrix); curb.current?.setColorAt(n++, color.set(i % 4 ? '#eeeeec' : '#c72d3b'));
    }
    polePositions.forEach((p, i) => {
      o.rotation.set(0, 0, 0); o.position.copy(p); o.position.y -= 3;
      o.scale.set(0.16, 6, 0.16); o.updateMatrix(); posts.current?.setMatrixAt(i, o.matrix);
      o.position.copy(p); o.scale.set(1.2, 0.15, 0.65); o.updateMatrix(); lamps.current?.setMatrixAt(i, o.matrix);
    });
    for (const m of [curb.current, posts.current, lamps.current]) if (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }
  }, [track, polePositions]);
  useFrame(() => {
    if (!night || quality === 'low') return;
    let first = 0, second = 1, d1 = Infinity, d2 = Infinity;
    polePositions.forEach((p, i) => {
      const d = (p.x - rt.car.x) ** 2 + (p.z - rt.car.z) ** 2;
      if (d < d1) { second = first; d2 = d1; first = i; d1 = d; }
      else if (d < d2) { second = i; d2 = d; }
    });
    lights.current[0]?.position.copy(polePositions[first]); lights.current[1]?.position.copy(polePositions[second]);
  });
  return <>
    <instancedMesh ref={curb} args={[undefined, undefined, Math.ceil(track.count / 2) * 2]}><boxGeometry /><meshStandardMaterial roughness={0.85} /></instancedMesh>
    <instancedMesh ref={posts} args={[undefined, undefined, polePositions.length]}><boxGeometry /><meshStandardMaterial color="#303846" metalness={0.6} roughness={0.5} /></instancedMesh>
    <instancedMesh ref={lamps} args={[undefined, undefined, polePositions.length]}><boxGeometry /><meshStandardMaterial color="#dceaff" emissive="#b4d8ff" emissiveIntensity={night ? 4 : 0} /></instancedMesh>
    {night && quality !== 'low' && [0, 1].map(i => <pointLight key={i} ref={l => { lights.current[i] = l; }} intensity={180} distance={32} decay={1.3} color="#b9d9ff" />)}
  </>;
}
