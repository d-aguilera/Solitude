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

- `MEMORY_PACKAGE_SPLIT.md`: physical package split into `@solitude/engine`, `@solitude/browser`, and `solitude`; includes completed package-split slices and next migration steps.
- `MEMORY_OPERATOR_MODEL.md`: strategy for moving main ship/control/camera behavior into plugin-defined operator modes around a generic focused entity.
- `MEMORY_ENTITY_MODEL.md`: strategy/context for replacing ships/planets/stars core buckets with generic entities/components.
- `MEMORY_HEADLESS_PLAYBACK.md`: planned work for running recorded playback scenarios end-to-end without the browser.
- `MEMORY_PLUGIN_EXTRACTION.md`: older audit notes and candidate list for moving non-core code into plugins.

## Current focus

- **Primary active work**: continue the package split. See `MEMORY_PACKAGE_SPLIT.md` before moving files, changing imports/exports, changing package boundaries, or touching bootstrap/headless composition.
- **Operator/focus boundary**: core/runtime contexts use `mainFocus`/`controlledBody`, and config/world-model APIs use `mainFocusEntityId`.
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
- **Known exception**: `src/global/` / `packages/engine/src/global/` is a deliberate carve-out and may violate onion rules. Do not treat it as a layering issue.
- **Physics**: Newtonian N-body with leapfrog integration for stability.
- **Solar-system data**: use real-ish values (AU, km, approximate J2000 elements) for plausibility.
- **Entity model direction**: core should not know scenario categories such as planet/star/ship. Prefer generic bodies/components/capabilities.
- **Rendering**: default Canvas 2D for portability; WebGL path exists but is not wired by default.
- **Math helpers**: always use math helpers when available for vector/matrix/trig instead of inlining the math.
- **Epsilons**: use shared constants in `packages/engine/src/domain/epsilon.ts` instead of inline literals.

## Package Snapshot

- `packages/engine/src/`: generic domain/app/setup/render/global source plus generic gravity and headless runtime.
- `packages/browser/src/`: DOM/runtime adapters, keyboard input, layout, Canvas 2D, and WebGL rasterizer adapters.
- `packages/solitude/src/`: Solitude app bootstrap, default config, plugin catalog, scenarios, spacecraft operator, playback, telemetry, and product-specific behavior.
- `src/*`: transitional compatibility shims for old import paths, plus `src/architecture/importBoundaries.test.ts`.
- Root Vite config uses `packages/solitude` as the app root and still builds to root `dist`.

## Runtime Flow

- `packages/solitude/index.html` loads `packages/solitude/src/bootstrap.ts`.
- Solitude bootstrap builds config, loads the product plugin set, and calls browser runtime bootstrap.
- `packages/browser/src/infra/domBootstrap.ts` wires DOM input, layout, renderers, game loop, and gravity engine.
- `packages/engine/src/app/game.ts` runs per-tick simulation phases.
- Solitude plugins provide spacecraft controls, vehicle dynamics, camera rigs, HUD readouts, playback behavior, and scenario/world-model content.

## Current State

- Core loop works: input → physics → scene update → render → HUD.
- Runtime world state is generic entity/capability based.
- Solar-system content is contributed by `packages/solitude/src/plugins/solarSystem/`.
- Spacecraft propulsion/RCS/attitude, input bindings, spacecraft operator state, and the primary forward camera rig live in `packages/solitude/src/plugins/spacecraftOperator/`.
- Core owns generic focus, primary-view plumbing, simulation phase order, gravity, spin, collision, setup, render preparation, and plugin port/capability contracts.
- Plugins can declare focused-entity requirements; DOM/headless setup validates them against the assembled world and `mainFocus` with hard setup errors.
- Generic headless runtime does not import or auto-install Solitude spacecraft plugins; Solitude behavior is caller-composed when needed.
- Playback snapshots are v2-only: generic `entities` plus snapshot metadata with `focusEntityId`.
- Tests have moved mostly into owning packages; root `src` keeps only the architecture boundary guard for now.

## Key Files

- `packages/engine/src/infra/NewtonianGravityEngine.ts`: N-body gravity with leapfrog integration.
- `packages/engine/src/infra/headlessGameLoop.ts`: generic headless stepper; callers pass Solitude plugins explicitly when needed.
- `packages/engine/src/setup/sceneSetup.ts`: generic scene graph + trajectory setup.
- `packages/engine/src/render/DefaultViewRenderer.ts`: projection + draw list assembly.
- `packages/browser/src/infra/domBootstrap.ts`: browser runtime composition.
- `packages/solitude/src/bootstrap.ts`: Solitude browser app composition.
- `packages/solitude/src/plugins/spacecraftOperator/`: spacecraft controls, dynamics, telemetry state, and forward camera rig.
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
- Profiling HUD toggle: `O`.

## Local Dev Workflow

- `npm run dev` runs `typecheck` + `vitest run` first, then starts Vite with `--host`.
- `npm run typecheck` runs TypeScript no-emit.
- `npm run test` runs Vitest once.
- `npm run build` / `npm run preview` cover production build/preview.

## Next Steps Snapshot

- Continue package split cleanup from `MEMORY_PACKAGE_SPLIT.md`; the next likely areas are old-path shims, package exports, and root tooling boundaries.
- Continue operator/focus cleanup from `MEMORY_OPERATOR_MODEL.md`; remaining operator work is runtime operator-mode switching above the generic engine boundary.
- Planned future work: Solitude-owned headless playback runner. See `MEMORY_HEADLESS_PLAYBACK.md`.

## Open Questions / Risks

- Root `src/*` compatibility shims are useful during migration but should not become permanent architecture.
- Package exports are broad/transitional and need later narrowing.
- Some plugin features still use spacecraft or solar-system vocabulary; keep that out of engine/browser unless it is truly generic.
- Gravity uses fixed sub-steps for stability; high time scales can still destabilize.
- WebGL path is present but not wired in the default entry.
- Controls are keyboard-only with no in-app help; consider a help overlay or onboarding prompt.
