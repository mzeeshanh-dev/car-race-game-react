import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { CAR, FIXED_DT } from '../constants';
import { input } from '../input/InputManager';
import { tilt } from '../input/tilt';
import { FEED_DEFAULT, rt } from '../state/runtime';
import { useApp } from '../state/store';
import { live, useTelemetry } from '../state/telemetry';
import { VehicleSim, type DriveInput } from '../vehicle/VehicleSim';
import type { TrackData } from '../track/trackData';
import { CarModel } from './CarModel';
import { reportImpact } from '../state/effects';
import { vehicleSpec } from '../vehicle/catalog';
import { GarageModel } from './GarageModel';

export interface Spawn { x: number; y: number; z: number; yaw: number }

const drive: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };

/** Player car: Rapier dynamic body + DynamicRayCastVehicleController (see VehicleSim). */
export function PlayerCar({ track, spawn }: { track: TrackData; spawn: Spawn }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);
  const feed = useRef(FEED_DEFAULT()).current;
  const color = useApp((s) => s.settings.carColor);
  const spec = useRef(vehicleSpec(useApp.getState().restore?.vehicle ?? useApp.getState().settings.vehicle)).current;
  const chassis = spec.chassis;
  const { world } = useRapier();
  const simRef = useRef<VehicleSim | null>(null);
  useEffect(() => {
    const owner = world.bodies;
    return () => {
      const sim = simRef.current;
      if (sim && world.bodies === owner) world.removeVehicleController(sim.controller);
      if (rt.sim === sim) rt.sim = null;
      simRef.current = null;
    };
  }, [world]);

  const ensureSim = (): VehicleSim | null => {
    const body = bodyRef.current;
    if (!body) return null;
    if (simRef.current && simRef.current.body === body) return simRef.current;
    if (simRef.current) { try { world.removeVehicleController(simRef.current.controller); } catch { /* ignore */ } }
    const sim = new VehicleSim(world, body, track, spec);
    sim.respawn(spawn.x, spawn.y, spawn.z, spawn.yaw);
    simRef.current = sim;
    rt.sim = sim;
    useTelemetry.getState().live.vehicle = sim.live;
    input.reset();
    return sim;
  };

  useBeforePhysicsStep(() => {
    const sim = ensureSim();
    if (!sim) return;
    tilt.enabled = useApp.getState().settings.tilt;
    tilt.sensitivity = useApp.getState().settings.tiltSensitivity;
    input.sample(FIXED_DT);
    const phase = live().race.phase;
    sim.sensitivity = useApp.getState().settings.sensitivity;
    if (phase === 'countdown') {
      drive.throttle = 0; drive.brake = 0; drive.steer = 0; drive.handbrake = true;
    } else if (phase === 'finished') {
      drive.throttle = 0; drive.brake = 0.5; drive.steer = 0; drive.handbrake = false;
    } else {
      drive.throttle = input.throttle; drive.brake = input.brake; drive.steer = input.steer; drive.handbrake = input.handbrake;
    }
    sim.step(FIXED_DT, drive);
  });

  // after r3r has interpolated the transform (physics runs at priority -50), publish the smooth pose
  useFrame(() => {
    const sim = simRef.current;
    const obj = visual.current?.parent;
    if (!sim || !obj) return;
    const q = obj.quaternion;
    const c = rt.car;
    c.x = obj.position.x; c.y = obj.position.y; c.z = obj.position.z;
    const fx = -2 * (q.x * q.z + q.w * q.y);
    const fz = -(1 - 2 * (q.x * q.x + q.y * q.y));
    const fl = Math.hypot(fx, fz);
    if (fl > 0.2) { c.fx = fx / fl; c.fz = fz / fl; c.yaw = Math.atan2(-c.fx, -c.fz); }
    c.speedKmh = sim.live.speedKmh;
    c.yawRate = sim.live.yawRate;
    c.steer = input.steer;
    c.upY = sim.live.upY;
    c.valid = true;
    const L = live();
    L.car.x = c.x; L.car.z = c.z; L.car.yaw = c.yaw;
    feed.susp = sim.wheelSusp;
    feed.speedMs = sim.live.speedMs;
    feed.steer = sim.live.wheelAngle;
    feed.brake = sim.live.brake > 0.05 && sim.live.speedMs > -1;
    if (bodyGroup.current) bodyGroup.current.visible = !rt.hideBody;
  }, -10);

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      position={[spawn.x, spawn.y, spawn.z]}
      rotation={[0, spawn.yaw, 0]}
      canSleep={false}
      ccd
      onContactForce={e => {
        if (useApp.getState().screen !== 'play' || live().race.phase !== 'racing') return;
        const p = bodyRef.current?.translation();
        if (p) reportImpact(e.totalForceMagnitude, FIXED_DT, chassis.mass, p.x, p.y, p.z, performance.now());
      }}
    >
      <CuboidCollider
        args={[...chassis.halfExtents]}
        position={[0, chassis.colliderOffsetY, 0]}
        density={0}
        friction={0.1}
        restitution={0.2}
      />
      <group ref={visual}>
        {spec.id === 'apex' ? <CarModel color={color} feed={feed} bodyRef={bodyGroup} /> : <GarageModel spec={spec} color={color} feed={feed} bodyRef={bodyGroup} />}
      </group>
    </RigidBody>
  );
}
