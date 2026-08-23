# Project Memory

## At-a-glance

- **App**: Solitude — browser-based spaceflight + orbital mechanics sandbox with pilot and picture-in-picture axial views.
- **Core value**: real-ish Newtonian gravity and a controllable spacecraft, rendered in 2D/3D projections.
- **Primary user**: someone exploring orbital dynamics and spacecraft controls.
- **Current strategic direction**: preserve the completed physical plugin-package boundary and choose the next product direction deliberately.

## How To Use This File

- Keep this file as a **current-state snapshot and router**.
- Put detailed migration logs, completed slices, and long tactical notes in the relevant spin-off memory doc.
- When a topic grows beyond a few bullets here, move the detail into the spin-off and leave a pointer.

## Spin-off memory docs

### Active

- `MEMORY_SERVER_PERFORMANCE.md`: active roadmap for establishing a precise,
  reproducible authoritative-server performance baseline, capacity model, and
  later regression gates.
- `MEMORY_HEADLESS_PLAYBACK.md`: unresolved but currently deprioritized work for running recorded playback scenarios end-to-end without the browser.

### Complete / Archived

- `archive/MEMORY_GRAVITY_PLUGIN.md`: completed current-state reference for the
  required external Newtonian gravity provider, bounded high-time-scale
  integration, and typed-array CPU implementation.
- `archive/MEMORY_PACKAGE_DECOUPLING.md`: completed roadmap for external plugin packages, runtime discovery, single-host packs, and physical extraction.
- `archive/MEMORY_PACKAGE_SPLIT.md`: archived package-split record for `@solitude/engine`, `@solitude/browser`, and `solitude`; consult before package boundary/export changes.
- `archive/MEMORY_OPERATOR_MODEL.md`: archived strategy for moving main ship/control/camera behavior into plugin-defined operator modes around a generic focused entity.
- `archive/MEMORY_ENTITY_MODEL.md`: archived strategy/context for replacing ships/planets/stars core buckets with generic entities/components.
- `archive/MEMORY_CLIENT_SERVER.md`: archived proof-of-concept client/server migration record and slice log.
- `archive/MEMORY_CLIENT_SERVER_2.md`: archived client/server gameplay-feel roadmap covering authoritative realtime loop hardening, compact snapshots, load metrics, sequenced input, remote interpolation diagnostics, local prediction/reconciliation, and multiplayer time-scale troubleshooting.
- `archive/MEMORY_PLUGIN_EXTRACTION.md`: archived audit notes and candidate list for moving non-core code into plugins.
- `archive/MEMORY_GPU_RENDERING.md`: archived WebGL2-native rendering roadmap covering shared browser presentation, GPU mesh rendering, Canvas overlays, and rollout.
- `archive/MEMORY_GPU_POLYLINES.md`: archived depth-tested WebGL trajectory/world-segment ribbon work.

## Current focus

- **Primary active work**: establish the authoritative-server performance
  baseline described in `MEMORY_SERVER_PERFORMANCE.md`. Gravity plugin
  extraction is complete and headless playback remains deliberately dormant.
- **Current extraction frontier**: physical product-plugin extraction is complete. No product plugin implementation remains in a host package; both products discover `newtonianGravity`, `solarSystem`, `autopilot`, `spacecraftOperator`, and `polyFighter` through their Solitude content packs.
- **Discovery foundation**: browser and server discovery, multi-plugin packs, strict manifests, target-specific assembly, origin/path security, and schema-v3 single-host packs are in place. Preserve the rule that a pack is an atomic host-specific activation unit.
- **Headless playback**: still unresolved and not archived, but it is a dormant backlog item rather than the active path. See `MEMORY_HEADLESS_PLAYBACK.md`.
- **GPU rendering state**: WebGL2 is the sole solid-mesh renderer for standalone and remote play. WebGL also owns depth-tested trajectory and world-segment ribbons; Canvas remains for scene labels, markers, and HUD. The engine CPU-face pipeline and Canvas backend have been removed. Historical rendering roadmaps live in `archive/MEMORY_GPU_RENDERING.md` and `archive/MEMORY_GPU_POLYLINES.md`.
- **Operator/focus boundary**: engine runtime contexts use `mainFocus`/`controlledBody`, config/world-model APIs use `mainFocusEntityId`, and the external requirement plus controlled loop operation use the semantic name `focusEntity`.
- **Remaining operator follow-ups**: foreground/background UX and declarative input lock policy are deferred in `archive/MEMORY_OPERATOR_MODEL.md`.
- **Retired compatibility names**: keep `mainControlledBody`, `mainControlledEntityId`, `setMainControlledEntityId`, deprecated main-view `pilot*` aliases, `@deprecated` source markers, and core setup `setupShips` naming out of source.

## Must-Do After Code Changes

- Run Prettier on modified files, or the whole codebase if easier.
- Organize imports at the top of modified source files. Prettier uses `prettier-plugin-organize-imports`, but verify when imports move across packages.
- Run: `npm run typecheck`
- Run: `npm run test`
- Run: `npm run map:architecture`, inspect every generated change, and include
  substantive slice-related map updates. Restore the file when `generatedAt`
  is the only change.
- Exception: for changes strictly limited to the static architecture-map viewer
  or docs under `docs/architecture-map/`, `npm run typecheck` and
  `npm run test` are optional. Still run Prettier on modified files, run
  `node --check docs/architecture-map/app.js` when that file changes, and run
  `npm run map:architecture` when the generator or `architecture.json` could be
  affected.
- If you did not run an otherwise-required command, explicitly say “Not run” in
  the response.

## Non-negotiables and exceptions

- **Performance is paramount**: CPU time, memory consumption, and garbage collection pressure come before everything else.
- **Onion layering**: domain core → app logic → infra adapters. Outer layers depend inward, even if it costs performance.
- **Plugin imports**: plugin implementation modules may be imported only by same-plugin code, tests, or composition modules. `npm run check:boundaries` enforces this together with workspace dependency/export rules and the external-plugin import boundary.
- **External plugin imports and trust**: packages under `plugins/*` may import only exported `@solitude/plugin-api/*` subpaths from the host workspace; the package deliberately has no root or catch-all plugin export, so plugins select focused module, runtime, capability, gravity, controllable-entity, asset, input, HUD, presentation, multiplayer, telemetry, control, loop, simulation, snapshot, render, scene, view, world, localization, math, entity-name, or manifest surfaces. Their emitted modules must be self-contained and are loaded through versioned manifests with no static host fallback. Browser loading starts from same-origin `plugins/loader.json`; every resolved document/module origin must be explicitly allowed, JSON redirects fail, and page CSP defaults plugin execution to `script-src 'self'`. Server loading starts from an explicitly configured local plugin-set document and requires all pack/plugin documents and declared module entries to remain under its real-path root.
- **Known exception**: `packages/engine/src/global/` is a deliberate carve-out and may violate onion rules. Do not treat it as a layering issue.
- **Physics**: Newtonian N-body with leapfrog integration for stability.
- **Solar-system data**: use real-ish values (AU, km, approximate J2000 elements) for plausibility.
- **Entity model direction**: core should not know scenario categories such as planet/star/ship. Prefer generic bodies/components/capabilities.
- **Rendering**: WebGL2-native solid-mesh rendering is required. Browser WebGL renders solid meshes plus depth-tested trajectory/world-segment ribbons. `SceneOverlayRenderer` handles renderer-neutral scene overlay projection; the browser Canvas scene overlay draws labels and markers, and the HUD rasterizer draws HUD panels separately.
- **Geometry helpers**: always use the dependency-free `@solitude/geometry` vector, matrix, intersection, mesh-volume, and OBJ helpers when available instead of inlining the math. Engine-owned vector/matrix facades retain allocation profiling; external plugins consume the portable implementations through `@solitude/plugin-api/math` and `@solitude/plugin-api/assets`.
- **Epsilons**: use shared constants in `packages/engine/src/domain/epsilon.ts` instead of inline literals.
- **Optional arguments**: avoid optional runtime/plumbing arguments unless absence is semantically meaningful. Prefer required parameters with empty collections or default objects so call sites and implementations do not grow defensive branches.

## Package Snapshot

- `packages/engine/src/`: generic domain/app/setup/render/global source plus gravity contracts/state orchestration and headless runtime.
- `packages/geometry/src/`: dependency-free portable vector, matrix, ray/sphere, triangle-mesh volume, and Wavefront OBJ primitives shared by engine and the controlled external plugin API.
- `packages/hud/src/`: generic HUD grid and HUD panel capability contracts shared by browser, client, Solitude, and external plugins.
- `packages/input/src/`: outer keyboard input-provider contracts; plugins publish bindings/handlers through generic engine capabilities and browser adapters consume them.
- `packages/entity-names/src/`: dependency-free canonical entity-name provider capability contract and lookup policy; content plugins own provider implementations and localized name bundles, and the external plugin API re-exports this implementation.
- `packages/localization/src/`: dependency-free shared Solitude locale resolution and number/unit/message formatting; message bundles remain with their owning client/plugin/content package.
- `packages/composition/src/`: browser-safe and Node-safe Solitude world-config and headless-composition helpers; it owns no plugin implementation or catalog.
- `packages/browser/src/`: DOM/runtime adapters, keyboard input, presentation-frame capabilities, layered view layout, Canvas presentation, GPU-native WebGL2 presentation, and remote-world mirror helpers.
- `packages/protocol/src/`: browser-safe client/server protocol types and message guards.
- `packages/plugin-api/src/`: focused, rootless subpath exports for independently built external plugins. Module composition, runtime options, generic capability primitives, gravity providers, domain capabilities, control-state updates, loop/frame-policy access, narrow browser simulation phases, canonical runtime snapshots, render/scene/view contracts, world access, localization, math, entity naming, and manifests have distinct surfaces; there is no catch-all `plugin.ts`. Portable geometry and OBJ implementations come from the dependency-free `@solitude/geometry` package, while entity-name capabilities reuse their dependency-free canonical package rather than duplicating policy.
- `packages/plugin-runtime/src/`: strict external plugin-set, pack, and plugin-manifest validation; ordered browser and contained local-server pack expansion; and adaptation into engine plugin factories. Pack schema v3 declares one `host`, packs are atomic host-specific activation units, plugin schema v2 has no environment field, and unpacked or multi-host plugins are rejected. Browser plugins may expose the current hooks and requirements; API v11 server plugins may expose capabilities and a gravity provider plus `controls`, authoritative `simulation.updateVehicleDynamics`, and pre-runtime `worldModel`.
- `packages/client/src/`: deployable remote browser client, server URL adapter, HTTP/WebSocket client helpers, keyboard input patching, authoritative snapshot interpolation, and remote rendering composition.
- `packages/server/src/`: generic Node-oriented authoritative session, ticking, snapshot encoding, metrics, HTTP, and WebSocket infrastructure parameterized by a game implementation.
- `packages/multiplayer/src/`: Solitude-specific authoritative game composition and deployable server entrypoint, including server plugin discovery and use of the shared headless simulation.
- `packages/solitude/src/`: standalone browser bootstrap, renderer-failure localization, and the static browser HUD host adapter; it owns no product plugin implementation.
- `plugins/core-pack-v1/`: independently built browser pack discovered at runtime by standalone and remote clients. It contains autopilot-input, autopilot-HUD, axial-view, body-label, main-view-lookaround, orbit-segment, orbit-telemetry, runtime-telemetry, ship-telemetry, solar-system-material, targeting-laser, trajectory, and velocity-segment plugins plus pack-owned texture assets.
- `plugins/newtonian-gravity/`, `plugins/poly-fighter/`, `plugins/solar-system/`, `plugins/autopilot/`, and `plugins/spacecraft-operator/`: external implementations owning Newtonian integration, fighter content, solar-system content, autopilot control, and spacecraft dynamics/browser controls respectively.
- `plugins/solitude-content-pack/`: shared five-entry build configuration for the separate browser and server content deployment packs.
- `plugins/solitude-content-browser-pack-v1/` and `plugins/solitude-content-server-pack-v1/`: thin single-host deployment packs that bundle the ordered `newtonianGravity`, `solarSystem`, `autopilot`, `spacecraftOperator`, and `polyFighter` implementations.
- `plugins/multiplayer-pack-v1/`: independently built multiplayer-only browser plugin pack containing the remote identity HUD and localized ship-color entity names.
- `plugins/standalone-pack-v1/`: independently built standalone-only browser plugin pack containing default ships, diagnostic playback, pause and time-scale controls/HUD, memory telemetry, profiling controls/HUD, and runtime operator focus switching.
- Production and test source lives under `packages/*`; the root `src` directory has been removed.
- Root Vite config uses `packages/solitude` as the standalone app root; dedicated Vite configs build `dist/client`, `dist/server`, and `dist/standalone`.

## Runtime Flow

- `packages/solitude/index.html` loads `packages/solitude/src/bootstrap.ts`.
- Solitude bootstrap discovers and imports the external browser plugin set, combines its factories with the browser HUD host adapter, builds config, and calls browser runtime bootstrap.
- `packages/browser/src/infra/domBootstrap.ts` wires DOM input, layout, renderers, browser frame scheduling, and the discovered plugin set.
- `packages/engine/src/infra/configuredGamePipeline.ts` constructs the standalone world/scene and creates the engine-owned application pipeline.
- `packages/engine/src/app/gamePipeline.ts` owns plugin assembly, frame policy, simulation, scene/view updates, and per-view render contributions; `packages/engine/src/app/game.ts` runs the per-tick simulation phases.
- `packages/browser/src/infra/domGameLoop.ts` schedules animation frames, invokes the engine pipeline, renders through generic view renderers, and rasterizes scene/HUD overlays.
- External packs provide spacecraft dynamics, headless autopilot behavior, gameplay content, browser presentation/input, and diagnostic playback.
- Solitude plugin order is runtime behavior; later loop/frame-policy plugins can override earlier ones, and capability-backed DOM input handlers are consulted in reverse plugin order.

## Current State

- Core loop works: input → physics → scene update → render → browser overlays.
- Runtime world state is generic entity/capability based.
- Solar-system content is owned by the external `@solitude-plugins/solar-system` package; standalone, remote-client, and authoritative multiplayer discover it through their host-specific Solitude content packs.
- Body label content is contributed by the external `bodyLabels` plugin in `core-pack-v1`; engine owns generic scene-label layout.
- HUD panel contracts are owned by `@solitude/hud`, with a matching structural external contract in `@solitude/plugin-api`; browser owns the canvas overlay adapter that rasterizes HUD grids.
- Browser presentation-frame providers let plugins observe local animation-frame cadence without depending on the standalone simulation loop; both standalone and remote hosts publish frame samples through `solitude.browser.presentationFrame.v1`.
- Keyboard maps and key handlers are owned by `@solitude/input`, published as plugin capabilities, and consumed by browser DOM input. Providers may declare actions that remain available through generic input-lock handlers, avoiding cross-plugin action-name coupling. Engine plugin contracts know semantic control actions but not keyboard/device bindings.
- Main-view lookaround input/camera-offset controls live in the external `mainViewLookaround` plugin in `core-pack-v1`; both standalone and multiplayer apply them to renderer-local state rather than authoritative simulation input.
- Spacecraft propulsion/RCS dynamics and operator state live in the shared external `spacecraftOperator` core. Its browser entry additionally contributes keyboard input, local prediction, telemetry, and the primary forward camera rig; its server entry contributes only authoritative dynamics and telemetry.
- Autopilot `circleNow` uses `autopilot.mode.v2`: a continuous dominant-body circularization controller that aims the main thrust axis at orbital correction while unstable, blends back to inward-facing once stable, and keeps roll referenced to the orbital tangent to avoid stable-orbit roll oscillation. `alignToVelocity` and `alignToBody` remain behavior-compatible with v1.
- The host-neutral `autopilot` plugin contributes control behavior and capabilities through both Solitude content packs. Its `autopilotInput` and `autopilotHud` siblings in `core-pack-v1` own browser keyboard bindings and the localized HUD panel/message bundles respectively; server/headless composition does not instantiate either browser-facing plugin.
- Runtime focus switching lives in the external `operatorSwitch` plugin in `standalone-pack-v1`; `Tab` swaps foreground focus between `ship:blue` and `ship:red` through the loop API's controlled focus operation.
- During playback, `Tab` may switch the viewed focus while recorded controls continue applying to the entity focused when each playback phase was recorded.
- Core owns generic focus, primary-view plumbing, simulation phase order,
  gravity contracts/state orchestration, spin, collision, setup, render
  preparation, and plugin port/capability contracts. The external
  `newtonianGravity` provider owns concrete gravity integration.
- The engine-owned configured game pipeline constructs standalone runtime state and coordinates frame policy, simulation, scene/view updates, and render contributions. Browser runtime code is limited to frame scheduling and presentation adapters.
- Standalone and headless runtimes share simulation-plugin capability/control assembly through `packages/engine/src/app/pluginRuntime.ts`. Solitude headless composition accepts one required ordered `plugins` collection; callers instantiate static and discovered factories with runtime options before creating the loop.
- External plugins can declare `requirements.focusEntity` for focused-entity capabilities not guaranteed by `ExternalFocusContext`; the external runtime translates them to the engine's internal `mainFocus` requirement scope, and DOM/headless setup validates them against the assembled world with hard setup errors. External contribution callbacks are grouped under `ExternalPlugin.hooks`, while the required singleton gravity provider is a typed top-level contribution. API v11 retains the browser lifecycle and frozen snapshot facade, and permits server gravity providers plus authoritative `controls`, `simulation.updateVehicleDynamics`, and pre-runtime `worldModel` hooks. Server requirements and browser-only phases remain rejected.
- Generic headless runtime does not import or auto-install Solitude spacecraft plugins; Solitude behavior is caller-composed when needed.
- Solitude's authoritative runtime lives in `packages/multiplayer/src/runtime.ts`; it instantiates the complete discovered content catalog per game, composes shared `@solitude/composition` headless code, steps entity-addressed controls, and reuses runtime snapshot storage. `@solitude/server` supplies the generic server/session/transport framework.
- Remote client lives in `packages/client/`; it can be deployed as static assets, points at a configurable Solitude server, uses per-join participant IDs carried in game links, receives authoritative model/snapshot messages over WebSocket, reconciles join/leave entity-model changes into the retained scene and WebGL presenters, sends sequenced server-authoritative controls for its assigned ship, can optionally predict the locally controlled ship and smooth reconciliation visually, derives localized ship names from server-assigned display colors, exposes prediction metrics on `window.__solitudePredictionMetrics`, and renders through `@solitude/browser`.
- Remote client composition lives in `packages/client/src/composition.ts`; local prediction is driven through `@solitude/plugin-api/local-prediction` capabilities, not direct plugin-internal imports.
- The client-owned `solitude.multiplayer.session.v1` capability exposes live game and assigned-entity ids to external multiplayer presentation plugins without coupling them to DOM fields or protocol state.
- Standalone and remote rendering share browser-owned layered view presenters. WebGL renders solid meshes natively from renderer-neutral scene meshes and draws trajectory/world-segment ribbons with depth testing; Canvas overlays preserve labels, markers, and HUD.
- The external browser-only `core-pack-v1` package currently contributes thirteen plugins. Autopilot input owns the shared `C`/`V`/`Z`/`X` mode-toggle keyboard behavior, while autopilot HUD renders localized mode state and circle-now diagnostics. Axial views registers localized top/front/left/right picture-in-picture cameras. Body labels render capability-provided or generated entity names plus localized distance and speed readouts. Main-view lookaround owns shared renderer-local look rotation, reset, and camera-offset controls. Orbit segments toggle with `G` and render the focused entity's bound analytic orbit around its dominant gravity body. Orbit telemetry renders localized orbit, apsis, circularization, and timing readouts. Runtime telemetry renders localized simulation time and rolling local presentation FPS. Ship telemetry renders localized focused-entity speed and optional spacecraft thrust/RCS state. Solar-system materials applies Earth and Moon texture materials and resolves three pack-owned JPEG assets relative to its loaded module. Targeting laser toggles with `T`, locks the collision sphere nearest the focused ship's nose axis, and renders a beam, target-plane miss guide, obstruction cue, or constant-screen-size surface impact marker. Trajectories maintain sampled ring-buffer polylines for controllable bodies and primary solar-system bodies. Velocity segments render forward/backward world-space lines along the focused entity's velocity. Both browser products discover the pack through same-origin `plugins/loader.json`; no product package statically depends on the plugin package.
- The host-neutral `@solitude-plugins/poly-fighter` and `@solitude-plugins/solar-system` implementations own the fighter provider/OBJ and solar world model/capabilities/localized names. Both browser products discover them through `solitude-content-browser-pack-v1`; authoritative multiplayer discovers the identical bundled modules through `solitude-content-server-pack-v1`, instantiates fresh plugin objects per game, and requires exactly one discovered controllable-entity provider and a celestial-body provider without knowing their concrete implementations.
- The external `multiplayer-pack-v1` package contributes `remoteIdentityHud` and `shipColorNames` only to multiplayer. Standalone's assembled plugin set and distribution do not contain the pack. Multiplayer reads both packs through its own same-origin `plugins/loader.json`.
- The external `standalone-pack-v1` package contributes `ships`, `playback`, `pause`, `timeScale`, `memory`, `profiling`, and `operatorSwitch` only to standalone. Playback uses API-v9 control, loop, scene, and narrow vehicle-dynamics hooks; it owns scenario metadata while delegating runtime snapshot capture/apply to the engine's canonical host facade, and temporarily targets each recorded phase's entity during vehicle dynamics. Pause is ordered before profiling so the profiler observes paused frames. Pause and time scale yield to playback's earlier fixed-tick diagnostic policy. `operatorSwitch` remains after playback so it can refresh the scene when focus changes while playback is paused. Core diagnostic toggles explicitly remain available through playback's input lock. Multiplayer's assembled plugin set and distribution do not contain the pack.
- External plugin sets expand ordered atomic pack manifests, and each independently built pack may contribute multiple ordered runtime plugin manifests. All packs and plugin manifests use strict schema/id validation; pack-host, plugin API, path/origin, duplicate-id, and collision validation complete before module import. Browser loader configuration is a fixed same-origin trust root, defaults to `self`, and JSON fetches reject redirects. Server plugin sets are explicit local trust roots with lexical and real-path containment. Missing, disallowed, incompatible, duplicate, or colliding plugins fail host startup.
- Plugin deployment assembly is target-specific: `plugins/browser-plugin-packs.json` defines standalone/multiplayer browser order, `plugins/server-plugin-packs.json` defines authoritative server order, `dist/plugin-public/<target>` stages browser trees, and `dist/server/plugins` contains the authoritative server's local plugin tree beside its bundle.
- Engine world-segment contributions use renderer-neutral numeric RGB; CSS conversion occurs in the render layer. Engine frame policy uses generic presentation terminology while browser overlays retain browser-owned naming.
- Localization is client-side and server-neutral. Dependency-free `@solitude/localization` resolves `?locale=` or browser-preferred language to `en`/`es`/`fr`, formats numbers/units without thousands grouping, and provides message interpolation. JSON message bundles live with the client/plugin/content package that owns each string. The multiplayer lobby offers a language selector and passes locale through game links; standalone resolves from browser locale unless `?locale=` overrides it.
- Entity `displayName` remains a literal authored override for scene/body labels. The neutral `@solitude/entity-names` port lets entity-contributing plugins provide localized names through `solitude.entityNameProvider.v1`; built-in solar-system names are owned by the solar-system plugin, and custom ids fall back to generated names.
- Shared browser-safe protocol contract lives in `@solitude/protocol`; browser client adapters live in `@solitude/client`.
- Browser remote-world mirror proof lives in `@solitude/browser/remoteWorldMirror`; it applies authoritative runtime snapshots into a local world via a reusable indexed workspace.
- Server-safe Solitude headless composition lives in `@solitude/composition`; `@solitude/server` intentionally does not depend on the browser-facing `solitude` package.
- Playback snapshots are v2-only: generic `entities` plus snapshot metadata with `focusEntityId`.
- Tests have moved into owning packages; root TypeScript/Vitest tooling no longer includes `src`.

## Key Files

- `plugins/newtonian-gravity/src/index.ts`: external host-neutral N-body gravity provider with leapfrog integration.
- `packages/engine/src/app/gamePipeline.ts`: application-level standalone frame pipeline and per-view contribution preparation.
- `packages/engine/src/app/pluginRuntime.ts`: shared simulation-plugin capability, control, and simulation assembly used by standalone and headless runtimes.
- `packages/engine/src/infra/configuredGamePipeline.ts`: engine composition factory that constructs the world/scene and application pipeline.
- `packages/engine/src/infra/headlessGameLoop.ts`: generic headless stepper; callers pass Solitude plugins explicitly when needed.
- `packages/engine/src/setup/sceneSetup.ts`: generic scene graph + trajectory setup.
- `packages/engine/src/render/SceneOverlayRenderer.ts`: renderer-neutral projection and layout for scene overlays only.
- `packages/geometry/src/index.ts`: dependency-free public geometry surface for vectors, matrices, ray/sphere intersection, mesh volume, and OBJ parsing.
- `packages/browser/src/infra/domBootstrap.ts`: browser runtime composition.
- `packages/browser/src/infra/remoteWorldMirror.ts`: non-DOM authoritative snapshot apply mirror for future network clients.
- `packages/composition/src/headless.ts`: shared server-safe/browser-safe Solitude headless composition.
- `packages/entity-names/src/entityNames.ts`: neutral entity-name provider capability contract, lookup orchestration, explicit-name precedence, and generated fallback names.
- `packages/localization/src/localization.ts`: dependency-free Solitude locale resolution, unit formatting, and message interpolation. Client/plugin JSON bundles live in their owning package directories.
- `packages/multiplayer/src/runtime.ts`: Solitude-specific authoritative game implementation over the shared headless simulation.
- `packages/multiplayer/src/main.ts`: deployable authoritative server entrypoint.
- `packages/server/src/metrics.ts`: allocation-conscious rotating server metrics for precise snapshot step/serialization/broadcast-loop durations, requested and achieved simulation throughput, backlog, cadence, payload/fanout, process CPU and memory, event-loop delay, and socket counts.
- `packages/client/src/localPrediction.ts`: client-side input prediction state for the assigned ship.
- `packages/client/src/multiplayerSession.ts`: client-owned capability adapter exposing live game/entity identity to multiplayer external plugins.
- `packages/client/src/localReconciliation.ts`: prediction error metrics and render-only visual correction smoothing.
- `packages/plugin-api/src/module.ts`: the minimal external plugin identity, capabilities, focused-entity requirements, grouped hooks, factory, and loaded-module composition seam. All runtime options, capability protocols, world access, render/scene/view contracts, localization, math, and entity-name APIs live in focused sibling subpath modules.
- `packages/engine/src/app/controllableEntityProvider.ts`: canonical generic provider capability for constructing configured controllable entities from direct placements; the external API re-exports it through a controlled subpath.
- `packages/plugin-runtime/src/index.ts`: browser plugin discovery, validation, dynamic import, factory adaptation, and strict catalog composition.
- `packages/plugin-runtime/src/server.ts`: ordered local server plugin-set/pack discovery with pack-host validation and lexical plus real-path containment for every declared document and module entry.
- `packages/multiplayer/src/serverPlugins.ts`: authoritative startup composition that resolves the deployed multiplayer plugin set and discovers its complete content-pack catalog before creating sessions.
- `plugins/core-pack-v1/src/`: external first-party plugin factories. The multi-entry pack build emits one `pack.json`, per-plugin manifests/entries, and shared relative ESM chunks where beneficial.
- `plugins/poly-fighter/src/`: host-neutral poly-fighter gameplay-content plugin factory shared by the separate browser and server content pack builds.
- `plugins/solar-system/src/`: host-neutral solar-system world model, celestial-body and localized-name providers, orbital data, and tests.
- `plugins/autopilot/src/`: host-neutral autopilot control behavior, attitude logic, propulsion integration, and tests.
- `plugins/spacecraft-operator/src/`: shared spacecraft controls and dynamics plus host-specific browser/server entries.
- `plugins/solitude-content-pack/`: shared ordered multi-entry build configuration used by both Solitude content deployment packs.
- `plugins/solitude-content-browser-pack-v1/` and `plugins/solitude-content-server-pack-v1/`: host-specific deployment-pack build wrappers for the shared poly-fighter implementation.
- `plugins/multiplayer-pack-v1/src/`: multiplayer-only external presentation plugin factories for remote identity and localized ship-color names.
- `plugins/standalone-pack-v1/src/`: standalone-only external factories for ships, diagnostic playback, pause and time-scale behavior, memory telemetry, profiling, and operator focus switching.
- `scripts/run-server-load.mjs`: multi-game headless WebSocket load harness with seeded input, simulation-rate control, warm-up/measurement phases, repetitions, client latency, failure detection, and versioned structured results.
- `scripts/run-server-baseline.mjs`: reference/smoke orchestrator that builds once, restarts the production server for every repetition, persists compact trend evidence, and stops the capacity sweep at majority-confirmed saturation.
- `scripts/compare-server-baselines.mjs`: non-blocking Markdown/JSON comparison CLI using the selected reference pointer; reports absolute/percentage deltas, repetition spread, workload coverage, saturation changes, and environment/plugin/protocol identity mismatches.
- `packages/multiplayer/src/__benchmarks__/authoritative.bench.ts`: production-discovered in-process authoritative benchmark separating simulation/runtime snapshot capture, compact encoding, concurrent games, input workloads, and time-scale cost.
- `packages/solitude/src/bootstrap.ts`: Solitude browser app composition.
- `plugins/spacecraft-operator/src/`: spacecraft controls, dynamics, telemetry state, local prediction, input, and forward camera rig.
- `plugins/standalone-pack-v1/src/operator-switch/`: default runtime focus switching between controllable ships.
- `plugins/autopilot/src/`: reusable headless autopilot behavior, control logic, and propulsion integration APIs.
- `plugins/core-pack-v1/src/autopilot-input/`: shared standalone/remote autopilot keyboard mode toggles.
- `plugins/core-pack-v1/src/autopilot-hud/`: standalone/remote localized autopilot status and circle-now diagnostic HUD plugin.
- `plugins/standalone-pack-v1/src/playback/`: diagnostic capture/playback, portable snapshots, and repeatable scenario logs.
- `plugins/standalone-pack-v1/src/time-scale/`: standalone time-scale loop/input/localized-HUD plugin.

## Controls Quick Reference

- Look: `Arrow keys`, reset with `R`.
- Thrust level: `0–9` set magnitude, used by `Space`/`B`.
- Main engine: `Space` forward, `B` backward.
- RCS translation: `N` left, `M` right.
- Attitude: `W/S` pitch, `Q/E` roll, `A/D` yaw.
- Autopilot: `V` align to velocity, `C` align to dominant body, `Z` orbit frame, `X` circle now.
- Camera offset: `U/J` forward/back, `I/K` up/down.
- Remote render diagnostics: `I` toggles interpolation and `P` toggles local prediction.
- Time scale: `[` decrease, `]` increase. In multiplayer this adjusts authoritative server simulation rate; in standalone it adjusts local simulation time scale.
- Pause: `P`.
- Focus switch: `Tab`.
- Orbit drawing: `G`.
- Targeting laser: `T` toggle and acquire the nearest body within the nose-axis cone.
- Profiling HUD toggle: `O`.

## Local Dev Workflow

- `npm run dev` runs `typecheck` + `vitest run` first, then starts Vite with `--host`.
- `npm run dev:server` starts the API/WebSocket server and serves the Vite-backed client landing/viewer pages from the same origin; `npm run dev:client` can still start the remote browser client separately and point at the server with `?server=http://127.0.0.1:8787` or `VITE_SOLITUDE_SERVER_URL`.
- `npm run typecheck` runs TypeScript no-emit.
- `npm run test` runs Vitest once.
- `npm run build` produces three deployables: `dist/server`, `dist/client`, and `dist/standalone`.
- `npm run build:plugins` independently builds external plugin artifacts, rejects bare imports, and assembles the ordered browser and server plugin sets into their deployment trees.
- `npm run build:client`, `npm run build:server`, and `npm run build:standalone` build those targets independently.
- `npm run start:server` starts the authoritative Node server bundle and serves `dist/client` from the same origin when it exists; set `DIST_DIR` to override the built client asset directory.

## Next Steps Snapshot

- The six-slice server performance baseline roadmap is complete: precise
  allocation-conscious metrics, achieved throughput/backlog visibility,
  multi-game load generation, in-process authoritative benchmarks, a named
  WSL2 reference capture, and non-blocking comparison reporting are in place.
  The first confirmed capacity saturation was 32 eight-client games in
  scheduling and transport fanout while simulation throughput stayed near
  100%. Future work needs repeated controlled captures and agreed budgets
  before promoting any metric to a hard gate. See
  `MEMORY_SERVER_PERFORMANCE.md`.
- Gravity plugin extraction is complete: both products discover the required
  external Newtonian provider, high-time-scale intervals use bounded provider
  steps, and the measured typed-array force loop is retained. See
  `archive/MEMORY_GRAVITY_PLUGIN.md`.
- Physical package decoupling is complete: product behavior is selected through independently built runtime deployment units, with only generic host adapters remaining static.
- Headless playback remains unresolved and active as a tracked topic, but is deprioritized until explicitly resumed. See `MEMORY_HEADLESS_PLAYBACK.md`.
- Operator runtime focus switching is extracted and closed; foreground/background UX and declarative input lock policy remain deferred in `archive/MEMORY_OPERATOR_MODEL.md`.

## Open Questions / Risks

- Workspace package exports are intentionally absent unless a package subpath is consumed externally; avoid adding public-looking exports for private implementation seams.
- Some plugin features still use spacecraft or solar-system vocabulary; keep that out of engine/browser unless it is truly generic.
- Default Solitude plugin order is behaviorally significant; preserve ordering-sensitive tests when moving operator switch, profiling, or input plugins.
- Server external plugins support capabilities, control-state/attitude resolution, and the pre-runtime world-model phase. Do not extract authoritative simulation or loop behavior by bypassing that contract; design those lifecycle phases explicitly first.
- Browser plugin discovery allows only explicitly trusted origins and is reinforced by page CSP; server discovery accepts only an explicitly configured contained local plugin set. Loaded plugins remain same-realm trusted code. Unloading, sandboxing, signatures, and inter-plugin dependency resolution are not implemented.
- Newtonian gravity uses provider-owned integration steps bounded to 10
  simulated seconds by default. Extreme time warp preserves that bound by
  spending more wall-clock time, so presentation or server catch-up can become
  compute-bound.
- WebGL2 availability and runtime context loss are hard failures with localized WebGL-required UX; there is no fallback solid-mesh backend.
- Controls are keyboard-only with no in-app help; consider a help overlay or onboarding prompt.
