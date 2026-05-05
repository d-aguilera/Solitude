# Entity Model Memory

## Purpose

- Dedicated context for generalizing Solitude's core world/entity model.
- Use this before work that changes world setup, physics state, collision, rendering adapters, controls, telemetry, or plugin world-model contribution.
- Goal: make core systems operate on generic capabilities instead of scenario-specific categories such as ships, planets, and stars.

## Current Direction

- Solar-system content is plugin-owned.
- Runtime `World` now stores generic entities and capability arrays instead of fixed `ships`, `planets`, and `stars` buckets.
- The remaining transition work is mostly at outer/setup/render edges: legacy physics setup adapters, visual scene roles, render config names, and scenario/plugin terminology.

## Target Model

Core should store generic entities with capability-style components. Likely components include:

- Identity / metadata.
- Transform or body state: position, velocity, orientation.
- Gravity mass.
- Collision sphere.
- Render mesh and color.
- Light emitter.
- Axial spin.
- Controllable body state.
- Main controlled body marker or config reference.

Systems should query capabilities rather than categories:

- Gravity integrates entities with mass + position + velocity.
- Collision checks dynamic/controllable entities against collision spheres.
- Rendering draws entities with render mesh components and emits lights from light components.
- Controls operate on the configured main controllable entity.
- Telemetry/autopilot plugins may define higher-level concepts like "dominant gravitational primary" without forcing those concepts into core world shape.

## Migration Strategy

1. Add generic entity/component types alongside the current `World` buckets.
2. Adapt existing solar-system plugin contributions into generic entities while still populating the old buckets for compatibility.
3. Move core systems one at a time to capability queries:
   - gravity state construction
   - collision resolution
   - render scene assembly
   - main controllable body lookup/control targeting
   - HUD/plugin contexts where needed
4. Move plugin APIs from contributing `planets` / `stars` / `ships` arrays to contributing generic entity definitions.
5. Delete fixed `ships` / `planets` / `stars` buckets once no core system depends on them.

## Phased Migration Plan

1. **Foundation and parity**
   - Introduce generic entity/config/world types alongside current `World`.
   - Build id indexes once during setup; hot systems should iterate capability arrays directly.
   - Add adapters from current celestial/ship config into generic entity configs, then into both generic arrays and legacy buckets.
   - Add parity tests proving solar-system ids, masses, positions, velocities, main controlled body, scene objects, and lights match current behavior.

2. **Generic setup path**
   - Make `createWorld` build generic capability arrays as the primary setup output.
   - Keep legacy buckets populated from the generic world for callers not yet migrated.
   - Extract pure celestial initial-state derivation from `setupPlanets.ts` so the solar-system plugin no longer creates a temporary legacy `World` just to place ships.
   - Update validation to require a main controllable entity, gravity bodies with mass where needed, and render configs for renderable entities.

3. **Move core simulation systems**
   - Change gravity state construction to read generic gravity/body-state capabilities instead of scanning ships/planets/stars.
   - Change collision resolution to check controllable/dynamic bodies against collision sphere entities.
   - Change axial spin to iterate spin capability arrays.
   - Change control, thrust, RCS, attitude, camera, and view params to consume the main controlled body type while preserving old aliases for plugins.

4. **Move scene and render assembly**
   - Build scene objects from renderable/light capabilities instead of planet/star/ship render arrays.
   - Keep transitional scene object roles only where render code still needs them for labels, culling, LOD, or visual treatment.
   - Replace star-specific light extraction with light-emitter capability queries.
   - Update trajectory scene setup to target generic entities; solar-system orbit/trajectory metadata stays plugin-owned.

5. **Move plugin and diagnostic consumers**
   - Update the solar-system plugin to contribute generic entities through the generic registry API.
   - Migrate telemetry, autopilot, velocity segments, axial views, trajectories, and HUD contexts to generic controlled-body/world queries.
   - Update orbit helpers so dominant-primary lookup accepts generic gravity/collision/body capabilities rather than `world.planets` and `world.stars`.
   - Add playback snapshot schema v2 using generic entity snapshots; compatibility with old v1 snapshot buckets has been intentionally dropped.

6. **Remove legacy buckets**
   - Delete `World.ships`, `World.planets`, `World.stars`, and matching physics arrays after production code no longer depends on them.
   - Remove legacy world-model registry methods and legacy config arrays.
   - Rename remaining public `ship` terminology only where it describes core architecture; plugin or scenario names may remain ship-specific when they truly mean spacecraft.
   - Update `MEMORY.md`, this file, and `src/plugins/README.md`.

## Important Constraints

- Preserve performance: avoid allocation-heavy ECS patterns in hot loops.
- Keep migration incremental and test-backed; use adapters during transition.
- Preserve onion layering: plugins remain outermost; domain/app/render must not import from `src/plugins`.
- Do not force plugin-only concepts into core. If only autopilot/telemetry needs a concept, prefer plugin-local helpers.
- Core may require a configured main controllable entity, but should not require that it be a "ship" category.

## Current Transitional State

- `src/plugins/solarSystem/` owns solar bodies, colors, mesh assets, default main/enemy ships, and Earth-bound ship placement.
- `src/app/pluginPorts.ts` exposes generic `addEntities` for world-model content; legacy `addCelestialBodies` / `addShips` registry hooks have been removed.
- `src/plugins/solarSystem/` contributes world content through direct generic `addEntities` calls; plugin application no longer backfills legacy physics/render arrays.
- Shared `WorldRenderConfig` no longer carries legacy planet/star/ship render arrays; scene assembly requires renderable entity components.
- Shared `WorldAndSceneConfig` no longer carries legacy physics arrays; `createWorld` requires generic entity config and derives setup inputs from entity components.
- Core-facing config/runtime/setup/control/view surfaces now use controlled-body/focus terminology; the old `ShipBody` compatibility alias has been removed.
- `src/domain/domainPorts.ts` defines `World` as generic entity/capability arrays.
- Core gravity, collision, spin, orbit primary lookup, scene/lights, trajectories, and playback diagnostics now operate on generic capabilities.
- Playback snapshots are v2-only and use generic `entities` plus `focusEntityId`; old `ships` / `planets` / `stars` snapshot buckets are no longer supported. `random-trip` has been migrated.

## Near-Term Candidates

- No entity-model migration task is currently queued here; next work should be chosen from fresh repo inspection.

## Watch-Outs

- `legacyKind` has been removed from source; the remaining category-name cleanup is setup/render/trajectory vocabulary and adapter shape debt.
- Legacy physics config item types still exist as setup/plugin-local adapter shapes; shared config arrays have been removed.
- Some scene object kinds are still `ship` / `planet` / `star` because render labels, culling, and LOD use those visual roles.
- Tests may use tiny fake worlds with spacecraft/body fixtures; keep them generic unless they are explicitly testing compatibility.
