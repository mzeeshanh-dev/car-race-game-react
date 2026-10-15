import type { DynamicRayCastVehicleController, RigidBody, World } from '@dimforge/rapier3d-compat';
import { CAR, ROAD_HALF } from '../constants';
import { limitSteerByGrip, steerInputToWheelAngle } from '../input/steering';
import { createNearest, nearestOnTrack, type NearestResult, type TrackData } from '../track/trackData';
import { Gearbox, driveForce, rpmFromWheelSpeed } from './gearbox';
import { SURFACES, surfaceDrag, type Surface } from './surface';

export interface DriveInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. +1 (right), already smoothed
  handbrake: boolean;
}

export const TUNING = {
  aero: 0.42, // N per (m/s)²
  rolling: 0.012,
  downforce: 1.5, // N per (m/s)²
  brakeMax: 60, // per wheel (Rapier brake value = impulse per step)
  engineBrake: 3, // per wheel, when coasting
  parkBrake: 14,
  handBrake: 30,
  aLatBase: 12.5, // m/s² steering-assist lateral acceleration limit on asphalt
  rollRate: 9, // 1/s
  pitchRate: 6,
  tiltSpring: 14,
  handbrakeRearGrip: 0.32,
  handbrakeRearSide: 0.3,
} as const;

const WHEEL_X = CAR.wheelX;
const WHEEL_Z = CAR.wheelZ;
/** order: front-left, front-right, rear-left, rear-right (front = -Z) */
const WHEEL_POS: ReadonlyArray<readonly [number, number]> = [
  [-WHEEL_X, -WHEEL_Z], [WHEEL_X, -WHEEL_Z], [-WHEEL_X, WHEEL_Z], [WHEEL_X, WHEEL_Z],
];

export interface VehicleLive {
  speedMs: number; // signed forward speed (+ forward)
  speedKmh: number; // absolute
  rpm: number;
  gear: number; // 0 = R
  steerInput: number;
  wheelAngle: number; // rad, +ve = left
  throttle: number;
  brake: number;
  handbrake: boolean;
  grassCoverage: number;
  grounded: number;
  upY: number;
  yawRate: number;
  lateral: number; // metres from centre line (+right)
  onRoad: boolean;
}

export function createVehicleLive(): VehicleLive {
  return {
    speedMs: 0, speedKmh: 0, rpm: 900, gear: 1, steerInput: 0, wheelAngle: 0, throttle: 0, brake: 0,
    handbrake: false, grassCoverage: 0, grounded: 4, upY: 1, yawRate: 0, lateral: 0, onRoad: true,
  };
}

export class VehicleSim {
  readonly controller: DynamicRayCastVehicleController;
  readonly gearbox = new Gearbox();
  readonly live: VehicleLive = createVehicleLive();
  readonly wheelSusp = [0.3, 0.3, 0.3, 0.3];
  readonly wheelSpin = [0, 0, 0, 0];
  sensitivity = 1;
  private readonly near: NearestResult[] = [createNearest(), createNearest(), createNearest(), createNearest()];
  private readonly hints = [-1, -1, -1, -1];
  private readonly bodyNear = createNearest();
  private bodyHint = -1;

  constructor(world: World, readonly body: RigidBody, private readonly track: TrackData | null) {
    body.setAdditionalMassProperties(
      CAR.mass,
      CAR.centerOfMass,
      CAR.inertia,
      { x: 0, y: 0, z: 0, w: 1 },
      true,
    );
    body.setLinearDamping(0.02);
    body.setAngularDamping(0.35);
    body.enableCcd(true);

    const c = world.createVehicleController(body);
    c.indexUpAxis = 1;
    c.setIndexForwardAxis = 2;
    for (const [x, z] of WHEEL_POS) {
      c.addWheel({ x, y: CAR.hardPointY, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, CAR.suspensionRest, CAR.wheelRadius);
    }
    for (let i = 0; i < 4; i++) {
      c.setWheelSuspensionStiffness(i, CAR.suspensionStiffness);
      c.setWheelSuspensionCompression(i, CAR.suspensionCompression);
      c.setWheelSuspensionRelaxation(i, CAR.suspensionRelaxation);
      c.setWheelMaxSuspensionTravel(i, CAR.suspensionTravel);
      c.setWheelMaxSuspensionForce(i, CAR.maxSuspensionForce);
      c.setWheelFrictionSlip(i, CAR.baseFrictionSlip);
      c.setWheelSideFrictionStiffness(i, CAR.baseSideStiffness);
    }
    this.controller = c;
  }

  /** Teleport and zero all motion. yaw: +CCW from above. */
  respawn(x: number, y: number, z: number, yaw: number): void {
    const b = this.body;
    b.setTranslation({ x, y, z }, true);
    b.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.gearbox.reset();
    this.hints.fill(-1);
    this.bodyHint = -1;
  }

  /** Call once per fixed physics step, BEFORE world.step(). */
  step(dt: number, input: DriveInput): void {
    const body = this.body;
    const lv = body.linvel();
    const av = body.angvel();
    const q = body.rotation();
    const p = body.translation();
    const L = this.live;

    // chassis axes from quaternion (forward = -Z local)
    const { x: qx, y: qy, z: qz, w: qw } = q;
    const fx = -(2 * (qx * qz + qw * qy));
    const fy = -(2 * (qy * qz - qw * qx));
    const fz = -(1 - 2 * (qx * qx + qy * qy));
    const rx = 1 - 2 * (qy * qy + qz * qz);
    const ry = 2 * (qx * qy + qw * qz);
    const rz = 2 * (qx * qz - qw * qy);
    const ux = 2 * (qx * qy - qw * qz);
    const uy = 1 - 2 * (qx * qx + qz * qz);
    const uz = 2 * (qy * qz + qw * qx);

    const vF = lv.x * fx + lv.y * fy + lv.z * fz;
    const speedAbs = Math.abs(vF);
    const speedKmh = speedAbs * 3.6;

    // ---- surface per wheel -------------------------------------------------------------
    let grassWheels = 0;
    let grounded = 0;
    const c = this.controller;
    const surf: Surface[] = SURF_SCRATCH;
    for (let i = 0; i < 4; i++) {
      const [wx, wz] = WHEEL_POS[i];
      const inContact = c.wheelIsInContact(i);
      if (inContact) grounded++;
      let s: Surface = 'asphalt';
      if (this.track && inContact) {
        const gx = p.x + rx * wx - fx * wz; // right*wx + back*wz  (back = -forward)
        const gz = p.z + rz * wx - fz * wz;
        const n = nearestOnTrack(this.track, gx, gz, this.hints[i], this.near[i], 30);
        this.hints[i] = n.index;
        if (Math.abs(n.lateral) > ROAD_HALF) s = 'grass';
      }
      surf[i] = s;
      if (s === 'grass') grassWheels++;
    }
    const grassCoverage = grassWheels / 4;

    // ---- driver intent -----------------------------------------------------------------
    const throttleIn = input.throttle;
    const brakeIn = input.brake;
    const reversing = brakeIn > 0.05 && throttleIn < 0.05 && vF < 1.5;
    let brakeCmd = 0;
    let driveCmd = 0;
    let reverseCmd = 0;
    if (reversing) reverseCmd = brakeIn;
    else {
      if (brakeIn > 0.05) brakeCmd = Math.max(brakeCmd, brakeIn);
      if (throttleIn > 0.05) {
        if (vF < -1.5) brakeCmd = Math.max(brakeCmd, throttleIn);
        else driveCmd = throttleIn;
      }
    }
    this.gearbox.update(vF, driveCmd + reverseCmd, reversing && reverseCmd > 0, dt, CAR.wheelRadius);

    // ---- engine force (rear wheel drive) -----------------------------------------------
    let engine = 0; // +ve = pushes forward
    if (driveCmd > 0) {
      const rpm = Math.max(this.gearbox.rpm, rpmFromWheelSpeed(vF, this.gearbox.gear, CAR.wheelRadius));
      engine = driveForce(rpm, this.gearbox.gear, driveCmd, CAR.wheelRadius);
    } else if (reverseCmd > 0 && vF > -9) {
      engine = -driveForce(4000, 0, reverseCmd, CAR.wheelRadius) * 0.35;
    }
    let power = 1;
    for (let i = 2; i < 4; i++) power = Math.min(power, SURFACES[surf[i]].power);
    engine *= power;
    // Rapier's forward axis is +Z, ours is -Z -> engine force sign is inverted.
    const perRearWheel = -engine / 2;

    // ---- braking -------------------------------------------------------------------------
    let brakePerWheel = brakeCmd * TUNING.brakeMax;
    const coasting = driveCmd === 0 && reverseCmd === 0 && brakeCmd === 0;
    if (coasting) brakePerWheel = speedAbs < 2 ? TUNING.parkBrake : TUNING.engineBrake;
    const hb = input.handbrake;

    // ---- steering ------------------------------------------------------------------------
    let wheelAngle = steerInputToWheelAngle(input.steer, speedKmh, this.sensitivity);
    let grip = 0;
    for (let i = 0; i < 4; i++) grip += SURFACES[surf[i]].friction;
    grip /= 4;
    const aLat = TUNING.aLatBase * grip * (hb ? 2.2 : 1) + 0.0 * speedAbs;
    wheelAngle = limitSteerByGrip(wheelAngle, speedAbs, aLat);

    for (let i = 0; i < 4; i++) {
      const rear = i >= 2;
      const sf = SURFACES[surf[i]].friction;
      let slip = CAR.baseFrictionSlip * sf;
      let side = CAR.baseSideStiffness * (0.35 + 0.65 * sf);
      let br = brakePerWheel;
      if (rear && hb) {
        slip *= TUNING.handbrakeRearGrip;
        side *= TUNING.handbrakeRearSide;
        br = Math.max(br, TUNING.handBrake);
      }
      c.setWheelFrictionSlip(i, slip);
      c.setWheelSideFrictionStiffness(i, side);
      c.setWheelBrake(i, br);
      c.setWheelEngineForce(i, rear ? perRearWheel : 0);
      c.setWheelSteering(i, rear ? 0 : wheelAngle);
    }

    c.updateVehicle(dt);

    // updateVehicle changed the chassis velocities (suspension / friction impulses): re-read them
    const lv2 = body.linvel();
    const av2 = body.angvel();

    // ---- extra forces (impulses so they do not persist) ------------------------------
    const v = Math.hypot(lv2.x, lv2.y, lv2.z);
    if (v > 0.01) {
      const dragF = TUNING.aero * v * v + TUNING.rolling * CAR.mass * 9.81;
      const sd = surfaceDrag('grass', v, grassCoverage) * CAR.mass;
      const k = ((dragF + sd) * dt) / (v * CAR.mass);
      body.applyImpulse({ x: -lv2.x * k * CAR.mass, y: 0, z: -lv2.z * k * CAR.mass }, true);
    }
    const down = TUNING.downforce * speedAbs * speedAbs * dt;
    body.applyImpulse({ x: 0, y: -down, z: 0 }, true);

    // ---- stabiliser: damp roll/pitch rates + restoring tilt spring ---------------------
    const wf = av2.x * fx + av2.y * fy + av2.z * fz;
    const wr = av2.x * rx + av2.y * ry + av2.z * rz;
    const kR = Math.min(1, TUNING.rollRate * dt);
    const kP = Math.min(1, TUNING.pitchRate * dt);
    let nx = av2.x - fx * wf * kR - rx * wr * kP;
    const ny = av2.y - fy * wf * kR - ry * wr * kP;
    let nz = av2.z - fz * wf * kR - rz * wr * kP;
    // tilt axis = up x worldUp = (-uz, 0, ux)
    const ts = TUNING.tiltSpring * dt * Math.max(0, uy + 0.2);
    nx += -uz * ts;
    nz += ux * ts;
    body.setAngvel({ x: nx, y: ny, z: nz }, true);

    // ---- publish telemetry -------------------------------------------------------------
    L.speedMs = vF;
    L.speedKmh = speedKmh;
    L.rpm = this.gearbox.rpm;
    L.gear = this.gearbox.gear;
    L.steerInput = input.steer;
    L.wheelAngle = wheelAngle;
    L.throttle = throttleIn;
    L.brake = brakeIn;
    L.handbrake = hb;
    L.grassCoverage = grassCoverage;
    L.grounded = grounded;
    L.upY = uy;
    L.yawRate = av2.y;
    if (this.track) {
      const bn = nearestOnTrack(this.track, p.x, p.z, this.bodyHint, this.bodyNear, 40);
      this.bodyHint = bn.index;
      L.lateral = bn.lateral;
      L.onRoad = Math.abs(bn.lateral) <= ROAD_HALF;
    }
    for (let i = 0; i < 4; i++) {
      const sl = c.wheelSuspensionLength(i);
      this.wheelSusp[i] = sl === null ? CAR.suspensionRest : sl;
      const r = c.wheelRotation(i);
      this.wheelSpin[i] = r === null ? 0 : r;
    }
  }
}

const SURF_SCRATCH: Surface[] = ['asphalt', 'asphalt', 'asphalt', 'asphalt'];
