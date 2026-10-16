import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { rt } from '../state/runtime';
import { effects } from '../state/effects';
import { live } from '../state/telemetry';
import { useApp } from '../state/store';

/** Read-only browser-test instrumentation, excluded from ordinary production builds. */
export function Diagnostics() {
  const { scene, gl, camera } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV && import.meta.env.VITE_E2E !== '1') return;
    const host = window as unknown as { apexSnapshot?: () => unknown };
    host.apexSnapshot = () => ({
      car: { ...rt.car }, vehicle: { ...live().vehicle }, race: { ...live().race }, impact: effects.serial,
      screen: useApp.getState().screen, settings: useApp.getState().settings,
      models: scene.getObjectsByProperty('name', 'sports-car-body').length,
      camera: camera.position.toArray(), calls: gl.info.render.calls, triangles: gl.info.render.triangles,
    });
    return () => { delete host.apexSnapshot; };
  }, [scene, gl, camera]);
  return null;
}
