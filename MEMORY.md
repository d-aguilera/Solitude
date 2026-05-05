# Project Memory

## At-a-glance

- **App**: Solitude — browser-based spaceflight + orbital mechanics sandbox with pilot and picture-in-picture axial views.
- **Core value**: real-ish Newtonian gravity and a controllable ship, rendered in 2D/3D projections.
- **Primary user**: someone exploring orbital dynamics and spacecraft controls.

## Spin-off memory docs

- `MEMORY_PLUGIN_EXTRACTION.md`: audit notes and candidate list for moving non-core code into plugins.
- `MEMORY_ENTITY_MODEL.md`: dedicated strategy/context for replacing ships/planets/stars core buckets with generic entities/components.
- `MEMORY_OPERATOR_MODEL.md`: current strategic plan for moving main ship/control/camera behavior into plugin-defined operator modes around a generic focused entity.
- `MEMORY_HEADLESS_PLAYBACK.md`: planned work for running recorded playback scenarios end-to-end without the browser.
- **Note**: Plugin extraction and entity model generalization are still useful history, but the strategic direction has shifted to operator/focus generalization.

## Current focus

- Generalize the main interactive subject so core owns a generic focused entity, main view plumbing, and simulation phases while plugins define spacecraft controls, camera rigs, telemetry assumptions, and operator modes.
- **Current phase boundary**: plugin-facing and core runtime contexts now use `mainFocus`/`controlledBody`, and config/world-model APIs use `mainFocusEntityId`. The old `mainControlledEntityId` / `setMainControlledEntityId` compatibility path has been retired from source.

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
- **Composition state**: plugin-to-plugin shared state that should not enter core belongs in the plugin composition layer, e.g. spacecraft operator telemetry for thrust/RCS HUD readouts.
- **Single source of truth**: plugin list, structure, and behavior live in `src/plugins/README.md`.
- **World-model goal**: scenario plugins should contribute generic entities/components. Core should validate required capabilities (e.g. main controllable body) rather than requiring fixed categories.

## Entity Model Strategy

- **State**: runtime `World` stores generic entities and capability arrays; legacy planet/star/ship config remains at plugin/API compatibility edges.
- **Next strategic layer**: use the generic entity model as the foundation for operator/focus generalization. The main ship should become plugin-owned behavior rather than a core assumption.
- **Target model**: core stores generic entities with capability-style components, such as transform/state, gravity mass, collision sphere, render mesh/color, light emitter, axial spin, controllable body, and main focus identity.
- **System rule**: systems should query capabilities instead of categories:
  - gravity integrates entities with mass + position + velocity.
  - collision checks controllable/dynamic bodies against collision spheres.
  - rendering draws renderable mesh entities and light emitters.
  - operator/control plugins operate on the configured main focus when its required capabilities are present.
  - telemetry/autopilot plugins can define their own higher-level concepts, such as dominant gravitational primary, without forcing those concepts into core.
- **Migration strategy**:
  1. Move remaining plugins to direct generic entity contribution.
  2. Retire legacy world-model registry methods and config arrays.
  3. Keep remaining ship terminology only where it is spacecraft-specific or non-architectural compatibility IDs/visual roles.
- **Compatibility approach**: keep changes incremental and test-backed. Use adapters during the transition rather than doing a full rewrite.

## Runtime flow

- `src/bootstrap.ts` builds config, then bootstraps the DOM runtime.
- `src/infra/domBootstrap.ts` wires input, layout, renderers, loop, and gravity engine.
- `src/infra/domGameLoop.ts` runs the frame loop and orchestrates physics + rendering.
- `src/app/game.ts` is the per-tick simulation core.
- Plugin phase/HUD/scene/segment/loop contexts are focused-entity-first: use `mainFocus.controlledBody` for the active body.
- Per-tick core no longer returns mutable tick output; operator-specific readout state lives in plugins.

## Key files

- `src/infra/NewtonianGravityEngine.ts`: N-body gravity (leapfrog).
- `src/plugins/spacecraftOperator/`: spacecraft input bindings plus thrust/RCS/attitude command interpretation and vehicle dynamics.
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
- Solar-system content is contributed by a plugin, and runtime world state is largely generic entity/capability based.
- Spacecraft propulsion/RCS/attitude, spacecraft input bindings, and the primary forward camera rig live in `src/plugins/spacecraftOperator/` and operate on `mainFocus.controlledBody`.
- Spacecraft operator state, including the initial thrust level, is owned by `spacecraftOperator`; core config/tick setup no longer carries `thrustLevel`.
- Thrust/RCS velocity application helpers live with `spacecraftOperator`; core physics only keeps generic gravity, spin, collision, and controlled-body rotation helpers.
- Core exposes a generic plugin capability registry for plugin-to-plugin operator protocols. Plugins use opaque capability ids plus local structural/runtime validation rather than importing peer plugins or shared plugin-layer protocol modules.
- Core owns the primary view definition/canvas/layout while plugins register named main-view camera rigs; core uses the first registered rig as the current rig and fails if none exists.
- HUD, view/render params, playback loop/logging, and plugin simulation/scene/segment contexts have been migrated away from `mainControlledBody` aliases.
- Core no longer exposes the transitional `mainControlledBody` bridge from setup/runtime objects; config now names the focused entity via `mainFocusEntityId`.
- Plugins can declare focused-entity requirements; DOM/headless setup validates them against the assembled world and `mainFocus` with hard setup errors.
- Core setup constructs generic controllable bodies via `setupControllableBodies` and Keplerian motion bodies via `setupKeplerianBodies`; scenario plugins may still provide spacecraft content.
- Core setup classifies entities from capabilities/components; `legacyKind` has been removed from source.
- Render scene adaptation uses explicit `renderable.role` values; current roles are `controlledBody`, `orbitalBody`, and `lightEmitter`.
- Trajectory planning uses component/capability checks.
- Generic core logic uses controlled-body/focused-entity wording for collisions, camera positioning, rotation, orbit readouts, setup, and render roles; planet/star/ship category words are absent from core source.
- Playback snapshots are v2-only: generic `entities` plus snapshot metadata with `focusEntityId`; old `ships` / `planets` / `stars` playback snapshot buckets are no longer supported.
- Default runtime uses Canvas 2D; WebGL renderer exists but is not wired by default.
- Tests cover geometry/mesh parsing and projection clipping.

## Recent changes (last 1–2 weeks)

- Autopilot refactor: introduced layer-specific `autoPilot.ts` modules, and kept render ports local (no re-export of autopilot types).
- Solar-system scenario extraction: moved solar bodies, colors, meshes, and default ships into `src/plugins/solarSystem/`; introduced world-model plugin contributions.
- Operator model commits 13–21: migrated HUD telemetry, spacecraft vehicle dynamics, playback loop/loggers, view/render params, and plugin phase contexts to focused-body plumbing; removed most `mainControlledBody` compatibility fields outside the core setup/runtime bridge.
- Operator model follow-up: removed core thrust/RCS/propulsion command ports in favor of the generic plugin capability registry; autopilot now publishes a spacecraft propulsion resolver capability consumed by `spacecraftOperator` without importing peer plugin or shared plugin-layer protocol code.
- Operator/entity-model follow-up: migrated playback snapshots to generic entity snapshots and dropped old script-schema compatibility; `random-trip` was migrated to the new format.
- Entity-model cleanup: removed `legacyKind`, replaced planet/star setup adapters with generic Keplerian body setup, and changed render scene object kinds to `controlledBody` / `orbitalBody` / `lightEmitter`.

## Next steps

- Continue the operator model migration from the remaining spacecraft-specific/operator-mode seams. `mainControlledBody`, `mainControlledEntityId`, `setMainControlledEntityId`, deprecated main-view `pilot*` aliases, `@deprecated` source markers, and core setup `setupShips` naming should remain absent from `src`.
- Current post-V1 boundary: the default spacecraft experience is plugin-owned for controls, propulsion command protocols, vehicle dynamics, input bindings, primary forward camera rig, and spacecraft control state. Core owns primary view plumbing and selects the first registered camera rig. Remaining operator work is runtime operator-mode switching; entity-model cleanup can now remove playback-driven legacy category bridges.

## Planned Future Work

- Headless playback runner: make recorded playback scenarios runnable end-to-end without DOM/browser runtime. See `MEMORY_HEADLESS_PLAYBACK.md`.

## Open questions / risks

- The next operator/focus phase touches setup/runtime object shape and config naming; keep it small and reversible, because it affects bootstrap, headless loops, scene setup, playback, and tests.
- Some plugin features still use spacecraft or solar-system scenario vocabulary; keep that out of core unless it is truly generic.
- Gravity uses fixed sub-steps for stability; high time scales can still destabilize.
- WebGL path is present but not wired in the default entry; decide if/when to switch.
- Controls are keyboard-only with no in-app help; consider a help overlay or onboarding prompt.
