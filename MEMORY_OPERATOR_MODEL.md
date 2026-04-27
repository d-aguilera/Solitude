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

- Audit `pilot`, `ship`, `mainControlledBody`, and spacecraft-specific control references.
- Classify each cluster as one of:
  - generic focus/main-view concept,
  - spacecraft/operator-plugin concept,
  - compatibility-only name.
- Produce a short implementation order for the first terminology/adapter step.

Success criteria:

- No broad code movement yet.
- A small list of files/symbols to rename first.
- A clear first bridge abstraction, probably around focus lookup or main-view naming.

## Completed Slices

- None yet.

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
