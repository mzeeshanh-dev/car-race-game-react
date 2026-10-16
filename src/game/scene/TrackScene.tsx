import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { QUALITY } from '../quality';
import { TRACK_CFG, ROAD_HALF } from '../constants';
import { useApp } from '../state/store';
import { buildBarrierSegments } from '../track/barriers';
import { buildRoadGeometry } from '../track/geometry';
import { createTrackPhysics } from '../track/physicsBuild';
import { trackYaw, type TrackData } from '../track/trackData';
import { makeCheckerTexture, makeGrassTexture, makeRoadTexture, rng } from './textures';
import { TrackDetails } from './TrackDetails';

/** Road + shoulders + embankment render mesh. Built from the SAME arrays as the trimesh collider. */
function RoadMesh({ track }: { track: TrackData }) {
  const { geometry, materials } = useMemo(() => {
    const d = buildRoadGeometry(track);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(d.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(d.indices, 1));
    for (const grp of d.groups) g.addGroup(grp.start, grp.count, grp.materialIndex);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const grass = makeGrassTexture();
    grass.repeat.set(5, 3);
    const emb = makeGrassTexture();
    emb.repeat.set(8, 3);
    const road = makeRoadTexture();
    const mats = [
      new THREE.MeshStandardMaterial({ map: emb, color: '#8fb078', roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: road, roughness: 0.92, metalness: 0 }),
      new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }),
      new THREE.MeshStandardMaterial({ map: emb, color: '#8fb078', roughness: 1 }),
    ];
    return { geometry: g, materials: mats };
  }, [track]);
  useEffect(() => () => { geometry.dispose(); materials.forEach((m) => { m.map?.dispose(); m.dispose(); }); }, [geometry, materials]);
  return <mesh geometry={geometry} material={materials} receiveShadow frustumCulled={false} />;
}

function GroundPlane() {
  const map = useMemo(() => { const t = makeGrassTexture(); t.repeat.set(900, 900); return t; }, []);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, TRACK_CFG.groundY - 0.03, 0]} receiveShadow>
      <planeGeometry args={[9000, 9000]} />
      <meshStandardMaterial map={map} color="#9dbb86" roughness={1} />
    </mesh>
  );
}

/** Static colliders: road trimesh, barriers, safety ground. */
function TrackPhysics({ track }: { track: TrackData }) {
  const { world, rapier } = useRapier();
  useEffect(() => {
    const bodies = createTrackPhysics(rapier, world, track);
    // Physics can replace its lazy world before child cleanup (StrictMode replay).
    // Never pass a body belonging to the disposed world into its replacement.
    const owner = world.bodies;
    return () => { if (world.bodies !== owner) return; for (const b of bodies) { if (world.getRigidBody(b.handle) === b) world.removeRigidBody(b); } };
  }, [world, rapier, track]);
  return null;
}

function Barriers({ track }: { track: TrackData }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const segs = useMemo(() => buildBarrierSegments(track), [track]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const red = new THREE.Color('#d62828');
    const white = new THREE.Color('#f1f1f1');
    segs.forEach((s, i) => {
      pos.set(s.cx, s.cy, s.cz);
      quat.set(s.qx, s.qy, s.qz, s.qw);
      scl.set(s.hx * 2, s.hy * 2, s.hz * 2);
      mat.compose(pos, quat, scl);
      m.setMatrixAt(i, mat);
      m.setColorAt(i, Math.floor(i / 2) % 2 ? red : white);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [segs]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, segs.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.6} metalness={0.1} />
    </instancedMesh>
  );
}

function StartGantry({ track }: { track: TrackData }) {
  const i = track.gates[0];
  const yaw = trackYaw(track, i);
  const checker = useMemo(() => makeCheckerTexture(40, 2), []);
  const banner = useMemo(() => makeCheckerTexture(24, 3), []);
  useEffect(() => () => { checker.dispose(); banner.dispose(); }, [checker, banner]);
  const w = TRACK_CFG.roadWidth;
  return (
    <group position={[track.px[i], track.py[i], track.pz[i]]} rotation={[0, yaw, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <planeGeometry args={[w, 1.6]} />
        <meshBasicMaterial map={checker} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (ROAD_HALF + 1.2), 3.6, 0]} castShadow>
          <boxGeometry args={[0.7, 7.2, 0.7]} />
          <meshStandardMaterial color="#20232b" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 7, 0]} castShadow>
        <boxGeometry args={[w + 3.4, 1.8, 0.8]} />
        <meshStandardMaterial map={banner} />
      </mesh>
    </group>
  );
}

function CheckpointPosts({ track }: { track: TrackData }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const gates = track.gates.slice(1);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    let n = 0;
    for (const g of gates) {
      for (const side of [-1, 1]) {
        const lat = side * (TRACK_CFG.barrierOffset + 1.2);
        mat.makeTranslation(track.px[g] + track.rx[g] * lat, track.py[g] + 2, track.pz[g] + track.rz[g] * lat);
        m.setMatrixAt(n++, mat);
      }
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [gates, track]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, gates.length * 2]} frustumCulled={false}>
      <cylinderGeometry args={[0.18, 0.18, 4, 8]} />
      <meshStandardMaterial color="#2f7df6" emissive="#1a55c8" emissiveIntensity={0.8} />
    </instancedMesh>
  );
}

/** Instanced trees placed away from the circuit (seeded, deterministic). */
function Trees({ track }: { track: TrackData }) {
  const quality = useApp((s) => s.settings.quality);
  const count = QUALITY[quality].trees;
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);
  const crown2 = useRef<THREE.InstancedMesh>(null);
  const placed = useMemo(() => {
    const r = rng(1234);
    const out: { x: number; z: number; s: number; h: number }[] = [];
    let tries = 0;
    while (out.length < count && tries < count * 40) {
      tries++;
      const i = Math.floor(r() * track.count);
      const lat = (r() < 0.5 ? -1 : 1) * (34 + r() * 130);
      const x = track.px[i] + track.rx[i] * lat + (r() - 0.5) * 30;
      const z = track.pz[i] + track.rz[i] * lat + (r() - 0.5) * 30;
      let ok = true;
      for (let j = 0; j < track.count; j += 3) {
        const dx = x - track.px[j], dz = z - track.pz[j];
        if (dx * dx + dz * dz < 34 * 34) { ok = false; break; }
      }
      if (ok) out.push({ x, z, s: 0.8 + r() * 0.9, h: r() });
    }
    return out;
  }, [track, count]);
  useLayoutEffect(() => {
    const mat = new THREE.Matrix4();
    const col = new THREE.Color();
    placed.forEach((t, i) => {
      const y = TRACK_CFG.groundY;
      mat.makeScale(t.s, t.s, t.s).setPosition(t.x, y + 1.1 * t.s, t.z);
      trunk.current?.setMatrixAt(i, mat);
      mat.makeScale(t.s, t.s, t.s).setPosition(t.x, y + 4.2 * t.s, t.z);
      crown.current?.setMatrixAt(i, mat);
      col.setHSL(0.27 + t.h * 0.06, 0.45, 0.2 + t.h * 0.08);
      crown.current?.setColorAt(i, col);
      mat.makeScale(t.s * 0.72, t.s * 0.72, t.s * 0.72).setPosition(t.x, y + 6.4 * t.s, t.z);
      crown2.current?.setMatrixAt(i, mat);
      crown2.current?.setColorAt(i, col);
    });
    for (const m of [trunk.current, crown.current, crown2.current]) {
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [placed]);
  return (
    <group key={count}>
      <instancedMesh ref={trunk} args={[undefined, undefined, placed.length]} castShadow>
        <cylinderGeometry args={[0.28, 0.4, 2.2, 6]} />
        <meshStandardMaterial color="#5b3a22" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, placed.length]} castShadow>
        <coneGeometry args={[2.4, 5, 7]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crown2} args={[undefined, undefined, placed.length]} castShadow>
        <coneGeometry args={[2.4, 5, 7]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </group>
  );
}

export function TrackScene({ track }: { track: TrackData }) {
  return (
    <>
      <GroundPlane />
      <RoadMesh track={track} />
      <Barriers track={track} />
      <StartGantry track={track} />
      <CheckpointPosts track={track} />
      <Trees track={track} />
      <TrackPhysics track={track} />
      <TrackDetails track={track} />
    </>
  );
}
