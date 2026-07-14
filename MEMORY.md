# Project Memory

## At-a-glance

- **App**: Solitude — browser-based spaceflight + orbital mechanics sandbox with pilot and picture-in-picture axial views.
- **Core value**: real-ish Newtonian gravity and a controllable spacecraft, rendered in 2D/3D projections.
- **Primary user**: someone exploring orbital dynamics and spacecraft controls.
- **Current strategic direction**: keep the engine generic; keep Solitude-specific spacecraft, solar-system, playback, operator behavior, and client/server gameplay feel work in owning packages/plugins.

## How To Use This File

- Keep this file as a **current-state snapshot and router**.
- Put detailed migration logs, completed slices, and long tactical notes in the relevant spin-off memory doc.
- When a topic grows beyond a few bullets here, move the detail into the spin-off and leave a pointer.

## Spin-off memory docs

### Active

- `MEMORY_CLIENT_SERVER_2.md`: current client/server gameplay-feel roadmap: real-time authoritative loop, snapshot timing/buffering, and local prediction.
- `MEMORY_HEADLESS_PLAYBACK.md`: planned work for running recorded playback scenarios end-to-end without the browser.

### Complete / Archived

- `archive/MEMORY_PACKAGE_SPLIT.md`: archived package-split record for `@solitude/engine`, `@solitude/browser`, and `solitude`; consult before package boundary/export changes.
- `archive/MEMORY_OPERATOR_MODEL.md`: archived strategy for moving main ship/control/camera behavior into plugin-defined operator modes around a generic focused entity.
- `archive/MEMORY_ENTITY_MODEL.md`: archived strategy/context for replacing ships/planets/stars core buckets with generic entities/components.
- `archive/MEMORY_CLIENT_SERVER.md`: archived proof-of-concept client/server migration record and slice log.
- `archive/MEMORY_PLUGIN_EXTRACTION.md`: archived audit notes and candidate list for moving non-core code into plugins.
- `archive/MEMORY_GPU_RENDERING.md`: archived WebGL2-native rendering roadmap covering shared browser presentation, GPU mesh rendering, Canvas overlays, and rollout.
- `archive/MEMORY_GPU_POLYLINES.md`: archived depth-tested WebGL trajectory/world-segment ribbon work.

## Current focus

- **Primary active work**: client/server gameplay feel; the server-owned real-time loop, compact snapshots, load metrics, sequenced inputs, local prediction, and render-only reconciliation are in place. The next phase is restoring smooth remote-entity interpolation without disturbing predicted local flight. See `MEMORY_CLIENT_SERVER_2.md` before changing headless runtime, runtime snapshots, package exports, per-entity controls, server packages, network protocol code, or browser remote-state rendering.
- **GPU rendering state**: WebGL2 is the sole solid-mesh renderer for standalone and remote play. WebGL also owns depth-tested trajectory and world-segment ribbons; Canvas remains for scene labels, markers, and HUD. The engine CPU-face pipeline and Canvas backend have been removed. Historical rendering roadmaps live in `archive/MEMORY_GPU_RENDERING.md` and `archive/MEMORY_GPU_POLYLINES.md`.
- **Operator/focus boundary**: core/runtime contexts use `mainFocus`/`controlledBody`, and config/world-model APIs use `mainFocusEntityId`.
- **Remaining operator follow-ups**: foreground/background UX and declarative input lock policy live in `MEMORY_OPERATOR_MODEL.md`.
- **Retired compatibility names**: keep `mainControlledBody`, `mainControlledEntityId`, `setMainControlledEntityId`, deprecated main-view `pilot*` aliases, `@deprecated` source markers, and core setup `setupShips` naming out of source.

## Must-Do After Code Changes

- Run Prettier on modified files, or the whole codebase if easier.
- Organize imports at the top of modified source files. Prettier uses `prettier-plugin-organize-imports`, but verify when imports move across packages.
- Run: `npm run typecheck`
- Run: `npm run test`
- If you did not run either command, explicitly say “Not run” in the response.

## Non-negotiables and exceptions

- **Performance is paramount**: CPU time, memory consumption, and garbage collection pressure come before everything else.
- **Onion layering**: domain core → app logic → infra adapters. Outer layers depend inward, even if it costs performance.
- **Plugin imports**: plugin implementation modules may be imported only by same-plugin code, tests, or composition modules. `npm run check:boundaries` enforces this with a temporary known-violation baseline; run `node scripts/check-package-boundaries.mjs --fail-known-plugin-imports` to expose the baseline while burning it down.
- **External plugin imports and trust**: packages under `plugins/*` may import only exported `@solitude/plugin-api/*` subpaths from the host workspace; the package deliberately has no root or catch-all plugin export, so plugins select focused module, runtime, capability, controllable-entity, asset, input, HUD, presentation, multiplayer, telemetry, render, scene, view, world, localization, math, entity-name, or manifest surfaces. Their emitted modules must be self-contained and are loaded through versioned manifests with no static host fallback. Browser loading starts from same-origin `plugins/loader.json`; every resolved document/module origin must be explicitly allowed, JSON redirects fail, and page CSP defaults plugin execution to `script-src 'self'`. Server loading starts from an explicitly configured local plugin-set document and requires all pack/plugin documents and declared module entries to remain under its real-path root.
- **Known exception**: `packages/engine/src/global/` is a deliberate carve-out and may violate onion rules. Do not treat it as a layering issue.
- **Physics**: Newtonian N-body with leapfrog integration for stability.
- **Solar-system data**: use real-ish values (AU, km, approximate J2000 elements) for plausibility.
- **Entity model direction**: core should not know scenario categories such as planet/star/ship. Prefer generic bodies/components/capabilities.
- **Rendering**: WebGL2-native solid-mesh rendering is required. Browser WebGL renders solid meshes plus depth-tested trajectory/world-segment ribbons. `SceneOverlayRenderer` handles renderer-neutral scene overlay projection; the browser Canvas scene overlay draws labels and markers, and the HUD rasterizer draws HUD panels separately.
- **Geometry helpers**: always use the dependency-free `@solitude/geometry` vector, matrix, intersection, mesh-volume, and OBJ helpers when available instead of inlining the math. Engine-owned vector/matrix facades retain allocation profiling; external plugins consume the portable implementations through `@solitude/plugin-api/math` and `@solitude/plugin-api/assets`.
- **Epsilons**: use shared constants in `packages/engine/src/domain/epsilon.ts` instead of inline literals.
- **Optional arguments**: avoid optional runtime/plumbing arguments unless absence is semantically meaningful. Prefer required parameters with empty collections or default objects so call sites and implementations do not grow defensive branches.

## Package Snapshot

- `packages/engine/src/`: generic domain/app/setup/render/global source plus generic gravity and headless runtime.
- `packages/geometry/src/`: dependency-free portable vector, matrix, ray/sphere, triangle-mesh volume, and Wavefront OBJ primitives shared by engine and the controlled external plugin API.
- `packages/hud/src/`: generic HUD grid and HUD panel capability contracts shared by browser, client, Solitude, and external plugins.
- `packages/input/src/`: outer keyboard input-provider contracts; plugins publish bindings/handlers through generic engine capabilities and browser adapters consume them.
- `packages/entity-names/src/`: dependency-free canonical entity-name provider capability contract and lookup policy; content plugins own provider implementations and localized name bundles, and the external plugin API re-exports this implementation.
- `packages/localization/src/`: dependency-free shared Solitude locale resolution and number/unit/message formatting; message bundles remain with their owning client/plugin/content package.
- `packages/sim/src/`: browser-safe and Node-safe Solitude simulation library: default world config, solar-system entity builders/assets and localized names, spacecraft operator dynamics, headless autopilot behavior, and headless Solitude composition shared by server and browser/product packages.
- `packages/browser/src/`: DOM/runtime adapters, keyboard input, presentation-frame capabilities, layered view layout, Canvas presentation, GPU-native WebGL2 presentation, and remote-world mirror helpers.
- `packages/protocol/src/`: browser-safe client/server protocol types and message guards.
- `packages/plugin-api/src/`: focused, rootless subpath exports for independently built external plugins. Module composition, runtime options, generic capability primitives, domain capabilities, render/scene/view contracts, world access, localization, math, entity naming, and manifests have distinct surfaces; there is no catch-all `plugin.ts`. Portable geometry and OBJ implementations come from the dependency-free `@solitude/geometry` package, while entity-name capabilities reuse their dependency-free canonical package rather than duplicating policy.
- `packages/plugin-runtime/src/`: strict external plugin-set, pack, and plugin-manifest validation; ordered browser and contained local-server pack expansion; and adaptation into engine plugin factories. Pack schema v2 declares explicit `hosts` arrays, packs are atomic activation units, plugin schema v2 has no environment field, and the former `universal` sentinel is rejected.
- `packages/client/src/`: deployable remote browser client, server URL adapter, HTTP/WebSocket client helpers, keyboard input patching, authoritative snapshot interpolation, and remote rendering composition.
- `packages/server/src/`: Node-oriented authoritative sessions, ticking, protocol transport, and HTTP/WebSocket serving for headless Solitude games.
- `packages/solitude/src/`: Solitude standalone browser app bootstrap, static product plugin catalog, playback, HUD/readout behavior, and product-specific browser UX.
- `plugins/core-pack-v1/`: independently built browser pack discovered at runtime by standalone and remote clients. It contains autopilot-HUD, axial-view, body-label, main-view-lookaround, orbit-segment, orbit-telemetry, runtime-telemetry, ship-telemetry, solar-system-material, targeting-laser, trajectory, and velocity-segment plugins plus pack-owned texture assets.
- `plugins/solitude-content-pack-v1/`: atomic browser-and-server gameplay-content pack currently containing the poly-fighter controllable-entity provider and its OBJ model.
- `plugins/multiplayer-pack-v1/`: independently built multiplayer-only browser plugin pack containing the remote identity HUD and localized ship-color entity names.
- Production and test source lives under `packages/*`; the root `src` directory has been removed.
- Root Vite config uses `packages/solitude` as the standalone app root; dedicated Vite configs build `dist/client`, `dist/server`, and `dist/standalone`.

## Runtime Flow

- `packages/solitude/index.html` loads `packages/solitude/src/bootstrap.ts`.
- Solitude bootstrap discovers and imports the external browser plugin set, combines its factories with the static product catalog, builds config, and calls browser runtime bootstrap.
- `packages/browser/src/infra/domBootstrap.ts` wires DOM input, layout, renderers, browser frame scheduling, and the gravity engine.
- `packages/engine/src/infra/configuredGamePipeline.ts` constructs the standalone world/scene and creates the engine-owned application pipeline.
- `packages/engine/src/app/gamePipeline.ts` owns plugin assembly, frame policy, simulation, scene/view updates, and per-view render contributions; `packages/engine/src/app/game.ts` runs the per-tick simulation phases.
- `packages/browser/src/infra/domGameLoop.ts` schedules animation frames, invokes the engine pipeline, renders through generic view renderers, and rasterizes scene/HUD overlays.
- Shared Solitude simulation plugins from `@solitude/sim` provide spacecraft controls, vehicle dynamics, headless autopilot behavior, autopilot keyboard input, and scenario/world-model content. The external `autopilotHud` plugin provides localized browser presentation around that behavior; browser-only Solitude plugins provide playback and remaining standalone UX.
- Solitude plugin order is runtime behavior; later loop/frame-policy plugins can override earlier ones, and capability-backed DOM input handlers are consulted in reverse plugin order.

## Current State

- Core loop works: input → physics → scene update → render → browser overlays.
- Runtime world state is generic entity/capability based.
- Solar-system content is owned by `@solitude/sim`; browser/server/client code import it directly from `@solitude/sim`.
- Body label content is contributed by the external `bodyLabels` plugin in `core-pack-v1`; engine owns generic scene-label layout.
- HUD panel contracts are owned by `@solitude/hud`, with a matching structural external contract in `@solitude/plugin-api`; browser owns the canvas overlay adapter that rasterizes HUD grids.
- Browser presentation-frame providers let plugins observe local animation-frame cadence without depending on the standalone simulation loop; both standalone and remote hosts publish frame samples through `solitude.browser.presentationFrame.v1`.
- Keyboard maps and key handlers are owned by `@solitude/input`, published as plugin capabilities, and consumed by browser DOM input. Engine plugin contracts know semantic control actions but not keyboard/device bindings.
- Main-view lookaround input/camera-offset controls live in the external `mainViewLookaround` plugin in `core-pack-v1`; both standalone and multiplayer apply them to renderer-local state rather than authoritative simulation input.
- Spacecraft propulsion/RCS/attitude, input bindings, spacecraft operator state, and the primary forward camera rig live in `@solitude/sim`; browser/server/client code import them directly from `@solitude/sim`.
- Autopilot `circleNow` uses `autopilot.mode.v2`: a continuous dominant-body circularization controller that aims the main thrust axis at orbital correction while unstable, blends back to inward-facing once stable, and keeps roll referenced to the orbital tangent to avoid stable-orbit roll oscillation. `alignToVelocity` and `alignToBody` remain behavior-compatible with v1.
- The headless autopilot plugin in `@solitude/sim` contributes control behavior and capabilities, while its sibling input plugin contributes browser keyboard bindings. The external `autopilotHud` plugin in `core-pack-v1` owns the localized HUD panel and message bundles; server/headless composition does not instantiate either browser presentation plugin.
- Runtime focus switching lives in `packages/solitude/src/plugins/operatorSwitch/`; `Tab` swaps foreground focus between `ship:blue` and `ship:red`.
- During playback, `Tab` may switch the viewed focus while recorded controls continue applying to the entity focused when each playback phase was recorded.
- Core owns generic focus, primary-view plumbing, simulation phase order, gravity, spin, collision, setup, render preparation, and plugin port/capability contracts.
- The engine-owned configured game pipeline constructs standalone runtime state and coordinates frame policy, simulation, scene/view updates, and render contributions. Browser runtime code is limited to frame scheduling and presentation adapters.
- Standalone and headless runtimes share simulation-plugin capability/control assembly through `packages/engine/src/app/pluginRuntime.ts`.
- External plugins can declare `requirements.focusEntity` for focused-entity capabilities not guaranteed by `ExternalFocusContext`; the external runtime translates them to the engine's internal `mainFocus` requirement scope, and DOM/headless setup validates them against the assembled world with hard setup errors. External contribution callbacks are grouped under `ExternalPlugin.hooks`.
- Generic headless runtime does not import or auto-install Solitude spacecraft plugins; Solitude behavior is caller-composed when needed.
- Server runtime lives in `packages/server/src/runtime.ts`; it composes shared `@solitude/sim` headless Solitude code, steps entity-addressed controls, and reuses runtime snapshot storage.
- Remote client lives in `packages/client/`; it can be deployed as static assets, points at a configurable Solitude server, uses per-join participant IDs carried in game links, receives authoritative model/snapshot messages over WebSocket, sends sequenced server-authoritative controls for its assigned ship, predicts the locally controlled ship immediately, smooths reconciliation visually, derives localized ship names from server-assigned display colors, exposes prediction metrics on `window.__solitudePredictionMetrics`, and renders through `@solitude/browser`.
- Remote client composition lives in `packages/client/src/composition.ts`; local prediction is driven through `@solitude/sim/localPrediction` plugin capabilities, not direct plugin-internal imports.
- The client-owned `solitude.multiplayer.session.v1` capability exposes live game and assigned-entity ids to external multiplayer presentation plugins without coupling them to DOM fields or protocol state.
- Standalone and remote rendering share browser-owned layered view presenters. WebGL renders solid meshes natively from renderer-neutral scene meshes and draws trajectory/world-segment ribbons with depth testing; Canvas overlays preserve labels, markers, and HUD.
- The external browser-only `core-pack-v1` package currently contributes twelve plugins. Autopilot HUD renders localized mode state and circle-now diagnostics. Axial views registers localized top/front/left/right picture-in-picture cameras. Body labels render capability-provided or generated entity names plus localized distance and speed readouts. Main-view lookaround owns shared renderer-local look rotation, reset, and camera-offset controls. Orbit segments toggle with `G` and render the focused entity's bound analytic orbit around its dominant gravity body. Orbit telemetry renders localized orbit, apsis, circularization, and timing readouts. Runtime telemetry renders localized simulation time and rolling local presentation FPS. Ship telemetry renders localized focused-entity speed and optional spacecraft thrust/RCS state. Solar-system materials applies Earth and Moon texture materials and resolves three pack-owned JPEG assets relative to its loaded module. Targeting laser toggles with `T`, locks the collision sphere nearest the focused ship's nose axis, and renders a beam, target-plane miss guide, obstruction cue, or constant-screen-size surface impact marker. Trajectories maintain sampled ring-buffer polylines for controllable bodies and primary solar-system bodies. Velocity segments render forward/backward world-space lines along the focused entity's velocity. Both browser products discover the pack through same-origin `plugins/loader.json`; no product package statically depends on the plugin package.
- The external `solitude-content-pack-v1` is an atomic browser-and-server pack. It currently contributes `polyFighter`, which owns its OBJ mesh, derived mass, and controllable-entity provider. Both browser products discover the whole pack through their browser plugin sets; authoritative multiplayer discovers the same pack through `dist/server-plugins/multiplayer/plugin-set.json` and activates all of its plugins before creating sessions.
- The external `multiplayer-pack-v1` package contributes `remoteIdentityHud` and `shipColorNames` only to multiplayer. Standalone's assembled plugin set and distribution do not contain the pack. Multiplayer reads both packs through its own same-origin `plugins/loader.json`.
- External plugin sets expand ordered atomic pack manifests, and each independently built pack may contribute multiple ordered runtime plugin manifests. All packs and plugin manifests use strict schema/id validation; pack-host, plugin API, path/origin, duplicate-id, and collision validation complete before module import. Browser loader configuration is a fixed same-origin trust root, defaults to `self`, and JSON fetches reject redirects. Server plugin sets are explicit local trust roots with lexical and real-path containment. Missing, disallowed, incompatible, duplicate, or colliding plugins fail host startup.
- Plugin deployment assembly is target-specific: `plugins/browser-plugin-packs.json` defines standalone/multiplayer browser order, `plugins/server-plugin-packs.json` defines authoritative server order, `dist/plugin-public/<target>` stages browser trees, and `dist/server-plugins/<target>` stages contained local server trees.
- Engine world-segment contributions use renderer-neutral numeric RGB; CSS conversion occurs in the render layer. Engine frame policy uses generic presentation terminology while browser overlays retain browser-owned naming.
- Localization is client-side and server-neutral. Dependency-free `@solitude/localization` resolves `?locale=` or browser-preferred language to `en`/`es`/`fr`, formats numbers/units without thousands grouping, and provides message interpolation. JSON message bundles live with the client/plugin/content package that owns each string. The multiplayer lobby offers a language selector and passes locale through game links; standalone resolves from browser locale unless `?locale=` overrides it.
- Entity `displayName` remains a literal authored override for scene/body labels. The neutral `@solitude/entity-names` port lets entity-contributing plugins provide localized names through `solitude.entityNameProvider.v1`; built-in solar-system names are owned by the solar-system plugin, and custom ids fall back to generated names.
- Shared browser-safe protocol contract lives in `@solitude/protocol`; browser client adapters live in `@solitude/client`.
- Browser remote-world mirror proof lives in `@solitude/browser/remoteWorldMirror`; it applies authoritative runtime snapshots into a local world via a reusable indexed workspace.
- Server-safe Solitude headless composition lives in `@solitude/sim`; `@solitude/server` intentionally does not depend on the browser-facing `solitude` package.
- Playback snapshots are v2-only: generic `entities` plus snapshot metadata with `focusEntityId`.
- Tests have moved into owning packages; root TypeScript/Vitest tooling no longer includes `src`.

## Key Files

- `packages/engine/src/infra/NewtonianGravityEngine.ts`: N-body gravity with leapfrog integration.
- `packages/engine/src/app/gamePipeline.ts`: application-level standalone frame pipeline and per-view contribution preparation.
- `packages/engine/src/app/pluginRuntime.ts`: shared simulation-plugin capability, control, and simulation assembly used by standalone and headless runtimes.
- `packages/engine/src/infra/configuredGamePipeline.ts`: engine composition factory that constructs the world/scene and application pipeline.
- `packages/engine/src/infra/headlessGameLoop.ts`: generic headless stepper; callers pass Solitude plugins explicitly when needed.
- `packages/engine/src/setup/sceneSetup.ts`: generic scene graph + trajectory setup.
- `packages/engine/src/render/SceneOverlayRenderer.ts`: renderer-neutral projection and layout for scene overlays only.
- `packages/geometry/src/index.ts`: dependency-free public geometry surface for vectors, matrices, ray/sphere intersection, mesh volume, and OBJ parsing.
- `packages/browser/src/infra/domBootstrap.ts`: browser runtime composition.
- `packages/browser/src/infra/remoteWorldMirror.ts`: non-DOM authoritative snapshot apply mirror for future network clients.
- `packages/sim/src/headless.ts`: shared server-safe/browser-safe Solitude headless composition.
- `packages/entity-names/src/entityNames.ts`: neutral entity-name provider capability contract, lookup orchestration, explicit-name precedence, and generated fallback names.
- `packages/localization/src/localization.ts`: dependency-free Solitude locale resolution, unit formatting, and message interpolation. Client/plugin JSON bundles live in their owning package directories.
- `packages/server/src/runtime.ts`: authoritative server runtime composition.
- `packages/server/src/metrics.ts`: rolling server stream metrics for snapshot cadence, payload size, fanout, step timing, and socket counts.
- `packages/client/src/localPrediction.ts`: client-side input prediction state for the assigned ship.
- `packages/client/src/multiplayerSession.ts`: client-owned capability adapter exposing live game/entity identity to multiplayer external plugins.
- `packages/sim/src/localPrediction.ts`: generic Solitude local-prediction capability contract used by remote clients.
- `packages/client/src/localReconciliation.ts`: prediction error metrics and render-only visual correction smoothing.
- `packages/plugin-api/src/module.ts`: the minimal external plugin identity, capabilities, focused-entity requirements, grouped hooks, factory, and loaded-module composition seam. All runtime options, capability protocols, world access, render/scene/view contracts, localization, math, and entity-name APIs live in focused sibling subpath modules.
- `packages/engine/src/app/controllableEntityProvider.ts`: canonical generic provider capability for constructing configured controllable entities from direct placements; the external API re-exports it through a controlled subpath.
- `packages/plugin-runtime/src/index.ts`: browser plugin discovery, validation, dynamic import, factory adaptation, and strict catalog composition.
- `packages/plugin-runtime/src/server.ts`: ordered local server plugin-set/pack discovery with pack-host validation and lexical plus real-path containment for every declared document and module entry.
- `packages/multiplayer/src/serverPlugins.ts`: authoritative startup composition that resolves the deployed multiplayer plugin set and discovers its complete content-pack catalog before creating sessions.
- `plugins/core-pack-v1/src/`: external first-party plugin factories. The multi-entry pack build emits one `pack.json`, per-plugin manifests/entries, and shared relative ESM chunks where beneficial.
- `plugins/solitude-content-pack-v1/src/`: external gameplay-content plugin factories shared by browser and server hosts; currently owns poly-fighter.
- `plugins/multiplayer-pack-v1/src/`: multiplayer-only external presentation plugin factories for remote identity and localized ship-color names.
- `scripts/run-server-load.mjs`: headless WebSocket load and input-latency harness for local or deployed servers.
- `packages/solitude/src/bootstrap.ts`: Solitude browser app composition.
- `packages/sim/src/plugins/spacecraftOperator/`: spacecraft controls, dynamics, telemetry state, and forward camera rig.
- `packages/solitude/src/plugins/operatorSwitch/`: default runtime focus switching between controllable ships.
- `packages/sim/src/autopilot/`: reusable headless autopilot behavior, input contract, control logic, and propulsion integration APIs.
- `plugins/core-pack-v1/src/autopilot-hud/`: standalone/remote localized autopilot status and circle-now diagnostic HUD plugin.
- `packages/solitude/src/plugins/playback/`: diagnostic capture/playback and repeatable scenario logs.

## Controls Quick Reference

- Look: `Arrow keys`, reset with `R`.
- Thrust level: `0–9` set magnitude, used by `Space`/`B`.
- Main engine: `Space` forward, `B` backward.
- RCS translation: `N` left, `M` right.
- Attitude: `W/S` pitch, `Q/E` roll, `A/D` yaw.
- Autopilot: `V` align to velocity, `C` align to dominant body, `Z` orbit frame, `X` circle now.
- Camera offset: `U/J` forward/back, `I/K` up/down.
- Remote render diagnostics: `Shift+I` toggles interpolation and `P` toggles local prediction.
- Time scale: `[` decrease, `]` increase.
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
- `npm run build:plugins` independently builds external plugin artifacts, rejects bare imports, and assembles the ordered browser plugin set copied into browser deployables.
- `npm run build:client`, `npm run build:server`, and `npm run build:standalone` build those targets independently.
- `npm run start:server` starts the authoritative Node server bundle and serves `dist/client` from the same origin when it exists; set `DIST_DIR` to override the built client asset directory.

## Next Steps Snapshot

- Active path: client/server gameplay feel; keep local prediction/reconciliation stable and restore smooth remote-entity interpolation with an ordered authoritative snapshot buffer. See `MEMORY_CLIENT_SERVER_2.md`.
- Package split migration is closed; future package work is normal API curation.
- Operator runtime focus switching series is closed; remaining operator-model work is foreground/background UX and declarative input lock policy. See `MEMORY_OPERATOR_MODEL.md`.
- Planned future work: Solitude-owned headless playback runner. See `MEMORY_HEADLESS_PLAYBACK.md`.

## Open Questions / Risks

- Workspace package exports are intentionally absent unless a package subpath is consumed externally; avoid adding public-looking exports for private implementation seams.
- Some plugin features still use spacecraft or solar-system vocabulary; keep that out of engine/browser unless it is truly generic.
- Default Solitude plugin order is behaviorally significant; preserve ordering-sensitive tests when moving playback, operator switch, pause, profiling, or input plugins.
- Browser plugin discovery allows only explicitly trusted origins and is reinforced by page CSP; server discovery accepts only an explicitly configured contained local plugin set. Loaded plugins remain same-realm trusted code. Unloading, sandboxing, signatures, and inter-plugin dependency resolution are not implemented.
- Gravity uses fixed sub-steps for stability; high time scales can still destabilize.
- WebGL2 availability and runtime context loss are hard failures with localized WebGL-required UX; there is no fallback solid-mesh backend.
- Controls are keyboard-only with no in-app help; consider a help overlay or onboarding prompt.
