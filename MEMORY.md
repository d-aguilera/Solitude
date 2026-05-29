# Project Memory

## At-a-glance

- **App**: Solitude — browser-based spaceflight + orbital mechanics sandbox with pilot and picture-in-picture axial views.
- **Core value**: real-ish Newtonian gravity and a controllable spacecraft, rendered in 2D/3D projections.
- **Primary user**: someone exploring orbital dynamics and spacecraft controls.
- **Current strategic direction**: keep the engine generic; keep Solitude-specific spacecraft, solar-system, playback, and operator behavior in the Solitude package/plugins.

## How To Use This File

- Keep this file as a **current-state snapshot and router**.
- Put detailed migration logs, completed slices, and long tactical notes in the relevant spin-off memory doc.
- When a topic grows beyond a few bullets here, move the detail into the spin-off and leave a pointer.

## Spin-off memory docs

- `MEMORY_PACKAGE_SPLIT.md`: archived package-split record for `@solitude/engine`, `@solitude/browser`, and `solitude`; consult before package boundary/export changes.
- `MEMORY_OPERATOR_MODEL.md`: strategy for moving main ship/control/camera behavior into plugin-defined operator modes around a generic focused entity.
- `MEMORY_ENTITY_MODEL.md`: strategy/context for replacing ships/planets/stars core buckets with generic entities/components.
- `MEMORY_CLIENT_SERVER.md`: strategy and slice log for evolving Solitude into a Node headless server plus browser clients.
- `MEMORY_HEADLESS_PLAYBACK.md`: planned work for running recorded playback scenarios end-to-end without the browser.
- `MEMORY_PLUGIN_EXTRACTION.md`: older audit notes and candidate list for moving non-core code into plugins.

## Current focus

- **Primary active work**: client-server architecture; per-entity headless control routing, generic runtime snapshots, shared protocol/client helpers, server sessions/transport, production-like server asset serving, and first-class remote browser rendering are implemented. See `MEMORY_CLIENT_SERVER.md` before changing headless runtime, runtime snapshots, package exports, per-entity controls, server packages, network protocol code, or browser remote-state rendering.
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
- **Known exception**: `packages/engine/src/global/` is a deliberate carve-out and may violate onion rules. Do not treat it as a layering issue.
- **Physics**: Newtonian N-body with leapfrog integration for stability.
- **Solar-system data**: use real-ish values (AU, km, approximate J2000 elements) for plausibility.
- **Entity model direction**: core should not know scenario categories such as planet/star/ship. Prefer generic bodies/components/capabilities.
- **Rendering**: default Canvas 2D for portability; WebGL path exists but is not wired by default.
- **Math helpers**: always use math helpers when available for vector/matrix/trig instead of inlining the math.
- **Epsilons**: use shared constants in `packages/engine/src/domain/epsilon.ts` instead of inline literals.
- **Optional arguments**: avoid optional runtime/plumbing arguments unless absence is semantically meaningful. Prefer required parameters with empty collections or default objects so call sites and implementations do not grow defensive branches.

## Package Snapshot

- `packages/engine/src/`: generic domain/app/setup/render/global source plus generic gravity and headless runtime.
- `packages/sim/src/`: browser-safe and Node-safe Solitude simulation library: default world config, solar-system entity builders/assets, spacecraft operator dynamics, autopilot logic, and headless Solitude composition shared by server and browser/product packages.
- `packages/browser/src/`: DOM/runtime adapters, keyboard input, layout, Canvas 2D, WebGL rasterizer adapters, and remote-world mirror helpers.
- `packages/protocol/src/`: browser-safe client/server protocol types and message guards.
- `packages/client/src/`: deployable remote browser client, server URL adapter, HTTP/WebSocket client helpers, keyboard input patching, authoritative snapshot interpolation, and remote rendering composition.
- `packages/server/src/`: Node-oriented authoritative sessions, ticking, protocol transport, and HTTP/WebSocket serving for headless Solitude games.
- `packages/solitude/src/`: Solitude standalone browser app bootstrap, browser/display plugin catalog, playback, telemetry, HUD/readout behavior, and product-specific browser UX.
- Production and test source lives under `packages/*`; the root `src` directory has been removed.
- Root Vite config uses `packages/solitude` as the standalone app root; dedicated Vite configs build `dist/client`, `dist/server`, and `dist/standalone`.

## Runtime Flow

- `packages/solitude/index.html` loads `packages/solitude/src/bootstrap.ts`.
- Solitude bootstrap builds config, loads the product plugin set, and calls browser runtime bootstrap.
- `packages/browser/src/infra/domBootstrap.ts` wires DOM input, layout, renderers, game loop, and gravity engine.
- `packages/engine/src/app/game.ts` runs per-tick simulation phases.
- Shared Solitude simulation plugins from `@solitude/sim` provide spacecraft controls, vehicle dynamics, autopilot behavior, and scenario/world-model content; browser-only Solitude plugins provide camera rigs, HUD overlay/readout behavior, playback behavior, and standalone UX.
- Solitude plugin order is runtime behavior; later loop/frame-policy plugins can override earlier ones, and DOM input handlers are consulted in reverse plugin order.

## Current State

- Core loop works: input → physics → scene update → render → browser overlays.
- Runtime world state is generic entity/capability based.
- Solar-system content is owned by `@solitude/sim` and re-exported through browser Solitude wrappers where needed.
- Body label content is contributed by `packages/solitude/src/plugins/bodyLabels/`; engine owns generic scene-label layout.
- Main-view lookaround input/camera-offset controls live in `packages/solitude/src/plugins/mainViewLookaround/`.
- Spacecraft propulsion/RCS/attitude, input bindings, spacecraft operator state, and the primary forward camera rig live in `@solitude/sim` and are re-exported through browser Solitude wrappers where needed.
- Runtime focus switching lives in `packages/solitude/src/plugins/operatorSwitch/`; `Tab` swaps foreground focus between `ship:blue` and `ship:red`.
- During playback, `Tab` may switch the viewed focus while recorded controls continue applying to the entity focused when each playback phase was recorded.
- Core owns generic focus, primary-view plumbing, simulation phase order, gravity, spin, collision, setup, render preparation, and plugin port/capability contracts.
- Plugins can declare focused-entity requirements; DOM/headless setup validates them against the assembled world and `mainFocus` with hard setup errors.
- Generic headless runtime does not import or auto-install Solitude spacecraft plugins; Solitude behavior is caller-composed when needed.
- Server runtime proof lives in `packages/server/src/runtime.ts`; it composes shared `@solitude/sim` headless Solitude code, steps entity-addressed controls, and reuses runtime snapshot storage.
- Remote client lives in `packages/client/`; it can be deployed as static assets, points at a configurable Solitude server, receives authoritative model/snapshot messages over WebSocket, sends server-authoritative controls for its assigned ship, interpolates locally, and renders through `@solitude/browser`.
- Shared browser-safe protocol contract lives in `@solitude/protocol`; browser client adapters live in `@solitude/client`.
- Browser remote-world mirror proof lives in `@solitude/browser/remoteWorldMirror`; it applies authoritative runtime snapshots into a local world via a reusable indexed workspace.
- Server-safe Solitude headless composition lives in `@solitude/sim`; `@solitude/server` intentionally does not depend on the browser-facing `solitude` package.
- Playback snapshots are v2-only: generic `entities` plus snapshot metadata with `focusEntityId`.
- Tests have moved into owning packages; root TypeScript/Vitest tooling no longer includes `src`.

## Key Files

- `packages/engine/src/infra/NewtonianGravityEngine.ts`: N-body gravity with leapfrog integration.
- `packages/engine/src/infra/headlessGameLoop.ts`: generic headless stepper; callers pass Solitude plugins explicitly when needed.
- `packages/engine/src/setup/sceneSetup.ts`: generic scene graph + trajectory setup.
- `packages/engine/src/render/DefaultViewRenderer.ts`: projection + draw list assembly.
- `packages/browser/src/infra/domBootstrap.ts`: browser runtime composition.
- `packages/browser/src/infra/remoteWorldMirror.ts`: non-DOM authoritative snapshot apply mirror for future network clients.
- `packages/sim/src/headless.ts`: shared server-safe/browser-safe Solitude headless composition.
- `packages/server/src/runtime.ts`: non-networked authoritative server runtime proof.
- `packages/solitude/src/bootstrap.ts`: Solitude browser app composition.
- `packages/solitude/src/plugins/spacecraftOperator/`: spacecraft controls, dynamics, telemetry state, and forward camera rig.
- `packages/solitude/src/plugins/operatorSwitch/`: default runtime focus switching between controllable ships.
- `packages/solitude/src/plugins/autopilot/logic.ts`: align-to-velocity/body and “circle now”.
- `packages/solitude/src/plugins/playback/`: diagnostic capture/playback and repeatable scenario logs.

## Controls Quick Reference

- Look: `Arrow keys`, reset with `R`.
- Thrust level: `0–9` set magnitude, used by `Space`/`B`.
- Main engine: `Space` forward, `B` backward.
- RCS translation: `N` left, `M` right.
- Attitude: `W/S` pitch, `Q/E` roll, `A/D` yaw.
- Autopilot: `V` align to velocity, `C` align to dominant body, `X` circle now.
- Camera offset: `U/J` forward/back, `I/K` up/down.
- Time scale: `[` decrease, `]` increase.
- Pause: `P`.
- Focus switch: `Tab`.
- Profiling HUD toggle: `O`.

## Local Dev Workflow

- `npm run dev` runs `typecheck` + `vitest run` first, then starts Vite with `--host`.
- `npm run dev:server` starts the API/WebSocket server only; `npm run dev:client` starts the remote browser client and can point at the server with `?server=http://127.0.0.1:8787` or `VITE_SOLITUDE_SERVER_URL`.
- `npm run typecheck` runs TypeScript no-emit.
- `npm run test` runs Vitest once.
- `npm run build` produces three deployables: `dist/server`, `dist/client`, and `dist/standalone`.
- `npm run build:client`, `npm run build:server`, and `npm run build:standalone` build those targets independently.
- `npm run start:server` starts the authoritative Node server bundle; set `DIST_DIR=dist/client` only for optional single-origin serving of built client assets.

## Next Steps Snapshot

- Active path: client-server architecture; server/session/protocol, WebSocket interactive transport, dynamic join/leave/disconnect ship models, production-like asset serving, and browser remote rendering are in place. See `MEMORY_CLIENT_SERVER.md`.
- Package split migration is closed; future package work is normal API curation.
- Operator runtime focus switching series is closed; remaining operator-model work is foreground/background UX and declarative input lock policy. See `MEMORY_OPERATOR_MODEL.md`.
- Planned future work: Solitude-owned headless playback runner. See `MEMORY_HEADLESS_PLAYBACK.md`.

## Open Questions / Risks

- Workspace package exports are intentionally absent unless a package subpath is consumed externally; avoid adding public-looking exports for private implementation seams.
- Some plugin features still use spacecraft or solar-system vocabulary; keep that out of engine/browser unless it is truly generic.
- Default Solitude plugin order is behaviorally significant; preserve ordering-sensitive tests when moving playback, operator switch, pause, profiling, or input plugins.
- Gravity uses fixed sub-steps for stability; high time scales can still destabilize.
- WebGL path is present but not wired in the default entry.
- Controls are keyboard-only with no in-app help; consider a help overlay or onboarding prompt.
