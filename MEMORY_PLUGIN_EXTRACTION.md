# Plugin Extraction Memory

## Purpose

- Dedicated context for identifying non-core Solitude code that should move into plugins.
- Use this before choosing the next extraction target.
- Keep this document current after each extraction decision so we do not repeat the same audit.

## Current Goal

- Move optional scenario, telemetry, or UX behavior out of core layers.
- Preserve the onion rule: inner layers (`domain`, `app`, `render`) must not import from `src/plugins`.
- Plugins remain the outermost composition layer for input, controls, loop policy, HUD, scene hooks, and segment overlays.

## Out Of Scope

- Debugging and profiling candidates are removed from the plugin-extraction list by decision.
- Reason: debug/profiling code needs to be intrusive to do its work effectively, without plugin restrictions.
- Debugging/profiling code still visible in core should be treated as a temporary measure for troubleshooting bugs and memory issues, not as plugin-extraction debt.

## Current Plugin Surface

Existing plugin types live in `src/app/pluginPorts.ts`:

- `input`: actions, key maps, and custom key handlers.
- `controls`: control-state updates, attitude commands, propulsion command resolution.
- `loop`: frame policy, loop init, loop update, post-frame cleanup.
- `hud`: HUD grid writers.
- `scene`: scene init/update hooks and per-view object filters.
- `segments`: world-space overlay segment providers.
- `worldModel`: pre-runtime contribution of celestial bodies, ships, render config, initial ship states, and the main ship ID.

Existing plugins already cover:

- Autopilot: `src/plugins/autopilot/`
- Axial views: `src/plugins/axialViews/`
- Memory telemetry: `src/plugins/memory/`
- Orbit telemetry: `src/plugins/orbitTelemetry/`
- Pause: `src/plugins/pause/`
- Playback/capture diagnostics: `src/plugins/playback/`
- Profiling toggle/HUD: `src/plugins/profiling/`
- Runtime telemetry: `src/plugins/runtimeTelemetry/`
- Ship telemetry: `src/plugins/shipTelemetry/`
- Time scale: `src/plugins/timeScale/`
- Trajectories: `src/plugins/trajectories/`
- Velocity segments: `src/plugins/velocitySegments/`
- Solar system world model: `src/plugins/solarSystem/`

## Completed Decisions

### Auxiliary PiP / Axial Views

Status: extraction implemented. First pass landed on 2026-04-18; leftover
frame-update helpers were moved into `src/plugins/axialViews/` on 2026-04-25.

What changed:

- Added a view descriptor/registry path.
- Kept the primary view as the built-in core view.
- Added `src/plugins/axialViews/` to register `top`, `rear`, `left`, and `right` PiP views.
- Moved auxiliary camera offsets out of `src/config/worldAndSceneConfig.ts` into the axial views plugin.
- Changed `src/infra/domBootstrap.ts` and `src/infra/domGameLoop.ts` to operate over registered view arrays instead of fixed per-view fields.
- Changed `src/infra/domBootstrap.ts` to create canvases for registered views on demand.
- Kept canvas element IDs owned by bootstrap instead of plugin view definitions.
- Removed hard-coded view canvases from `index.html`; it now only contains the canvas container.
- Removed top/left/right/rear camera fields from `WorldSetup`, `WorldAndScene`, `SceneState`, and `SceneControlState`.
- Moved top/left/right/rear frame-update strategies out of core camera helpers and into the axial views plugin.

Known remaining static pieces:

- `src/infra/domLayout.ts` still contains the generic primary/PiP layout policy.

### Runtime Telemetry FPS

Status: cleanup implemented on 2026-04-25.

What changed:

- Moved FPS averaging/storage out of `src/infra/domGameLoop.ts` and into `src/plugins/runtimeTelemetry/`.
- Removed `fps` from the generic `HudContext`; runtime telemetry now passes FPS through its own loop/HUD controller.
- Removed the now-unused `src/infra/fps.ts` helper and `src/app/RingBuffer.ts`.

### Trajectory Runtime Type

Status: cleanup implemented on 2026-04-25.

What changed:

- Moved the trajectory state type out of `src/app/runtimePorts.ts` into `src/plugins/trajectories/types.ts`.
- Core runtime ports now contain only tick/world-and-scene runtime contracts.

### Solar System World Model

Status: extraction implemented on 2026-04-25.

What changed:

- Added a world-model plugin hook for contributing celestial bodies, ships, initial ship states, and `mainShipId`.
- Moved solar-system data from `src/config/solarSystem.ts` to `src/plugins/solarSystem/`.
- Moved default `ship:main` and `ship:enemy` config and Earth-bound placement into the solar-system plugin.
- Removed the special `enemyShip` / `enemyShipId` runtime field; secondary ships live in `world.ships`.
- Core setup now requires plugin-contributed main ship config and initial state.

## Strongest Remaining Candidates

### 1. Orbit Readout Helpers In Domain

Status: medium-priority extraction/split candidate.

Why it is non-core:

- `src/domain/orbit.ts` is currently imported only by plugins.
- `OrbitReadout`, apsis timers, and circularization delta-v readout serve HUD/autopilot behavior more than core physics integration.
- Keeping telemetry readout in domain makes plugin-specific concepts look core.

Current touch points:

- `src/domain/orbit.ts`: `OrbitReadout`, `createOrbitReadout`, `computeShipOrbitReadoutInto`.
- `src/domain/orbit.ts`: `getDominantBody` and `getDominantBodyPrimary`.
- `src/plugins/orbitTelemetry/hud.ts`: consumes `computeShipOrbitReadoutInto`.
- `src/plugins/autopilot/logic.ts`: consumes `getDominantBody` and `getDominantBodyPrimary`.
- `src/plugins/autopilot/hud.ts`: consumes `getDominantBodyPrimary`.

Likely extraction shape:

- Split `src/domain/orbit.ts` into smaller pieces.
- Move HUD readout construction into `src/plugins/orbitTelemetry/`.
- Keep or relocate shared gravitational-primary math depending on desired ownership:
  - Keep a tiny domain helper if "dominant gravitational body" is considered domain vocabulary.
  - Or move it to plugin-local helpers if it remains used only by autopilot/telemetry plugins.

Watch-outs:

- The dominant-body helper is useful beyond HUD. Do not bury it too deeply if future app behavior will need it.
- Keep numerical/orbital math testable after the move.

## Smaller Candidate: Pilot Look / Camera Offset Controls

Status: possible, but not obviously worth extracting first.

Why it might be non-core:

- Arrow-key look and `U/J/I/K` camera offset are camera UX, not simulation physics.
- They live in base control actions and the base key map.

Current touch points:

- `src/app/controlPorts.ts`: `look*` and `cam*` base actions.
- `src/infra/domKeyboardInput.ts`: base key bindings.
- `src/app/controls.ts`: `updatePilotLook`.
- `src/app/cameras.ts`: `updatePilotCameraOffset`.
- `src/app/scene.ts`: calls both before updating cameras.

Why it may stay core:

- Pilot camera control is part of the primary playable experience.
- Extracting it before dynamic view/camera support may make the scene update path more awkward.

## Recommended Order

1. Orbit readout/domain split.
2. Pilot look / camera offset controls, only if the camera/view refactor makes it natural.

## Documentation Notes

- `MEMORY_CIRCLE_NOW.md` is stale after autopilot extraction:
  - It still points at `src/app/autoPilot.ts` and old wiring.
  - Actual code is now in `src/plugins/autopilot/`.
- Update `MEMORY_CIRCLE_NOW.md` before the next circle-now troubleshooting pass.

## Verification Notes

- This document was created from a read-only audit on 2026-04-18.
- No extraction has been performed yet.
- After future code changes, follow `MEMORY.md`: run `npm run typecheck` and `npm run test`.
