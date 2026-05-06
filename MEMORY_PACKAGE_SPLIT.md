# Package Split Memory

## Purpose

- Dedicated context for physically splitting the Solitude codebase into engine, browser adapter, and Solitude app/scenario packages.
- Use this before moving files, changing package boundaries, changing public exports, or touching bootstrap/headless composition.
- Goal: make the already mostly-generic core engine usable as a real library, while Solitude remains the solar-system spacecraft simulation built on top.

## Strategic Direction

Use an npm-workspace monorepo first, not separate repositories.

Target package shape:

```text
packages/
  engine/
    src/domain/
    src/app/
    src/setup/
    src/render/
    src/global/
    src/infra/NewtonianGravityEngine.ts
    src/index.ts

  browser/
    src/infra/dom*
    src/rasterize/
    src/index.ts

  solitude/
    src/bootstrap.ts
    src/plugins/
    index.html
    index.css
```

The split should enforce the intended dependency direction:

```text
solitude app/scenario -> browser adapters -> engine
solitude app/scenario -> engine
browser adapters -> engine
engine -> no solitude/browser app imports
```

- `engine` owns generic simulation contracts and deterministic orchestration.
- `browser` owns DOM/canvas/WebGL runtime adapters.
- `solitude` owns the actual solar-system spacecraft experience, plugin catalog, scenario data, playback scripts, and top-level app bootstrap.

## Package Responsibilities

### `@solitude/engine`

Owns:

- Generic entity/capability world model.
- Focus context and focused-entity validation.
- Plugin port types and generic plugin capability registry.
- Deterministic tick/simulation phase orchestration.
- Physics/math primitives and gravity/collision/spin helpers.
- World/config setup from generic entity definitions.
- Scene graph and render preparation contracts.
- Generic headless stepping primitives. As of Phase 0, callers pass product plugins into headless composition when they need them.
- `NewtonianGravityEngine`, unless a later split creates an `engine-newtonian` adapter package.

Does not own:

- Solar-system body data.
- Spacecraft controls, thrust/RCS, autopilot, or ship telemetry.
- Solitude plugin catalog/default plugin ids.
- Browser DOM, canvas, keyboard, URL, or Vite app entrypoint details.

### `@solitude/browser`

Owns:

- DOM bootstrap helpers.
- Canvas 2D and WebGL surface/rasterizer adapters.
- Keyboard input adapter.
- View layout and canvas element creation.
- Runtime option parsing from browser URL search params, unless this becomes app-specific.

Depends on `@solitude/engine`, but must not import `@solitude/app` or Solitude plugins.

### `solitude`

Owns:

- Browser app entrypoint and final runtime composition.
- Default plugin catalog and plugin order.
- Solar-system scenario content.
- Spacecraft operator behavior.
- Autopilot, ship telemetry, orbit/trajectory UX, playback scripts, diagnostics, and other product-specific plugins.
- App shell assets such as `index.html`, `index.css`, and favicon.

Depends on `@solitude/engine` and `@solitude/browser`.

## Current Boundary State

The conceptual split is mostly in place:

- Core source uses generic `mainFocus` / `controlledBody` terminology.
- Runtime `World` is generic entity/capability based.
- Solar-system content is plugin-owned in `src/plugins/solarSystem/`.
- Spacecraft controls, vehicle dynamics, telemetry state, and primary forward camera rig are plugin-owned in `src/plugins/spacecraftOperator/`.
- Core plugin-to-plugin protocols use an opaque capability registry.
- Playback snapshots are generic entity/focus schema only.

Remaining physical-boundary issues:

- `src/bootstrap.ts` imports the Solitude plugin catalog directly.
- `src/plugins/index.ts` is a product-level catalog living beside engine code.
- Tests currently assume one package root and one `src` tree.
- Imports are relative; package exports do not yet enforce boundaries.

Phase 0 completed boundary hardening:

- `src/infra/headlessGameLoop.ts` no longer imports or auto-installs `spacecraftOperator`.
- `createHeadlessLoop` accepts composed `GamePlugin[]` from the caller and derives control plugins, capability providers, focused-entity requirements, and simulation contributions from that list.
- Headless tests now cover both generic stepping without Solitude plugins and Solitude spacecraft dynamics when `createSpacecraftOperatorPlugin()` is passed explicitly.

## Relationship To Other Memory Docs

### `MEMORY_OPERATOR_MODEL.md`

This package split should preserve the operator-model boundary:

- Core/engine owns generic focus, main-view plumbing, plugin ports, phase order, and capability registry.
- Solitude plugins own spacecraft operation, camera rigs, HUD assumptions, autopilot behavior, and future operator modes.
- Runtime operator-mode switching, if implemented during or after the split, belongs above the engine boundary unless the switching mechanism is generic.

Guardrails from that doc still apply:

- No `mainControlledBody` or `mainControlledEntityId` compatibility names should return.
- Core should not regain thrust, RCS, attitude, cockpit, or ship telemetry assumptions.
- Peer plugin protocols should stay capability-mediated rather than static imports between Solitude plugins.

### `MEMORY_ENTITY_MODEL.md`

The entity model is the foundation that makes the engine package viable:

- `@solitude/engine` should expose generic entity/config/world types.
- It should not expose fixed planet/star/ship buckets.
- Scenario vocabulary such as solar-system ids and spacecraft file names can remain in `solitude`.
- Capability arrays and low-allocation hot paths should be preserved during file moves.

### `MEMORY_PLUGIN_EXTRACTION.md`

Plugin extraction becomes a package-boundary question:

- Product/scenario plugins live in `solitude`.
- Only truly generic plugins should be considered for an eventual shared plugin package, and that should wait until duplication or reuse pressure appears.
- Orbit readout helpers remain a candidate for further extraction/splitting: generic orbital math may belong in `engine`; HUD/autopilot readouts should stay in Solitude plugins if they are product-specific.

### `MEMORY_HEADLESS_PLAYBACK.md`

The package split impacts headless playback directly:

- The simple headless loop should become generic engine functionality and stop installing `spacecraftOperator` by default.
- A Solitude-owned headless playback runner can compose engine headless runtime plus Solitude plugins.
- URL-equivalent playback scenarios such as `random-trip` should be runnable from the Solitude package without adding playback knowledge to the engine.

## Proposed Migration Plan

### Phase 0: Boundary Hardening In Place

Purpose: reduce risk before moving directories.

- Remove Solitude plugin imports from generic infra/headless code. Completed for `src/infra/headlessGameLoop.ts`.
- Make headless setup accept all required simulation/control/capability plugins from the caller. Completed for `createHeadlessLoop`.
- Keep Solitude's default browser bootstrap responsible for installing the spacecraft operator and other product plugins.
- Add guard checks or tests for no imports from generic layers into `src/plugins`.
- Identify the minimal engine public API needed by current Solitude plugins.

### Phase 1: Workspace Skeleton

- Convert root package to npm workspaces.
- Create `packages/engine`, `packages/browser`, and `packages/solitude`.
- Add package-local `package.json`, `tsconfig.json`, and public `src/index.ts` files.
- Keep behavior unchanged while package names and build/test scripts settle.

### Phase 2: Move Engine Code

- Move generic source into `packages/engine/src`.
- Start with `domain`, `app`, `setup`, `render`, `global`, and `NewtonianGravityEngine`.
- Export only intentional public APIs from `@solitude/engine`.
- Use package imports from Solitude/browser code instead of deep relative paths across package boundaries.
- Keep internal engine imports relative inside the package.

### Phase 3: Move Browser Adapters

- Move DOM bootstrap, keyboard input, layout, canvas, and WebGL rasterizer code into `packages/browser/src`.
- Make browser adapters consume only exported engine APIs.
- Keep browser package free of Solitude plugin/catalog imports.

### Phase 4: Move Solitude App And Plugins

- Move `bootstrap.ts`, `plugins`, app HTML/CSS/assets, and default runtime composition into `packages/solitude`.
- Make the Solitude app compose:
  - engine config/setup utilities;
  - browser runtime bootstrap;
  - Solitude plugin catalog and default plugin ids.
- Keep solar-system and spacecraft vocabulary here unless it is truly generic.

### Phase 5: Test And Tooling Cleanup

- Move tests with their owning packages.
- Add root scripts for full typecheck/test/build.
- Add package-level scripts where useful.
- Ensure Prettier covers all package source and memory docs.
- Consider an import-boundary lint/test if TypeScript exports are not enough.

### Phase 6: Optional Later Hardening

- Consider a separate shared plugin package only after repeated reuse pressure.
- Consider separate repos only after the monorepo package API is stable and boring.
- Consider splitting `NewtonianGravityEngine` into an adapter package only if the engine core needs multiple gravity backends.

## Completed Slice: Package Split 2

Status: implemented after the `Package split 1` planning commit.

What changed:

1. Refactored `src/infra/headlessGameLoop.ts` so it no longer imports `src/plugins/spacecraftOperator`.
2. Added `HeadlessLoopOptions.plugins` for caller-owned plugin composition.
3. Derived headless control plugins, capability providers, requirement validation, and simulation contributions from the supplied plugin list.
4. Updated tests to prove generic headless stepping works without Solitude plugins and Solitude-flavored headless stepping works when the spacecraft plugin is supplied.

Why first:

- It is small and reversible.
- It converts the most obvious current physical-boundary violation into an explicit composition choice.
- It supports the future headless playback runner split.

Verification:

- Prettier, `npm run typecheck`, and `npm run test` passed for this slice.

## Next Implementation Slice

Recommended next code slice:

1. Add a lightweight import-boundary guard test or script for the pre-package tree.
2. Fail if generic source areas (`src/app`, `src/domain`, `src/render`, `src/setup`, and generic `src/infra` files) import from `src/plugins`.
3. Decide whether `src/global` is exempt in this guard, matching the known onion exception in `MEMORY.md`.
4. Keep the guard narrow enough that the package move can replace it later with package `exports` enforcement.

## Public API Sketch

Engine exports should initially be conservative. Prefer adding exports as real consumers need them rather than exposing whole internal trees.

Likely engine exports:

```ts
export type {
  EntityConfig,
  GamePlugin,
  RuntimeOptions,
  World,
  WorldAndSceneConfig,
} from "./app-or-domain-public-paths";

export {
  applyWorldModelPlugins,
  createPluginCapabilityRegistry,
  createScene,
  createTickHandler,
  createWorld,
  createHeadlessWorld,
  NewtonianGravityEngine,
  validatePluginRequirements,
} from "./public-paths";
```

Likely browser exports:

```ts
export {
  bootstrapWithCanvas,
  bootstrapWithWebGL,
  parseRuntimeOptionsFromSearch,
} from "./public-paths";
```

Exact names should follow the code that exists when each package is created.

## Guardrails

- Keep performance as the first constraint; file moves must not introduce allocation-heavy abstractions in hot loops.
- Preserve onion layering inside `@solitude/engine`.
- Do not make engine depend on package-local Solitude concepts to avoid a short migration.
- Do not publish broad deep exports just to make imports easier.
- Keep changes incremental and test-backed.
- Do not reintroduce category-shaped world buckets or spacecraft assumptions in engine APIs.
- Treat package boundaries as architectural tests: if a file needs a Solitude plugin import, it probably belongs in `solitude`, not `engine` or `browser`.

## Open Questions

- Should browser URL option parsing live in `browser` or `solitude` once runtime options become more product-specific?
- Should `render` stay entirely in `engine`, or should some renderer-facing formatting/helpers move with browser adapters?
- Should generic utility plugins such as pause/time-scale/profiling remain in Solitude initially or move to a later shared plugin package?
- How strict should package `exports` be during migration: narrow from day one, or temporary migration exports with a cleanup checklist?
- Should headless playback be implemented before or after the physical package move?

## Verification Notes

- This document was created as planning context only.
- No package split code changes have been performed yet.
- After future code changes, follow `MEMORY.md`: run Prettier, organize imports, `npm run typecheck`, and `npm run test`.
