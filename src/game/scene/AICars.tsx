import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { CAR, FIXED_DT } from '../constants';
import { AI_DEFS, initAI, stepAI, type AIState } from '../race/ai';
import { FEED_DEFAULT, rt, type WheelFeed } from '../state/runtime';
import { live } from '../state/telemetry';
import type { TrackData } from '../track/trackData';
import { CarModel } from './CarModel';

const SUSP = [0.28, 0.28, 0.28, 0.28];

function AICar({ track, index, state, feed }: { track: TrackData; index: number; state: AIState; feed: WheelFeed }) {
  const ref = useRef<RapierRigidBody>(null);
  const def = AI_DEFS[index];
  useBeforePhysicsStep(() => {
    const b = ref.current;
    if (!b) return;
    if (live().race.phase === 'racing') stepAI(track, state, def, FIXED_DT);
    b.setNextKinematicTranslation({ x: state.x, y: state.y, z: state.z });
    const hy = state.yaw / 2, hp = state.pitch / 2;
    // quaternion for yaw (Y) then pitch (X) in 'YXZ' order
    const cy = Math.cos(hy), sy = Math.sin(hy), cp = Math.cos(hp), sp = Math.sin(hp);
    b.setNextKinematicRotation({ x: cy * sp, y: sy * cp, z: -sy * sp, w: cy * cp });
    rt.ai[index].dist = state.dist; rt.ai[index].x = state.x; rt.ai[index].z = state.z; rt.ai[index].yaw = state.yaw;
    feed.speedMs = state.v;
  });
  return (
    <RigidBody ref={ref} type="kinematicPosition" colliders={false} position={[state.x, state.y, state.z]} rotation={[state.pitch, state.yaw, 0]}>
      <CuboidCollider args={[CAR.halfExtents[0], CAR.halfExtents[1], CAR.halfExtents[2]]} position={[0, CAR.colliderOffsetY, 0]} friction={0.1} />
      <CarModel color={def.color} feed={feed} />
    </RigidBody>
  );
}

/** 3 simple AI opponents following the spline racing line (kinematic bodies: the player can bump them). */
export function AICars({ track }: { track: TrackData }) {
  const states = useMemo(() => AI_DEFS.map((d) => initAI(track, d)), [track]);
  const feeds = useMemo(() => AI_DEFS.map(() => ({ ...FEED_DEFAULT(), susp: SUSP })), []);
  useMemo(() => {
    rt.ai = AI_DEFS.map((_, i) => ({ dist: states[i].dist, x: states[i].x, z: states[i].z, yaw: states[i].yaw }));
    const L = live();
    L.ai = rt.ai.map(() => ({ x: 0, z: 0, yaw: 0 }));
  }, [states]);
  useFrame(() => {
    const L = live();
    for (let i = 0; i < rt.ai.length; i++) {
      L.ai[i].x = rt.ai[i].x; L.ai[i].z = rt.ai[i].z; L.ai[i].yaw = rt.ai[i].yaw;
      feeds[i].brake = false;
    }
  }, -9);
  return (
    <>
      {AI_DEFS.map((d, i) => <AICar key={d.name} track={track} index={i} state={states[i]} feed={feeds[i]} />)}
    </>
  );
}
