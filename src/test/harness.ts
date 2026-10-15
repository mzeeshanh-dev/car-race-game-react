import RAPIER from '@dimforge/rapier3d-compat';
import { CAR } from '../game/constants';
import { createTrackPhysics } from '../game/track/physicsBuild';
import { buildTrack, trackYaw, type TrackData } from '../game/track/trackData';
import { VehicleSim, type DriveInput } from '../game/vehicle/VehicleSim';

let inited = false;
export async function initRapier(): Promise<typeof RAPIER> {
  if (!inited) {
    // newer rapier builds accept an object, older ones nothing; avoid the deprecation warning path
    await (RAPIER.init as unknown as (o?: object) => Promise<void>)({});
    inited = true;
  }
  return RAPIER;
}

export interface Rig {
  world: RAPIER.World;
  sim: VehicleSim;
  track: TrackData | null;
  step(input: Partial<DriveInput>, n?: number): void;
  pos(): { x: number; y: number; z: number };
  yaw(): number;
}

export async function makeRig(opts: { track?: boolean; x?: number; y?: number; z?: number; yaw?: number } = {}): Promise<Rig> {
  const R = await initRapier();
  const world = new R.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  let track: TrackData | null = null;
  let sx = opts.x ?? 0;
  let sy = opts.y ?? 1.2;
  let sz = opts.z ?? 0;
  let syaw = opts.yaw ?? 0;
  if (opts.track) {
    track = buildTrack();
    createTrackPhysics(R, world, track);
    sx = track.px[0]; sy = track.py[0] + 1.0; sz = track.pz[0];
    syaw = trackYaw(track, 0);
  } else {
    const g = world.createRigidBody(R.RigidBodyDesc.fixed());
    world.createCollider(R.ColliderDesc.cuboid(5000, 0.5, 5000).setTranslation(0, -0.5, 0).setFriction(1), g);
  }
  const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setCanSleep(false));
  const h = CAR.halfExtents;
  world.createCollider(
    R.ColliderDesc.cuboid(h[0], h[1], h[2]).setTranslation(0, CAR.colliderOffsetY, 0).setDensity(0).setFriction(0.1).setRestitution(0.2),
    body,
  );
  const sim = new VehicleSim(world, body, track);
  sim.respawn(sx, sy, sz, syaw);
  const idle: DriveInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  return {
    world, sim, track,
    step(input, n = 1) {
      const inp = { ...idle, ...input };
      for (let i = 0; i < n; i++) { sim.step(1 / 60, inp); world.step(); }
    },
    pos: () => body.translation(),
    yaw() { const q = body.rotation(); return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x)); },
  };
}
