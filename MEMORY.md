# Project Memory

## At-a-glance

- **App**: Solitude — browser-based spaceflight + orbital mechanics sandbox with pilot and picture-in-picture axial views.
- **Core value**: real-ish Newtonian gravity and a controllable ship, rendered in 2D/3D projections.
- **Primary user**: someone exploring orbital dynamics and spacecraft controls.

## Spin-off memory docs

- `MEMORY_PLUGIN_EXTRACTION.md`: audit notes and candidate list for moving non-core code into plugins.
- `MEMORY_ENTITY_MODEL.md`: dedicated strategy/context for replacing ships/planets/stars core buckets with generic entities/components.
- **Note**: Plugin extraction is still useful history, but the strategic direction has shifted to entity model generalization.

## Current focus

- Generalize the core world/entity model so scenario plugins define content and core systems operate on generic capabilities rather than solar-system-shaped categories like ships, planets, and stars.

## Must-Do After Code Changes (Do Not Skip)

- Run Prettier on modified files (or the whole codebase if easier).
- Organize imports at the top of modified source files. Prettier may not do this; use the TypeScript/VS Code "Organize Imports" source action or an equivalent tool when available.
- Run: `npm run typecheck`
- Run: `npm run test`
- If you did not run them, explicitly say “Not run” in your response.

## Non-negotiables and exceptions

- **Performance is paramount**: CPU time, memory consumption, and garbage collection pressure come before everything else.
- **Onion layering**: domain core → app logic → infra adapters. Outer layers depend inward, even if it costs performance.
- **Known exception**: `src/global/` is a deliberate carve-out and may violate onion rules. Do not treat it as a layering issue.
- **Physics**: Newtonian N-body with leapfrog integration for stability.
- **Solar system data**: use real-ish values (AU, km, approximate J2000 elements) for plausibility.
- **Entity model direction**: core should not know about scenario categories such as planet/star/ship except where still transitional. Prefer generic bodies/components/capabilities.
- **Rendering**: default Canvas 2D for portability; WebGL path exists if needed.
- **Math helpers**: always use math helpers when available for vector/matrix/trig instead of inlining the math.
- **Epsilons**: use the shared constants in `src/domain/epsilon.ts` instead of inline literals.

## Architecture map

- `src/domain/`: math + physics primitives (vec/mat, orbit, collisions, gravity state).
- `src/app/`: app/game logic (controls, autopilot, scene updates).
- `src/infra/`: DOM input, layout, game loop, gravity engine.
- `src/render/`: projection + render staging (faces, polylines, HUD).
- `src/rasterize/`: Canvas2D + WebGL rasterizers.
- `src/setup/`: generic runtime world/scene construction from transitional plugin-contributed config.
- `src/config/`: generic config helpers and base runtime config.
- `src/global/`: cross-cutting globals (allowed onion exception).
- `src/plugins/`: plugin catalog/composition layer (outer layer), including default world-model content.

## Plugins

- **Role**: plugins are the outermost layer that compose input, control, loop, HUD, scene, segment hooks, and world-model content around the core game.
- **Layering rule**: inner layers (`domain`, `app`, `render`) must never import from `src/plugins`; infra/bootstrap decides what to load.
- **Registration**: `src/plugins/index.ts` exports `availablePlugins` and `loadPlugins`; infra (e.g. `src/infra/domBootstrap.ts`) chooses plugin IDs.
- **Single source of truth**: plugin list, structure, and behavior live in `src/plugins/README.md`.
- **World-model goal**: scenario plugins should contribute generic entities/components. Core should validate required capabilities (e.g. main controllable body) rather than requiring fixed categories.

## Entity Model Strategy

- **State**: runtime `World` stores generic entities and capability arrays; legacy planet/star/ship config remains at plugin/API compatibility edges.
- **Target model**: core stores generic entities with capability-style components, such as transform/state, gravity mass, collision sphere, render mesh/color, light emitter, axial spin, controllable body, and main controlled body marker.
- **System rule**: systems should query capabilities instead of categories:
  - gravity integrates entities with mass + position + velocity.
  - collision checks controllable/dynamic bodies against collision spheres.
  - rendering draws renderable mesh entities and light emitters.
  - controls operate on the configured main controllable entity.
  - telemetry/autopilot plugins can define their own higher-level concepts, such as dominant gravitational primary, without forcing those concepts into core.
- **Migration strategy**:
  1. Move remaining plugins to direct generic entity contribution.
  2. Retire legacy world-model registry methods and config arrays.
  3. Rename remaining core-facing ship terminology where it means generic controlled body.
- **Compatibility approach**: keep changes incremental and test-backed. Use adapters during the transition rather than doing a full rewrite.

## Runtime flow

- `src/bootstrap.ts` builds config, then bootstraps the DOM runtime.
- `src/infra/domBootstrap.ts` wires input, layout, renderers, loop, and gravity engine.
- `src/infra/domGameLoop.ts` runs the frame loop and orchestrates physics + rendering.
- `src/app/game.ts` is the per-tick simulation core.

## Key files

- `src/infra/NewtonianGravityEngine.ts`: N-body gravity (leapfrog).
- `src/app/controls.ts`: input mapping to thrust/attitude/autopilot.
- `src/plugins/autopilot/logic.ts`: align-to-velocity/body and “circle now”.
- `src/plugins/playback/`: diagnostic capture/playback for repeatable circle-now repros.
- `src/setup/sceneSetup.ts`: scene graph + trajectory setup.
- `src/plugins/solarSystem/`: solar system data, colors, meshes, default ships, and Earth-bound initial ship states.
- `src/render/DefaultViewRenderer.ts`: projection + draw list assembly.

## Controls quick reference

- Look: `Arrow keys`, reset with `R`.
- Thrust level: `0–9` set magnitude (used by `Space`/`B`).
- Main engine: `Space` forward, `B` backward.
- RCS translation: `N` left, `M` right.
- Attitude: `W/S` pitch, `Q/E` roll, `A/D` yaw.
- Autopilot: `V` align to velocity, `C` align to dominant body, `X` circle now.
- Camera offset: `U/J` forward/back, `I/K` up/down.
- Time scale: `[` decrease, `]` increase.
- Pause: `P`.
- Profiling HUD toggle: `O`.

## Local dev workflow

- `npm run dev` (runs `typecheck` + `vitest run` first, then `vite --host`).
- `npm run test` (Vitest watch).
- `npm run typecheck` (TS no-emit).
- `npm run build` / `npm run preview` for production.
- After code changes: run `npm run typecheck` and `npm run test`.

## Current state

- Core loop is working: input → physics → scene update → render → HUD.
- Solar-system content is contributed by a plugin, but core still models it through transitional `ships`, `planets`, and `stars` buckets.
- Default runtime uses Canvas 2D; WebGL renderer exists but is not wired by default.
- Tests cover geometry/mesh parsing and projection clipping.

## Recent changes (last 1–2 weeks)

- Autopilot refactor: introduced layer-specific `autoPilot.ts` modules, and kept render ports local (no re-export of autopilot types).
- Solar-system scenario extraction: moved solar bodies, colors, meshes, and default ships into `src/plugins/solarSystem/`; introduced world-model plugin contributions.

## Open questions / risks

- Entity generalization touches physics, rendering, controls, collision, and plugin APIs; keep each migration step small and reversible.
- Some plugin features currently assume planets/stars/ships; expect temporary adapters while the generic model lands.
- Gravity uses fixed sub-steps for stability; high time scales can still destabilize.
- WebGL path is present but not wired in the default entry; decide if/when to switch.
- Controls are keyboard-only with no in-app help; consider a help overlay or onboarding prompt.
