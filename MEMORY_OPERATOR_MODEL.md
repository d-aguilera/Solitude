# Operator Model Memory

## Purpose

- Dedicated context for generalizing Solitude's main interactive subject.
- Use this before work that changes the main controlled body, primary view, input ownership, spacecraft controls, camera rigs, HUD contexts, telemetry, autopilot, playback, or simulation plugin phases.
- Goal: make the main ship plugin-owned behavior rather than a core assumption, while preserving a fast generic core runtime.

## How To Use This Doc

- Start from **Current Slice**. Treat everything else as background unless the slice points at it.
- Keep each code change narrow enough to finish with typecheck/test in one Codex session.
- When a slice completes, update **Completed Slices**, choose the next slice, and refresh **Current Slice**.
- When a topic is too large to solve inline, add or update a small subplan under **Subplans** instead of expanding the main roadmap.
- Prefer adapter/bridge steps over rewrites. The plan should survive many small commits.

## Current Slice

Status: not started.

Next focused change:

- Continue shrinking transitional spacecraft/control compatibility surfaces:
  - remove or rename `src/app/controls.ts` compatibility re-export if no production imports remain;
  - audit `ControlPlugin` naming and params for spacecraft-specific assumptions;
  - decide whether autopilot should depend on `spacecraftOperator` capability names or stay on shared control ports for one more slice.

Success criteria:

- Tick ordering remains covered by tests.
- Manual controls, autopilot, playback, and HUD control readouts remain behavior-compatible.
- Runtime/headless setup still installs the current spacecraft behavior by default.
- No new plugin-to-core layering violations.
- Transitional aliases are reduced only where imports prove safe.
- Typecheck and tests pass.

## Completed Slices

- 2026-04-29: Audited `pilot`, `ship`, `mainControlledBody`, and spacecraft-control references. See **Audit: Operator Terminology Hotspots**.
- 2026-04-29: Added a `FocusContext` runtime bridge as `mainFocus` on `WorldSetup`, `WorldAndScene`, plugin params, and render params, while keeping `mainControlledBody` aliases intact.
- 2026-04-29: Renamed primary-view app/config plumbing to `mainView*` names. Kept deprecated `pilot*` aliases and render-config fallback helpers for compatibility.
- 2026-04-29: Migrated easy generic focus consumers to `mainFocus`: render label anchor, velocity segments, and orbit telemetry. Added generic `computeOrbitReadoutInto` with `computeShipOrbitReadoutInto` retained as compatibility wrapper.
- 2026-04-29: Added `mainFocus` to `ViewFrameUpdateParams` and migrated primary/axial camera frame callbacks to read the focused body's frame through `mainFocus`, with `mainControlledBody` kept as a compatibility alias.
- 2026-04-29: Added an explicit no-op simulation phase API skeleton with hooks around vehicle dynamics, gravity, collisions, and spin. Wired DOM/headless collection and added an order test while preserving existing spacecraft behavior.
- 2026-04-29: Isolated the existing thrust/RCS/attitude vehicle-dynamics block into `src/app/spacecraftVehicleDynamics.ts`, preserving current direct invocation and control-plugin behavior. Later moved it under `src/plugins/spacecraftOperator/`.
- 2026-04-29: Routed spacecraft vehicle dynamics through `SimulationPlugin.updateVehicleDynamics` with the current spacecraft adapter auto-installed inside `createTickHandler`; phase params now carry mutable tick output.
- 2026-04-29: Moved default spacecraft vehicle-dynamics registration out of `createTickHandler`; DOM/headless setup now installs the spacecraft simulation adapter and passes the full simulation plugin list into core.
- 2026-04-29: Made spacecraft dynamics a named `spacecraftOperator` plugin contribution. Browser defaults include it in `defaultPluginIds`; headless installs the same plugin explicitly by default.
- 2026-04-29: Moved spacecraft-specific action names and key bindings out of base input and into `spacecraftOperator.input`; base actions now cover generic/main-view look and camera offset controls.
- 2026-04-29: Moved spacecraft thrust/RCS/attitude command interpretation out of `src/app/controls.ts` and into `src/plugins/spacecraftOperator/controlLogic.ts`. `src/app/mainViewControls.ts` now owns main-view look logic; `src/app/controls.ts` is only a temporary main-view compatibility re-export.

## Decision Log

- 2026-04-27: Chose "operator model" as the initiative name because the target is broader than a main-ship plugin. The future unit of switching is likely an operator mode: focus, camera, controls, HUD emphasis, and control system together.
- 2026-04-27: Main view should remain core-owned. Plugins should contribute camera rigs or operator modes for that view, not own the primary view/canvas itself.
- 2026-04-27: Do not reduce core to only the gravity engine. Core should still own generic world/runtime orchestration, focus selection, main view plumbing, and deterministic simulation phases.

## Open Subplans

- Capability queries and plugin requirements.
- Plugin interdependency / compatibility policy.
- Simulation phase API.
- Active input contexts and key collision policy.
- Main-view camera rig registration.
- Playback schema migration.

## Current Direction

- The entity model generalization is the foundation: core world state is now largely generic entities and capability arrays.
- The next strategic step is to separate "the user is flying a ship" from core runtime architecture.
- Core should own generic focus, main view plumbing, render/simulation orchestration, and deterministic phase ordering.
- Plugins should define what it means to operate a focused entity: spacecraft controls, propulsion, RCS, attitude, camera rigs, HUD/readout assumptions, autopilot behavior, and future operator modes.

## Core Idea

The main ship should become a plugin contribution, but the replacement core concept should not be another hidden ship-shaped special case.

Prefer:

- `mainFocusEntityId` or equivalent generic focus identity.
- Capability queries around that focus entity.
- Plugin-owned operator behavior attached to the focus.

Avoid:

- Core requiring thrust, RCS, angular velocity, cockpit/front direction, orbit telemetry, or autopilot compatibility for every focused entity.
- Moving all existing ship assumptions into a single new "main ship plugin" without exposing the underlying boundaries.

## Target Model

Core owns:

- Generic world entity/capability storage.
- Gravity stepping.
- Generic collision resolution.
- Axial spin resolution.
- Scene/render assembly from renderable/light capabilities.
- Main view layout and renderer plumbing.
- Active focus / operator-mode selection.
- Plugin lifecycle and deterministic simulation phase ordering.

Plugins own or contribute:

- Focusable entities and their capabilities.
- Spacecraft-specific entity definitions, meshes, masses, collision spheres, and initial state.
- Input actions and key maps for a given operator mode.
- Control systems, including thrust, RCS, attitude, and future vehicle dynamics.
- Main-view camera rigs, such as forward vehicle camera, chase camera, free camera, orbital/map camera, or body-fixed camera.
- HUD and telemetry assumptions.
- Autopilot behavior for compatible focus capabilities.

## Main View Direction

- Rename/reframe "pilot view" concepts to "main view" where they are generic camera/view concerns.
- The main view should remain core-owned as the primary canvas/layout/render target.
- Plugins should register camera rigs or main-view modes, not own the primary view itself.
- Future `F1`, `F2`, etc. switching should likely switch an active operator mode, not only a camera:
  - focus entity
  - camera rig
  - input context
  - control system
  - HUD emphasis

## Simulation Phase Direction

Moving ship physics into plugins requires explicit phase ordering.

Likely phases:

1. control state update / input interpretation
2. pre-physics plugin update
3. plugin force or velocity-delta application
4. gravity step
5. collision resolution
6. post-physics plugin update
7. scene/camera/HUD update

Keep the implementation simple and allocation-conscious. Prefer arrays of phase callbacks over a dynamic event bus in hot paths.

## Input Ownership Direction

- Core should not permanently own spacecraft-specific actions such as roll, pitch, yaw, burn, RCS, and thrust levels.
- Core may own only universal actions, such as operator-mode switching or global runtime controls, if they remain universal.
- Active operator modes should determine their input actions and bindings.
- Key collisions between active plugins need an explicit policy before multiple operator modes can coexist.

## Subplans

### Audit: Operator Terminology Hotspots

Date: 2026-04-29.

Classification:

- Generic focus/main-view concepts:
  - `src/setup/setup.ts`: `mainControlledEntityId` validation and lookup is already close to the target focus identity, but the returned runtime object is still named `mainControlledBody`.
  - `src/app/runtimePorts.ts`: `WorldAndScene.mainControlledBody` is the central runtime bridge that should gain a generic focused-entity alias first.
  - `src/app/pluginPorts.ts`: HUD, segment, scene, loop, and render-related params pass `mainControlledBody`; these are mixed generic focus consumers and spacecraft-specific consumers, so migrate additively.
  - `src/infra/domGameLoop.ts`: assembles and repeatedly passes `mainControlledBody`; this is the main fan-out point and should be changed through aliases before downstream renames.
  - `src/render/renderPorts.ts` and `src/render/DefaultViewRenderer.ts`: `mainControlledBody` is only used as a label distance anchor. This is generic focus-position behavior and should become focus/anchor terminology.
  - `src/app/cameras.ts`, `src/app/scene.ts`, `src/app/viewPorts.ts`, `src/app/scenePorts.ts`, `src/app/renderConfigPorts.ts`, `src/config/worldAndSceneConfig.ts`: `pilot` mostly means primary/main-view look state or camera offset. Rename these after the focus bridge, with compatibility aliases where config churn would be high.
  - `src/infra/domLayout.ts`: local `pilotWidth` / `pilotHeight` are layout-only and can be renamed to primary/main view at any time.

- Spacecraft/operator-plugin concepts:
  - `src/app/controlPorts.ts`, `src/app/controls.ts`, `src/app/game.ts`, `src/app/physics.ts`: thrust, RCS, roll/pitch/yaw attitude, angular velocity smoothing, and controlled-body rotation are spacecraft/operator behavior. Do not rename these as generic focus behavior; extract them after simulation phases exist.
  - `src/infra/domKeyboardInput.ts`: base key map currently owns spacecraft actions and camera-offset controls. Split global/main-view actions from operator actions later under the input-context subplan.
  - `src/plugins/autopilot/*`: autopilot requires spacecraft motion, frame/attitude, propulsion, and orbit assumptions. It should later declare/query compatible focus capabilities.
  - `src/plugins/shipTelemetry/hud.ts`: explicitly spacecraft-control readout; keep ship/operator terminology until a spacecraft telemetry plugin boundary is clearer.
  - `src/plugins/axialViews/index.ts`: views are currently vehicle-frame rigs. They should become contributed main-view/aux-view camera rigs for compatible focused entities, not generic core assumptions.

- Compatibility-only or visual-role names:
  - `src/domain/domainPorts.ts`: `ShipBody` is already a compatibility alias for `ControlledBody`; keep it while playback and plugins migrate.
  - `src/setup/setupShips.ts`: legacy adapter from controllable entity configs into ship-shaped setup. Keep until generic setup no longer needs the adapter.
  - `src/plugins/playback/*`: v1 snapshots and diagnostic logs preserve `ships`, `shipForward...`, and `mainControlledBody` compatibility fields. Avoid making playback the first migration target.
  - `src/render/sceneAdapter.ts`, `src/app/scenePorts.ts`, trajectory IDs in `src/plugins/trajectories/*`, and tests with `legacyKind: "ship"`: many `ship` names are visual roles or compatibility identifiers. Rename only when render/trajectory schemas gain generic role support.
  - `src/plugins/solarSystem/ships.ts`, `src/plugins/solarSystem/ship.obj`, related tests/scripts: scenario spacecraft content, not core architecture.

First implementation order:

1. Add the focus bridge in setup/runtime/plugin params:
   - likely files: `src/app/runtimePorts.ts`, `src/setup/setup.ts`, `src/app/pluginPorts.ts`, `src/infra/domGameLoop.ts`, and focused tests in `src/setup/setup.test.ts` or `src/infra/__tests__/headlessGameLoop.test.ts`.
   - keep `mainControlledBody` as an alias.
   - prefer a shape like `FocusContext` / `FocusedEntity` with `entityId` and `controlledBody` rather than a plain renamed body reference.
2. Rename generic primary-view terminology:
   - `PilotLookState` -> `MainViewLookState`;
   - `SceneControlState.pilotLookState` -> `mainViewLookState`;
   - `pilotCameraOffset` -> `mainViewCameraOffset`;
   - `updatePilotLook` / `updatePilotCameraOffset` / `updatePilotViewFrame` -> main-view names with temporary aliases where needed.
3. Migrate generic focus consumers:
   - render label anchor, velocity segments, orbit telemetry, scene filters, HUD contexts.
   - use focus/capability names where the consumer only needs position/velocity.
4. Add explicit simulation phases before extracting spacecraft controls:
   - only then move thrust/RCS/attitude resolution out of `src/app/game.ts` and `src/app/controls.ts`.

### Capability Queries And Requirements

Plugins that depend on spacecraft-like behavior should declare or validate their requirements.

Examples:

- Autopilot requires a focused entity with motion state, local frame/attitude, and relevant control authority.
- Ship telemetry requires a focused motion state and spacecraft control readouts.
- Orbit telemetry requires a focused motion state and gravity bodies.
- Velocity segments require a focused motion state.
- Playback may require schema-specific compatibility for old ship fields and new generic entity snapshots.

Loaded-but-inert plugins are acceptable only when the inactive state is explicit and visible during setup or diagnostics.

Current rough direction:

- Capabilities should probably be queried from existing world arrays and setup indexes, not from a new dynamic ECS layer.
- A plugin should be able to ask for a focused entity with named capabilities and receive either direct references or a setup-time error/inactive result.
- Do not solve plugin dependency ordering here yet; start with capability presence/absence.

Unresolved:

- Whether requirements are declared statically on `GamePlugin`, checked during plugin loading, or checked lazily by each plugin hook.
- How visible inactive plugins should be in HUD/diagnostics.
- How to express "one of several compatible capability sets" without overbuilding.

### Plugin Interdependency

Problem:

- Autopilot, telemetry, playback, trajectories, and future operator modes may depend on capabilities or state produced by other plugins.
- Direct plugin-to-plugin imports would violate the outer composition model and make load order brittle.

Current rough direction:

- Prefer shared app-level ports/capabilities over plugin-to-plugin dependencies.
- Prefer setup-time validation over runtime surprises.
- Let plugins be independently loadable when their requirements are met by the assembled world/operator context.

Unresolved:

- Whether plugins should declare hard requirements, soft requirements, or both.
- Whether operator modes become the main dependency boundary.
- How to report missing requirements without making optional plugins noisy.

### Simulation Phase API

Problem:

- Moving ship physics into plugins requires a deterministic place to apply attitude, thrust, RCS, and future vehicle dynamics.
- Current ordering is spacecraft control physics, gravity, collision, spin, then scene/render/HUD.

Current rough direction:

- Preserve current ordering with explicit phases before extracting behavior.
- Use arrays of phase callbacks, not an allocation-heavy event bus.

Unresolved:

- Exact phase names and params.
- Whether control plugins evolve into phase plugins or a separate simulation plugin port.
- How much mutable tick output belongs to generic core versus operator plugins.

### Input Contexts

Problem:

- Core currently owns spacecraft-specific actions.
- Future operator-mode switching should change controls as well as camera/focus.

Current rough direction:

- Keep global runtime controls separate from operator controls.
- Active operator mode contributes the currently active action set and key map.
- Key collision policy can wait until multiple operator modes exist.

Unresolved:

- Which existing actions are truly global.
- How to preserve playback/control diagnostics while input moves.
- How `F1`, `F2`, etc. operator switching should be reserved.

### Main-View Camera Rigs

Problem:

- The primary view is core-owned but currently behaves like a pilot/forward camera attached to `mainControlledBody`.

Current rough direction:

- Rename generic "pilot view" concepts to "main view" first.
- Then let plugins contribute camera rigs for the active focus.
- Keep the primary canvas/layout/render target core-owned.

Unresolved:

- Whether the current forward camera becomes a default core rig or moves directly into a spacecraft/operator plugin.
- How camera rig state is stored and switched.
- How auxiliary axial views relate to active camera rigs.

### Playback Migration

Problem:

- Playback still preserves ship-shaped compatibility fields.
- Operator/focus generalization will change the central runtime context captured by diagnostics.

Current rough direction:

- Preserve old playback schemas while adding generic focus/operator fields.
- Avoid making playback the first migration target unless it blocks a smaller slice.

Unresolved:

- Snapshot v2 shape for active operator/focus state.
- Compatibility lifetime for `ships` fields.

## Migration Strategy

1. Rename/reframe generic terminology:
   - `pilot` view/state/config names to `main` where they describe generic camera/view behavior.
   - Preserve compatibility aliases where churn would be risky.
2. Introduce a generic focus concept:
   - Replace central reliance on `mainControlledBody` with a focus entity id plus required capability lookups.
   - Keep transitional helpers while consumers migrate.
3. Add simulation plugin phases:
   - Give plugins a clear place to apply vehicle dynamics before gravity and react after physics.
   - Preserve current tick ordering initially.
4. Extract spacecraft control physics:
   - Move thrust, RCS, attitude command resolution, and associated input actions out of core into a spacecraft/operator plugin.
   - Keep core physics helpers only when they are genuinely generic.
5. Make the main view camera rig-selectable:
   - Keep primary view core-owned.
   - Let plugins contribute camera rigs for the active focus.
6. Migrate dependent plugins:
   - Autopilot, ship telemetry, velocity segments, orbit telemetry, trajectories, axial views, and playback should consume focus/capability queries instead of assuming a core main ship.
7. Add operator-mode switching:
   - Switch focus, camera rig, controls, and HUD emphasis together.
   - Reserve function keys or another explicit input policy for switching once multiple modes exist.
8. Remove remaining core ship assumptions:
   - Delete spacecraft-specific base actions from core.
   - Remove core thrust/RCS/attitude state once the plugin path owns it.
   - Keep spacecraft naming only inside spacecraft-specific plugins and compatibility schemas.

## Current Transitional State

- Runtime world state is generic entity/capability based.
- `World` still exposes `controllableBodies`, and runtime setup exposes `mainControlledBody`.
- Core game tick still applies spacecraft-specific control physics:
  - control-state update
  - thrust command
  - RCS command
  - attitude command
  - controlled-body rotation
- Primary view is core-owned but still created as a pilot-style forward view relative to the main controlled body.
- Base input actions still include spacecraft controls and camera-offset controls.
- HUD, segment, scene, loop, autopilot, telemetry, trajectories, and playback plugin contexts commonly receive `mainControlledBody`.

## Watch-Outs

- Do not collapse every concern into a monolithic main-ship plugin. Separate entity contribution, control system, camera rig, HUD/readout, and operator selection boundaries.
- Plugin phase ordering must be deterministic and documented before ship physics moves out of core.
- Avoid allocation-heavy ECS/event patterns in per-frame loops.
- Preserve onion layering: domain/app/render must not import from `src/plugins`.
- Playback compatibility still matters; old schemas may retain `ships` fields while generic snapshots mature.
- Some render scene object kinds may remain visually named `ship`, `planet`, or `star` if labels, culling, or LOD still need visual roles.
- Be careful with "main view" versus "active operator mode": camera switching may need to switch controls too.

## Near-Term Candidates

- Audit all `pilot`, `ship`, `mainControlledBody`, and spacecraft-specific control references and classify them as:
  - generic focus/main-view concepts,
  - spacecraft/operator-plugin concepts,
  - compatibility-only names.
- Start with terminology and adapter changes before moving physics behavior.
- Consider a small focus-query helper as the bridge between current `mainControlledBody` and future `mainFocusEntityId`.
