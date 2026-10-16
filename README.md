# Apex Ring – 3D arcade racing (React 19 + R3F + Rapier)

Includes a locally hosted CC0 sports car, day/night racing with working headlights, contact-driven impact feedback, slip-driven tire effects, and calibrated tilt steering. Existing raycast vehicle physics, track, minimap, race records and UI are preserved.

See [upgrade audit, test results and technical handoff](docs/UPGRADE.md) and [asset source/license](public/models/ASSET-LICENSE.md). The car/environment are stylized; physical-device tilt and broad performance testing remain outstanding.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc (zero errors) + vite build
npm run preview
npm test           # 49 Vitest tests
npx playwright install chromium
npm run test:browser # production-bundle browser checks (dist-e2e)
```

## Controls
| Key | Action |
|---|---|
| W / ↑, S / ↓ | gas, brake (reverse only when almost stopped) |
| A / ←, D / → | steer (A = left, D = right) |
| Space | handbrake / drift |
| C, 1-6 | cycle / pick camera (Chase near, Chase far, Hood, Cockpit, Bumper, TV) |
| B (hold) | look back |
| R | respawn at last checkpoint |
| Esc | pause |
| M | mute |

Gamepad (left stick, RT/LT, A = handbrake, Y = camera, Back = respawn, Start = pause) and on-screen touch controls are supported.

## World convention (single source of truth, `src/game/constants.ts`)
-Z forward, +Y up, +X right (right-handed). Yaw is CCW seen from above, so **positive yaw = turning left**.
Steer input -1 (left) -> front wheel angle δ > 0 -> positive yaw rate. Verified both with the bicycle-model formula and inside the real Rapier simulation (`src/test/steering.test.ts`).

## Structure
```
src/game/vehicle   VehicleSim (Rapier DynamicRayCastVehicleController, gearbox, surfaces, stabiliser)
src/game/track     closed Catmull-Rom spline, road geometry (mesh + trimesh from the SAME arrays), barriers, nearest-point queries
src/game/camera    CameraController (position+yaw only, up=(0,1,0), lookAt, damped), 6 modes
src/game/input     keyboard / gamepad / touch, steering curve, smoothing, deadzone
src/game/race      checkpoint tracker, lap timer, AI planner
src/game/state     zustand app store, transient telemetry store, HUD bus
src/game/scene     R3F components (Canvas, track, cars, rig, lighting, race controller)
src/ui/hud         speedometer, minimap, top bar, countdown, toasts, touch controls (updated by rAF, not React)
src/ui/menus       main menu, pause, settings, finish
src/persistence    idb (settings, camera, car colour, best laps, race snapshot)
```
