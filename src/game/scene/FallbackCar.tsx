import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAR } from '../constants';
import type { WheelFeed } from '../state/runtime';

const WHEELS: ReadonlyArray<readonly [number, number, boolean]> = [
  [-CAR.wheelX, -CAR.wheelZ, true], [CAR.wheelX, -CAR.wheelZ, true],
  [-CAR.wheelX, CAR.wheelZ, false], [CAR.wheelX, CAR.wheelZ, false],
];

interface Props {
  color: string;
  feed: WheelFeed;
  /** group that is hidden in cockpit view */
  bodyRef?: React.RefObject<THREE.Group | null>;
}

/** Primitive-built hatchback. Forward is -Z. Origin = chassis origin (physics body origin). */
export function FallbackCar({ color, feed, bodyRef }: Props) {
  const wheelGroups = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const wheelSpin = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const spinAngle = useRef(0);
  const tail = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, dt) => {
    spinAngle.current += (feed.speedMs / CAR.wheelRadius) * Math.min(dt, 0.05);
    for (let i = 0; i < 4; i++) {
      const g = wheelGroups.current[i];
      const s = wheelSpin.current[i];
      if (!g || !s) continue;
      g.position.y = CAR.hardPointY - feed.susp[i];
      if (WHEELS[i][2]) g.rotation.y = feed.steer; // +ve = left = +yaw
      s.rotation.x = -spinAngle.current;
    }
    if (tail.current) tail.current.emissiveIntensity = feed.brake ? 2.6 : 0.45;
  });

  return (
    <>
      <group ref={bodyRef}>
        {/* lower body */}
        <mesh position={[0, 0.02, 0]} castShadow>
          <boxGeometry args={[1.88, 0.56, 4.15]} />
          <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} />
        </mesh>
        {/* hood + trunk wedge */}
        <mesh position={[0, 0.34, -1.35]} rotation={[0.09, 0, 0]} castShadow>
          <boxGeometry args={[1.82, 0.1, 1.45]} />
          <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} />
        </mesh>
        <mesh position={[0, 0.36, 1.55]} castShadow>
          <boxGeometry args={[1.8, 0.1, 0.95]} />
          <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} />
        </mesh>
        {/* cabin */}
        <mesh position={[0, 0.62, 0.25]} castShadow>
          <boxGeometry args={[1.62, 0.46, 2.0]} />
          <meshStandardMaterial color="#10151f" metalness={0.9} roughness={0.12} />
        </mesh>
        <mesh position={[0, 0.88, 0.3]} castShadow>
          <boxGeometry args={[1.56, 0.07, 1.7]} />
          <meshStandardMaterial color={color} metalness={0.55} roughness={0.32} />
        </mesh>
        {/* spoiler */}
        <mesh position={[0, 0.78, 1.95]} castShadow>
          <boxGeometry args={[1.7, 0.06, 0.38]} />
          <meshStandardMaterial color="#14171d" roughness={0.5} />
        </mesh>
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 0.55, 1.92]}>
            <boxGeometry args={[0.06, 0.4, 0.1]} />
            <meshStandardMaterial color="#14171d" />
          </mesh>
        ))}
        {/* lights */}
        {[-0.65, 0.65].map((x) => (
          <mesh key={`h${x}`} position={[x, 0.2, -2.08]}>
            <boxGeometry args={[0.42, 0.14, 0.05]} />
            <meshStandardMaterial color="#fff7d6" emissive="#fff2b0" emissiveIntensity={1.6} />
          </mesh>
        ))}
        <mesh position={[0, 0.22, 2.08]}>
          <boxGeometry args={[1.6, 0.1, 0.05]} />
          <meshStandardMaterial ref={tail} color="#7a0d0d" emissive="#ff1a1a" emissiveIntensity={0.45} />
        </mesh>
      </group>
      {WHEELS.map(([x, z], i) => (
        <group key={i} ref={(el) => { wheelGroups.current[i] = el; }} position={[x, CAR.hardPointY - 0.3, z]}>
          <group ref={(el) => { wheelSpin.current[i] = el; }}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[CAR.wheelRadius, CAR.wheelRadius, CAR.wheelWidth, 20]} />
              <meshStandardMaterial color="#141414" roughness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]} position={[x < 0 ? -0.02 : 0.02, 0, 0]}>
              <cylinderGeometry args={[CAR.wheelRadius * 0.62, CAR.wheelRadius * 0.62, CAR.wheelWidth + 0.02, 10]} />
              <meshStandardMaterial color="#b9bec8" metalness={0.9} roughness={0.25} />
            </mesh>
          </group>
        </group>
      ))}
    </>
  );
}

