import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { TRACK_CFG } from '../constants';
import { buildBarrierSegments } from './barriers';
import { buildRoadGeometry } from './geometry';
import type { TrackData } from './trackData';

/** Minimal slice of the RAPIER module we need (works with `useRapier().rapier` and with the compat import). */
export type RapierLike = Pick<typeof import('@dimforge/rapier3d-compat'), 'RigidBodyDesc' | 'ColliderDesc'>;

/**
 * Creates the static world: road trimesh (from the SAME geometry as the render mesh), solid guard barriers on both
 * sides, and a huge flat safety ground. Returns the created bodies so the caller can remove them.
 */
export function createTrackPhysics(R: RapierLike, world: World, track: TrackData): RigidBody[] {
  const bodies: RigidBody[] = [];
  const fixed = world.createRigidBody(R.RigidBodyDesc.fixed());
  bodies.push(fixed);

  const geo = buildRoadGeometry(track);
  world.createCollider(R.ColliderDesc.trimesh(geo.positions, geo.indices).setFriction(1.0).setRestitution(0), fixed);

  // Safety ground under the whole map
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  bodies.push(ground);
  world.createCollider(
    R.ColliderDesc.cuboid(4000, 1, 4000).setTranslation(0, TRACK_CFG.groundY - 1, 0).setFriction(0.5).setRestitution(0),
    ground,
  );

  // Guard barriers: solid cuboids (convex => no tunnelling), low friction so the car slides along them
  const walls = world.createRigidBody(R.RigidBodyDesc.fixed());
  bodies.push(walls);
  for (const s of buildBarrierSegments(track)) {
    world.createCollider(
      R.ColliderDesc.cuboid(s.hx, s.hy, s.hz)
        .setTranslation(s.cx, s.cy, s.cz)
        .setRotation({ x: s.qx, y: s.qy, z: s.qz, w: s.qw })
        .setFriction(0.05)
        .setRestitution(0.25),
      walls,
    );
  }
  return bodies;
}
