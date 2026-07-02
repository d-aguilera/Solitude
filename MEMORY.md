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
- **Known exception**: `packages/engine/src/global/` is a deliberate carve-out and may violate onion rules. Do not treat it as a layering issue.
- **Physics**: Newtonian N-body with leapfrog integration for stability.
- **Solar-system data**: use real-ish values (AU, km, approximate J2000 elements) for plausibility.
- **Entity model direction**: core should not know scenario categories such as planet/star/ship. Prefer generic bodies/components/capabilities.
- **Rendering**: WebGL2-native solid-mesh rendering is required. Browser WebGL renders solid meshes plus depth-tested trajectory/world-segment ribbons. `SceneOverlayRenderer` handles renderer-neutral scene overlay projection; the browser Canvas scene overlay draws labels and markers, and the HUD rasterizer draws HUD panels separately.
- **Math helpers**: always use math helpers when available for vector/matrix/trig instead of inlining the math.
- **Epsilons**: use shared constants in `packages/engine/src/domain/epsilon.ts` instead of inline literals.
- **Optional arguments**: avoid optional runtime/plumbing arguments unless absence is semantically meaningful. Prefer required parameters with empty collections or default objects so call sites and implementations do not grow defensive branches.

## Package Snapshot

- `packages/engine/src/`: generic domain/app/setup/render/global source plus generic gravity and headless runtime.
- `packages/hud/src/`: generic HUD grid and HUD panel capability contracts shared by display, browser, client, and Solitude plugins.
- `packages/input/src/`: outer keyboard input-provider contracts; plugins publish bindings/handlers through generic engine capabilities and browser adapters consume them.
- `packages/entity-names/src/`: neutral entity-name provider capability contract and lookup policy; content plugins own provider implementations and localized name bundles.
- `packages/localization/src/`: dependency-free shared Solitude locale resolution and number/unit/message formatting; message bundles remain with their owning client/plugin/content package.
- `packages/sim/src/`: browser-safe and Node-safe Solitude simulation library: default world config, solar-system entity builders/assets and localized names, spacecraft operator dynamics, headless autopilot behavior, and headless Solitude composition shared by server and browser/product packages.
- `packages/display/src/`: browser-safe presentation plugins shared by standalone and remote rendering, including views, labels, telemetry, trajectories, and the input/HUD wrapper around headless autopilot behavior.
- `packages/browser/src/`: DOM/runtime adapters, keyboard input, layered view layout, Canvas presentation, GPU-native WebGL2 presentation, and remote-world mirror helpers.
- `packages/protocol/src/`: browser-safe client/server protocol types and message guards.
- `packages/client/src/`: deployable remote browser client, server URL adapter, HTTP/WebSocket client helpers, keyboard input patching, authoritative snapshot interpolation, and remote rendering composition.
- `packages/server/src/`: Node-oriented authoritative sessions, ticking, protocol transport, and HTTP/WebSocket serving for headless Solitude games.
- `packages/solitude/src/`: Solitude standalone browser app bootstrap, browser/display plugin catalog, playback, telemetry, HUD/readout behavior, and product-specific browser UX.
- Production and test source lives under `packages/*`; the root `src` directory has been removed.
- Root Vite config uses `packages/solitude` as the standalone app root; dedicated Vite configs build `dist/client`, `dist/server`, and `dist/standalone`.

## Runtime Flow

- `packages/solitude/index.html` loads `packages/solitude/src/bootstrap.ts`.
- Solitude bootstrap builds config, loads the product plugin set, and calls browser runtime bootstrap.
- `packages/browser/src/infra/domBootstrap.ts` wires DOM input, layout, renderers, browser frame scheduling, and the gravity engine.
- `packages/engine/src/infra/configuredGamePipeline.ts` constructs the standalone world/scene and creates the engine-owned application pipeline.
- `packages/engine/src/app/gamePipeline.ts` owns plugin assembly, frame policy, simulation, scene/view updates, and per-view render contributions; `packages/engine/src/app/game.ts` runs the per-tick simulation phases.
- `packages/browser/src/infra/domGameLoop.ts` schedules animation frames, invokes the engine pipeline, renders through generic view renderers, and rasterizes scene/HUD overlays.
- Shared Solitude simulation plugins from `@solitude/sim` provide spacecraft controls, vehicle dynamics, headless autopilot behavior, and scenario/world-model content. `@solitude/display` composes autopilot input/HUD presentation around that behavior and owns shared visual plugins; browser-only Solitude plugins provide remaining camera, playback, and standalone UX.
- Solitude plugin order is runtime behavior; later loop/frame-policy plugins can override earlier ones, and capability-backed DOM input handlers are consulted in reverse plugin order.

## Current State

- Core loop works: input → physics → scene update → render → browser overlays.
- Runtime world state is generic entity/capability based.
- Solar-system content is owned by `@solitude/sim`; browser/server/client code import it directly from `@solitude/sim`.
- Body label content is contributed by `packages/solitude/src/plugins/bodyLabels/`; engine owns generic scene-label layout.
- HUD panel contracts are owned by `@solitude/hud`; browser owns the canvas overlay adapter that rasterizes HUD grids.
- Keyboard maps and key handlers are owned by `@solitude/input`, published as plugin capabilities, and consumed by browser DOM input. Engine plugin contracts know semantic control actions but not keyboard/device bindings.
- Main-view lookaround input/camera-offset controls live in `packages/solitude/src/plugins/mainViewLookaround/`.
- Spacecraft propulsion/RCS/attitude, input bindings, spacecraft operator state, and the primary forward camera rig live in `@solitude/sim`; browser/server/client code import them directly from `@solitude/sim`.
- Autopilot `circleNow` uses `autopilot.mode.v2`: a continuous dominant-body circularization controller that aims the main thrust axis at orbital correction while unstable, blends back to inward-facing once stable, and keeps roll referenced to the orbital tangent to avoid stable-orbit roll oscillation. `alignToVelocity` and `alignToBody` remain behavior-compatible with v1.
- The headless autopilot plugin in `@solitude/sim` contributes only control behavior and capabilities. `@solitude/display` owns its keyboard input, localized HUD panel, and message bundles; server/headless composition does not instantiate presentation behavior and `@solitude/sim` does not depend on `@solitude/hud`.
- Runtime focus switching lives in `packages/solitude/src/plugins/operatorSwitch/`; `Tab` swaps foreground focus between `ship:blue` and `ship:red`.
- During playback, `Tab` may switch the viewed focus while recorded controls continue applying to the entity focused when each playback phase was recorded.
- Core owns generic focus, primary-view plumbing, simulation phase order, gravity, spin, collision, setup, render preparation, and plugin port/capability contracts.
- The engine-owned configured game pipeline constructs standalone runtime state and coordinates frame policy, simulation, scene/view updates, and render contributions. Browser runtime code is limited to frame scheduling and presentation adapters.
- Standalone and headless runtimes share simulation-plugin capability/control assembly through `packages/engine/src/app/pluginRuntime.ts`.
- Plugins can declare focused-entity requirements; DOM/headless setup validates them against the assembled world and `mainFocus` with hard setup errors.
- Generic headless runtime does not import or auto-install Solitude spacecraft plugins; Solitude behavior is caller-composed when needed.
- Server runtime lives in `packages/server/src/runtime.ts`; it composes shared `@solitude/sim` headless Solitude code, steps entity-addressed controls, and reuses runtime snapshot storage.
- Remote client lives in `packages/client/`; it can be deployed as static assets, points at a configurable Solitude server, uses per-join participant IDs carried in game links, receives authoritative model/snapshot messages over WebSocket, sends sequenced server-authoritative controls for its assigned ship, predicts the locally controlled ship immediately, smooths reconciliation visually, derives localized ship names from server-assigned display colors, exposes prediction metrics on `window.__solitudePredictionMetrics`, and renders through `@solitude/browser`.
- Remote client composition lives in `packages/client/src/composition.ts`; local prediction is driven through `@solitude/sim/localPrediction` plugin capabilities, not direct plugin-internal imports.
- Standalone and remote rendering share browser-owned layered view presenters. WebGL renders solid meshes natively from renderer-neutral scene meshes and draws trajectory/world-segment ribbons with depth testing; Canvas overlays preserve labels, markers, and HUD.
- The shared display targeting-laser plugin toggles with `T`, locks the collision sphere nearest the focused ship's nose axis, and renders a beam, target-plane miss guide, obstruction cue, or constant-screen-size surface impact marker entirely client-side in standalone and remote play.
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
- `packages/browser/src/infra/domBootstrap.ts`: browser runtime composition.
- `packages/browser/src/infra/remoteWorldMirror.ts`: non-DOM authoritative snapshot apply mirror for future network clients.
- `packages/sim/src/headless.ts`: shared server-safe/browser-safe Solitude headless composition.
- `packages/entity-names/src/entityNames.ts`: neutral entity-name provider capability contract, lookup orchestration, explicit-name precedence, and generated fallback names.
- `packages/localization/src/localization.ts`: dependency-free Solitude locale resolution, unit formatting, and message interpolation. Client/plugin JSON bundles live in their owning package directories.
- `packages/server/src/runtime.ts`: authoritative server runtime composition.
- `packages/server/src/metrics.ts`: rolling server stream metrics for snapshot cadence, payload size, fanout, step timing, and socket counts.
- `packages/client/src/localPrediction.ts`: client-side input prediction state for the assigned ship.
- `packages/client/src/shipColorNames.ts`: remote-client scene plugin that indexes server-assigned ship colors and contributes localized entity names without exposing color through the entity-name port.
- `packages/sim/src/localPrediction.ts`: generic Solitude local-prediction capability contract used by remote clients.
- `packages/client/src/localReconciliation.ts`: prediction error metrics and render-only visual correction smoothing.
- `scripts/run-server-load.mjs`: headless WebSocket load and input-latency harness for local or deployed servers.
- `packages/solitude/src/bootstrap.ts`: Solitude browser app composition.
- `packages/sim/src/plugins/spacecraftOperator/`: spacecraft controls, dynamics, telemetry state, and forward camera rig.
- `packages/solitude/src/plugins/operatorSwitch/`: default runtime focus switching between controllable ships.
- `packages/sim/src/autopilot/`: reusable headless autopilot behavior, input contract, control logic, and propulsion integration APIs.
- `packages/display/src/plugins/autopilot/`: standalone/remote autopilot input, localization, and HUD composition.
- `packages/solitude/src/plugins/playback/`: diagnostic capture/playback and repeatable scenario logs.

## Controls Quick Reference

- Look: `Arrow keys`, reset with `R`.
- Thrust level: `0–9` set magnitude, used by `Space`/`B`.
- Main engine: `Space` forward, `B` backward.
- RCS translation: `N` left, `M` right.
- Attitude: `W/S` pitch, `Q/E` roll, `A/D` yaw.
- Autopilot: `V` align to velocity, `C` align to dominant body, `Z` orbit frame, `X` circle now.
- Camera offset: `U/J` forward/back, `I/K` up/down.
- Time scale: `[` decrease, `]` increase.
- Pause: `P`.
- Focus switch: `Tab`.
- Targeting laser: `T` toggle and acquire the nearest body within the nose-axis cone.
- Profiling HUD toggle: `O`.

## Local Dev Workflow

- `npm run dev` runs `typecheck` + `vitest run` first, then starts Vite with `--host`.
- `npm run dev:server` starts the API/WebSocket server and serves the Vite-backed client landing/viewer pages from the same origin; `npm run dev:client` can still start the remote browser client separately and point at the server with `?server=http://127.0.0.1:8787` or `VITE_SOLITUDE_SERVER_URL`.
- `npm run typecheck` runs TypeScript no-emit.
- `npm run test` runs Vitest once.
- `npm run build` produces three deployables: `dist/server`, `dist/client`, and `dist/standalone`.
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
- Gravity uses fixed sub-steps for stability; high time scales can still destabilize.
- WebGL2 availability and runtime context loss are hard failures with localized WebGL-required UX; there is no fallback solid-mesh backend.
- Controls are keyboard-only with no in-app help; consider a help overlay or onboarding prompt.
