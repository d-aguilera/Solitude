# Entity Model Memory

## Purpose

- Dedicated context for generalizing Solitude's core world/entity model.
- Use this before work that changes world setup, physics state, collision, rendering adapters, controls, telemetry, or plugin world-model contribution.
- Goal: make core systems operate on generic capabilities instead of scenario-specific categories such as ships, planets, and stars.

## Current Direction

- Solar-system content is now plugin-owned, but the core world schema is still shaped like the solar system:
  - `World.ships`
  - `World.planets`
  - `World.stars`
  - matching physics arrays and render config arrays
- The next architectural effort is not more file relocation; it is replacing fixed world buckets with generic entities/components.

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

## Important Constraints

- Preserve performance: avoid allocation-heavy ECS patterns in hot loops.
- Keep migration incremental and test-backed; use adapters during transition.
- Preserve onion layering: plugins remain outermost; domain/app/render must not import from `src/plugins`.
- Do not force plugin-only concepts into core. If only autopilot/telemetry needs a concept, prefer plugin-local helpers.
- Core may require a configured main controllable entity, but should not require that it be a "ship" category.

## Current Transitional State

- `src/plugins/solarSystem/` owns solar bodies, colors, mesh assets, default main/enemy ships, and Earth-bound ship placement.
- `src/app/pluginPorts.ts` has a `worldModel` hook, but it still contributes typed celestial/ship arrays.
- `src/setup/setup.ts`, `src/setup/setupPlanets.ts`, and `src/setup/setupShips.ts` still construct category-specific world buckets.
- `src/domain/domainPorts.ts` still defines `World` as ships/planets/stars.
- Collision, orbit helpers, rendering adapters, and some plugins still assume these categories.

## Near-Term Candidates

- Introduce a generic `EntityId` / entity definition type and a component vocabulary without removing old world buckets yet.
- Build an adapter from existing solar-system plugin output to generic entities, then from generic entities back to the old buckets.
- Extract pure celestial initial-state derivation from `setupPlanets.ts` so solar-system ship placement does not need to call world mutation helpers.
- Decide whether "dominant gravitational primary" belongs in generic domain math or remains plugin-owned by autopilot/orbit telemetry.

## Watch-Outs

- `src/domain/orbit.ts` is currently used by plugins and assumes planets/stars as gravitational primaries.
- `src/domain/collisions.ts` treats ships as points and planets/stars as collision spheres.
- `src/render/sceneAdapter.ts` separately maps planet/star/ship render config into scene objects.
- Playback snapshots persist ships, planets, and stars separately; migration needs compatibility or a schema bump.
- Tests may use tiny fake worlds with planet/ship fixtures; update them gradually to avoid masking architecture regressions.
