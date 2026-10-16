# Upgrade audit and implementation record

## Baseline — 15 October 2026

Clean Git working tree. React 19.3, Vite 8.3.4, TypeScript 6.0.3 (strict), Three 0.186.1, R3F 9.8.1, Drei 10.7.9, React Three Rapier 2.2.0. No external models/audio in public. Existing car is explicitly a primitive hatchback. Procedural track textures have no external licensing dependencies.

Executed baseline: 45/45 Vitest tests pass; TypeScript and production build pass. No lint script configured. Preserve the single 60 Hz Rapier world, raycast suspension, CCD, surface-dependent grip, gearbox, spline track/collider geometry, ordered checkpoints, minimap, six camera modes, touch/gamepad input, IndexedDB records and red/blue UI identity.

Gaps: no night mode, no tilt support, no collision feedback or tire effects; only two synthetic engine oscillators; no GLB assets. Quality change keys the Canvas and resets the world. Player controller has no unmount cleanup. Focus loss clears keys but does not pause. HUD labels handbrake as drift without measuring slip. AI is kinematic and does not yield physically. Cockpit is an illustrative overlay, not a modeled interior.

## Implementation sequence

1. Stabilize controller lifecycle, quality changes, focus handling and telemetry.
2. Integrate locally hosted licensed car geometry and suspension-driven wheels, retaining a failure fallback.
3. Add coherent day/night illumination, reflections and road lights.
4. Add contact-driven impact feedback and slip-driven tire feedback with bounded resources.
5. Extend persisted settings, sensor permission/calibration, HUD and audio events.
6. Execute unit and production browser checks; document assets, deployment and remaining limits.

World units remain metres / seconds / kilograms; +Y up, -Z forward, +X right. No additional physics engine or simulation loop.

## Implemented

- Retained and tested the raycast vehicle. Added a progressive engine-force limiter near 220 km/h, true velocity-magnitude speed telemetry and measured lateral slip. Existing suspension, braking/reverse, handbrake, surface grip, CCD and barrier response remain authoritative.
- Removed the quality-based Canvas key so quality changes preserve the current race. Added ownership-aware disposal of track bodies and player controllers. Browser testing exposed a StrictMode cleanup failure: old bodies were being removed through a proxy whose underlying world had already changed. Owner checks fixed the observed Rust aliasing error. Focus loss now pauses and clears all input; delayed finish transitions are canceled on unmount.
- Added Quaternius's locally hosted 175,100-byte CC0 Sports Car, separate paint/glass/trim/light materials, normalized geometry and four suspension-following wheel pivots. Kept the old car solely as the model-loading/failure fallback. Geometry is shared, per-car materials are cloned and disposed. See `public/models/ASSET-LICENSE.md`.
- Added persisted day/night modes: daylight sky, cool night sky/stars, environment reflections generated locally with PMREM, exposure/fog changes, emissive brake/taillights, two real player headlight spotlights and instanced circuit lamps. Medium/high use only the two nearest track lights. Added instanced curbs. Existing procedural asphalt/grass textures, track geometry and trees remain.
- Rapier contact-force events now produce thresholded, cooldown-limited sparks, impact sound and optional brief camera shake. A 96-particle pool emits tire smoke/dust only during measured slip or off-road driving. A 240-decal ring places skid marks at rear wheel contact points. No unbounded effects or extra physics world.
- Added checkpoint/off-track HUD text and actual-slip drift labels. Out-of-road/airborne projected checkpoint crossings are ignored. Kept the live minimap, local lap/race records and original menus.
- Centralized procedural audio graph: RPM/throttle engine, braking/tire slip noise, impact thump, countdown/start/checkpoint/lap/finish tones. Master and SFX gains, mute, gesture unlock before scene loading, pause silence and cleanup. No audio assets, music track, voice recordings or remote speech service.
- Added tilt permission request, screen-relative steering, neutral calibration, a 2-degree deadzone, sensitivity, existing steering smoothing and stale-sensor fallback. Touch remains available. Responsive landscape layout separates pedals, minimap and speedometer.

## Verification and limits

Baseline: 45 tests passed; final unit suite: 49 tests passed. The new tests cover sensor rotation/calibration/deadzone/expiry, impact threshold/cooldown, settings migration and sideways velocity telemetry. Existing tests exercise acceleration, reverse, drift, stability, a full pursuit lap, 150 km/h barrier collision, steering, camera, track, checkpoints and IndexedDB. No lint configuration exists.

Browser automation uses installed Playwright Chromium on Windows, serving a Vite production bundle from `dist-e2e`. That build alone enables read-only telemetry through `VITE_E2E=1`; ordinary `dist` does not expose it. Browser tests and screenshots are in `e2e/` and ignored `test-results/`. Physical mobile devices, real tilt sensors, Safari/Firefox and audible sound quality have not been verified. Synthetic tilt and permission-denial checks are not device certification.

Final browser suite: **4/4 passed** (about 2.1 minutes): production driving/barrier impact/recovery/camera movement/pause/settings/restart; mobile portrait menu and landscape touch acceleration/pause; blocked GLB fallback driving; simulated sensor permission denial. No page errors were observed in the driving, mobile or fallback tests. The ordinary production build also passed TypeScript/Vite, includes the GLB with its original SHA-256, and excludes the test telemetry hook. `git diff --check` passed (only the repository's LF/CRLF normalization warnings).

One observed stationary night sample at 960x600, medium quality, reported **51 draw calls and 69,708 rendered triangles**. This is a scene-counter observation, not a reliable FPS benchmark. Headless software rendering and browser automation are not representative of gaming hardware; no universal FPS claim is made.

Remaining limits, in priority order:

1. Art is intentionally stylized/low-poly. This is a coherent sports-car upgrade, not a photorealistic branded supercar or professional racing simulation. A higher-detail licensed car and authored environment are the largest future visual improvements.
2. AI retains its existing kinematic spline driving: collisions affect the player, but opponents do not yield dynamically. Saved races do not store opponent progress, so resumed race positions can differ.
3. Full race completion and best-record logic are unit-tested, not an end-to-end three-lap browser drive. Real phone tilt, audio quality, prolonged GPU memory use, context loss and broad browser/device performance still need hands-on QA.
4. The existing cockpit remains an illustrative overlay without a modeled interior. Skid decals assume locally modest road banking; impact sparks originate near the chassis rather than an exact manifold contact point. No deformable damage, weather, dynamic time transition, bloom, music or voice assets are included.
5. Multisample antialiasing is chosen when the WebGL context is created. Other quality settings update in place; a different antialiasing choice takes effect on the next scene mount. Headlights are unshadowed to keep their cost down, so nearby objects can leak light.

## Local and Vercel commands

```sh
npm ci
npm run dev
npm test
npx playwright install chromium
npm run test:browser
npm run build
npm run preview
```

Vercel: import this repository, use the Vite framework preset, build `npm run build`, output `dist`, install `npm ci`. `vercel.json` records the build/output configuration. Optional CLI deployment from this directory: `npx vercel --prod` (requires your Vercel account). No deployment was performed during this task. The hash router needs no server-side rewrite; local model URLs use Vite's base URL. No backend, environment secrets or runtime external API is needed.
