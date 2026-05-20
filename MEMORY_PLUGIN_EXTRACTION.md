# Plugin Extraction Memory

## Purpose

- Dedicated context for identifying non-core Solitude code that should move into plugins.
- Use this before choosing the next extraction target.
- Keep this document current after each extraction decision so we do not repeat the same audit.

## Current Goal

- Move optional scenario, telemetry, or UX behavior out of core layers.
- Preserve the package boundary: `@solitude/engine` and `@solitude/browser` must not import Solitude plugins.
- Plugins remain the outermost composition layer for input, controls, loop policy, HUD overlay/readout behavior, scene hooks, and segment overlays.

## Package Split Impact

- Generic headless loop composition no longer imports or installs Solitude plugins by default.
- Package placement and exports enforce the core/browser boundary; do not add imports from `@solitude/engine` or `@solitude/browser` into `packages/solitude/src/plugins`.
- This reinforces the extraction boundary: product/scenario plugins remain caller-composed outer-layer behavior, even in headless tests.
- No plugin folders moved yet; physical package relocation is still future work.

## Out Of Scope

- Debugging and profiling candidates are removed from the plugin-extraction list by decision.
- Reason: debug/profiling code needs to be intrusive to do its work effectively, without plugin restrictions.
- Debugging/profiling code still visible in core should be treated as a temporary measure for troubleshooting bugs and memory issues, not as plugin-extraction debt.

## Current Plugin Surface

Generic plugin types live in `packages/engine/src/app/pluginPorts.ts`:

- `input`: actions, key maps, and custom key handlers.
- `controls`: control-state updates, attitude commands, propulsion command resolution.
- `loop`: frame policy, loop init, loop update, post-frame cleanup.
- `scene`: scene init/update hooks and per-view object filters.
- `segments`: world-space overlay segment providers.
- `views`: main-view camera rigs and optional view registration.
- `worldModel`: pre-runtime contribution of generic entities and main focus identity.

HUD is now Solitude-owned:

- `packages/solitude/src/plugins/hud/` owns the fixed HUD grid, panel capability protocol, update cadence, and browser overlay rendering.
- Telemetry/readout plugins publish `solitude.hud.panel.v1` capability providers instead of using an engine `HudPlugin` slot.
- Browser exposes a generic `solitude.browser.overlay.v1` capability host; it does not know the Solitude HUD grid.
- `@solitude/engine` no longer exports `HudGrid`, `HudContext`, `HudPlugin`, `DefaultHudRenderer`, or a rasterizer HUD draw pass.

Existing plugins already cover:

- Autopilot: `packages/solitude/src/plugins/autopilot/`
- Axial views: `packages/solitude/src/plugins/axialViews/`
- HUD shell/overlay: `packages/solitude/src/plugins/hud/`
- Main-view lookaround controls: `packages/solitude/src/plugins/mainViewLookaround/`
- Memory telemetry: `packages/solitude/src/plugins/memory/`
- Orbit telemetry: `packages/solitude/src/plugins/orbitTelemetry/`
- Pause: `packages/solitude/src/plugins/pause/`
- Playback/capture diagnostics: `packages/solitude/src/plugins/playback/`
- Profiling toggle/HUD: `packages/solitude/src/plugins/profiling/`
- Runtime telemetry: `packages/solitude/src/plugins/runtimeTelemetry/`
- Ship telemetry: `packages/solitude/src/plugins/shipTelemetry/`
- Time scale: `packages/solitude/src/plugins/timeScale/`
- Trajectories: `packages/solitude/src/plugins/trajectories/`
- Velocity segments: `packages/solitude/src/plugins/velocitySegments/`
- Solar system world model: `packages/solitude/src/plugins/solarSystem/`

## Completed Decisions

### HUD Shell / Overlay

Status: extraction implemented on 2026-05-10.

What changed:

- Added a Solitude-owned `hud` plugin.
- Added `solitude.hud.panel.v1` providers for readout plugins.
- Moved the fixed HUD grid and panel context out of engine and into `packages/solitude/src/plugins/hud/`.
- Removed the engine `GamePlugin.hud` slot and the engine `HudGrid`/`HudContext`/`HudPlugin` types.
- Removed `DefaultHudRenderer` and the engine rasterizer HUD pass.
- Added a browser generic overlay capability host used by the Solitude HUD plugin.
- Renamed frame policy `advanceHud` to `advanceOverlay`.

Known remaining static pieces:

- `packages/browser/src/infra/domLayout.ts` still has a fixed `avoidHud`/HUD top inset for PiP layout.
- Canvas HUD text drawing lives in `packages/browser/src/rasterize/canvas/CanvasHudRasterizer.ts`; this is browser adapter code, but the visual grid contract is Solitude-owned.

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

- Moved FPS averaging/storage out of the browser game loop and into `packages/solitude/src/plugins/runtimeTelemetry/`.
- Runtime telemetry now passes FPS through its own loop/HUD panel controller.
- Removed the now-unused FPS helper and ring buffer.

### Trajectory Runtime Type

Status: cleanup implemented on 2026-04-25.

What changed:

- Moved the trajectory state type out of `src/app/runtimePorts.ts` into `src/plugins/trajectories/types.ts`.
- Core runtime ports now contain only tick/world-and-scene runtime contracts.

### Solar System World Model

Status: extraction implemented on 2026-04-25.

What changed:

- Added a world-model plugin hook for contributing celestial bodies, ships, initial ship states, and `mainShipId`.
- Moved solar-system data, colors, and mesh assets from `src/config/` to `src/plugins/solarSystem/`.
- Moved default `ship:main` and `ship:enemy` config and Earth-bound placement into the solar-system plugin.
- Removed the special `enemyShip` / `enemyShipId` runtime field; secondary ships live in `world.ships`.
- Core setup now requires plugin-contributed main ship config and initial state.

## Strongest Remaining Candidates

### 1. Orbit Readout Helpers In Domain

Status: medium-priority extraction/split candidate.

Why it is non-core:

- `packages/engine/src/domain/orbit.ts` is currently imported only by plugins.
- `OrbitReadout`, apsis timers, and circularization delta-v readout serve HUD/autopilot behavior more than core physics integration.
- Keeping telemetry readout in domain makes plugin-specific concepts look core.

Current touch points:

- `packages/engine/src/domain/orbit.ts`: `OrbitReadout`, `createOrbitReadout`, `computeOrbitReadoutInto`.
- `packages/engine/src/domain/orbit.ts`: `getDominantBody` and `getDominantBodyPrimary`.
- `packages/solitude/src/plugins/orbitTelemetry/hud.ts`: consumes `computeOrbitReadoutInto`.
- `packages/solitude/src/plugins/autopilot/logic.ts`: consumes `getDominantBody` and `getDominantBodyPrimary`.
- `packages/solitude/src/plugins/autopilot/hud.ts`: consumes `getDominantBodyPrimary`.

Likely extraction shape:

- Split `packages/engine/src/domain/orbit.ts` into smaller pieces.
- Keep HUD readout construction in `packages/solitude/src/plugins/orbitTelemetry/`.
- Keep or relocate shared gravitational-primary math depending on desired ownership:
  - Keep a tiny domain helper if "dominant gravitational body" is considered domain vocabulary.
  - Or move it to plugin-local helpers if it remains used only by autopilot/telemetry plugins.

Watch-outs:

- The dominant-body helper is useful beyond HUD. Do not bury it too deeply if future app behavior will need it.
- Keep numerical/orbital math testable after the move.

## Completed Decision: Main-View Lookaround / Camera Offset Controls

Status: extraction implemented on 2026-05-20.

Why it might be non-core:

- Arrow-key look and `U/J/I/K` camera offset are camera UX, not simulation physics.
- They used to live in base control actions and the base key map.

What changed:

- Added `packages/solitude/src/plugins/mainViewLookaround/`.
- Moved `look*` and `cam*` actions plus arrow/`U/J/I/K/R` bindings into the plugin.
- Moved main-view look and camera-offset integration into the plugin through `GamePlugin.viewControls`.
- Removed product default actions/key bindings from browser/engine input.
- Renamed the remaining engine scene update export to `updateSceneViewCameras`; it now only refreshes generic camera poses/frames.

Known remaining static pieces:

- `SceneControlState.mainViewLookState` and render config `mainViewLookState` remain engine-owned because camera rigs consume generic look state.
- `WorldRenderConfig.mainViewCameraOffset` remains engine-owned initial primary-view camera configuration.

## Recommended Order

1. Orbit readout/domain split.

## Documentation Notes

- `MEMORY_CIRCLE_NOW.md` is stale after autopilot extraction:
  - It still points at `src/app/autoPilot.ts` and old wiring.
  - Actual code is now in `src/plugins/autopilot/`.
- Update `MEMORY_CIRCLE_NOW.md` before the next circle-now troubleshooting pass.

## Verification Notes

- This document was created from a read-only audit on 2026-04-18.
- Main-view lookaround extraction was implemented on 2026-05-20.
- After future code changes, follow `MEMORY.md`: run `npm run typecheck` and `npm run test`.
