# Apex Ring – 3D arcade racing (React 19 + R3F + Rapier)

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc (zero errors) + vite build
npm run preview
npm test           # vitest (45 tests: steering, physics, camera, track, race, persistence)
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
