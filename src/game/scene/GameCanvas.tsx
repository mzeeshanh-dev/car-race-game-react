import { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { FIXED_DT } from '../constants';
import { QUALITY } from '../quality';
import { gridSlot } from '../race/ai';
import { rt } from '../state/runtime';
import { useApp } from '../state/store';
import { createLive } from '../state/telemetry';
import { useTelemetry } from '../state/telemetry';
import { buildTrack, trackYaw } from '../track/trackData';
import { AICars } from './AICars';
import { CameraRig } from './CameraRig';
import { EngineSound } from './EngineSound';
import { Lighting } from './Lighting';
import { PlayerCar } from './PlayerCar';
import { RaceController } from './RaceController';
import { TrackScene } from './TrackScene';

function World() {
  const track = useMemo(() => buildTrack(), []);
  const raceKey = useApp((s) => s.raceKey);
  const spawn = useMemo(() => {
    const g = gridSlot(3);
    const i = ((track.gates[0] - Math.round(g.back / track.step)) % track.count + track.count) % track.count;
    const lat = g.lateral;
    return {
      x: track.px[i] + track.rx[i] * lat, y: track.py[i] + 1.0, z: track.pz[i] + track.rz[i] * lat,
      yaw: trackYaw(track, i),
    };
  }, [track]);

  // fresh live telemetry + runtime for every race
  useMemo(() => {
    useTelemetry.setState({ live: createLive() });
    rt.sim = null; rt.car.valid = false; rt.hideBody = false; rt.respawnRequested = false;
  }, [raceKey]);

  return (
    <group key={raceKey}>
      <TrackScene track={track} />
      <PlayerCar track={track} spawn={spawn} />
      <AICars track={track} />
      <RaceController track={track} />
      <CameraRig track={track} />
      <EngineSound />
    </group>
  );
}

export function GameCanvas() {
  const quality = useApp((s) => s.settings.quality);
  const paused = useApp((s) => s.screen !== 'play');
  const q = QUALITY[quality];
  useEffect(() => () => { rt.sim = null; rt.car.valid = false; }, []);
  return (
    <Canvas
      key={quality}
      className="game-canvas"
      dpr={[1, Math.min(2, Math.max(1, q.dprMax))]}
      shadows={q.shadows ? 'percentage' : false}
      gl={{ antialias: q.antialias, powerPreference: 'high-performance' }}
      camera={{ fov: 60, near: 0.1, far: 4000, position: [0, 4, 10] }}
      onCreated={({ gl }) => {
        // let the browser restore a lost WebGL context instead of leaving a dead/blank canvas
        gl.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());
      }}
    >
      <Suspense fallback={null}>
        <Physics timeStep={FIXED_DT} interpolate updatePriority={-50} paused={paused} gravity={[0, -9.81, 0]} numSolverIterations={6}>
          <World />
        </Physics>
        <Lighting />
      </Suspense>
    </Canvas>
  );
}
