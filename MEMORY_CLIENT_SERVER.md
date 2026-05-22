# Client-Server Architecture Memory

## Purpose

- Track the long-running effort to evolve Solitude from a browser-only app into a client-server application.
- Use this before changing headless runtime, runtime snapshots, package exports, per-entity controls, server packages, network protocol code, or browser remote-state rendering.
- Goal: a Node.js headless authoritative server that hosts games, accepts multiple browser clients, assigns each client a controllable ship, advances the shared simulation, and broadcasts world state to clients.

## Current Direction

- The server should sit on top of `@solitude/engine`; it should not replace the engine.
- Treat the server as an outer adapter parallel to `@solitude/browser`.
- Keep networking, rooms, sockets, latency policy, and session ownership out of the engine.
- Add engine/runtime seams only where they are generic: snapshots, headless orchestration, per-entity control routing, dynamic world mutation, and curated exports.
- Keep Solitude-specific game composition in `packages/solitude` or a Solitude-owned server package.

Target layering:

```txt
@solitude/engine
  ^
@solitude/browser      packages/server
  ^                    ^
solitude app/plugins   solitude app/plugins
```

## Current Assessment

- The codebase is closer to a server-authoritative prototype than a full multiplayer product.
- The engine already owns generic world setup, gravity, collisions, spin, simulation phase ordering, plugin ports, and a basic headless loop.
- Browser runtime is already an outer adapter that composes DOM input, layout, renderers, the game loop, and Solitude plugins.
- Solitude already has multiple controllable ships in the default solar-system model (`ship:blue`, `ship:red`).
- Runtime focus switching currently swaps one local foreground focus between pre-existing ships; multiplayer needs per-client/entity ownership instead of one global foreground operator.
- Playback already has generic entity snapshot capture/apply logic, but it is playback-private and should not become the network sync API as-is.

## Preferred First Architecture

Use an authoritative snapshot server:

- Server owns the authoritative `World`.
- Server receives input states from clients.
- Server applies input to assigned controllable entities.
- Server broadcasts compact world snapshots at a fixed rate.
- Clients render a local copy of the world from snapshots.
- Early clients can apply latest snapshots directly; interpolation/prediction can come later.

Avoid deterministic lockstep for the first version. It would make joining, drift, browser timing, plugin loop policy, and debugging harder than a snapshot server.

## Major Work Streams

1. Generic runtime snapshots
   - Move/generalize playback snapshot capture/apply into engine or another appropriate generic runtime module.
   - Keep snapshot schema entity/capability based.
   - Decide whether snapshot apply mutates an existing world only, creates a world, or supports both.

2. Headless runtime orchestration
   - Keep `createHeadlessLoop` useful as a small direct test stepper.
   - Add a richer headless runtime harness when needed, closer to the non-rendering subset of `domGameLoop`.
   - Support loop plugins and frame policy without DOM, canvas, or `requestAnimationFrame`.

3. Per-entity control routing
   - Replace the one-global-`controlInput` simulation assumption for multiplayer paths.
   - Introduce a generic way to address control input to an entity.
   - Preserve local foreground `mainFocus` behavior for browser single-player.
   - Update spacecraft operator so multiple manually controlled entities can be advanced in one authoritative tick.

4. Server package
   - Add a Node-oriented package only after the lower-level seams are clear enough.
   - Compose Solitude config/plugins explicitly.
   - Do not import browser code.
   - Start with one in-process game instance and two preallocated ships.

5. Browser network mode
   - Add a client runtime path that sends input over the network.
   - Apply authoritative snapshots to a local world/render state.
   - Keep current standalone browser mode intact.

6. Dynamic game/session model
   - Add create/join game support.
   - Initially assign clients to pre-existing ships.
   - Later add dynamic ship creation/removal and any required gravity/index refresh APIs.

## Current Slice

Status: per-entity headless control routing implemented.

First focused slice:

- Added `solitude/headless` as a curated non-browser composition export.
- `createSolitudeHeadlessLoop()` now builds the default Solitude config, loads Solitude plugins, applies world-model contributions, and creates an engine headless loop.
- Added a server-style smoke test that imports `solitude/headless`, verifies `ship:blue` and `ship:red` exist, and proves spacecraft dynamics advances under headless input.
- WebSocket/session work remains intentionally out of scope.
- Dynamic ship spawning remains intentionally out of scope; the proof uses preallocated ships.

Success criteria for the first implementation slice:

- No browser package imports in the server-side proof. Done.
- No networking dependency required yet. Done.
- The proof composes through package exports. Done via `solitude/headless`.
- The simulation advances under Node/headless with Solitude spacecraft behavior installed. Done.
- Tests demonstrate that at least one ship changes state when supplied input. Done in `headlessServerComposition.test.ts`.

Next focused slice:

- Decide the next non-networked server seam.
- Likely candidates:
  - promote generic runtime snapshots out of playback-private code;
  - add a tiny server package/script that uses `solitude/headless` plus `stepWithEntityInputs`;
  - add a headless loop-plugin harness if pause/time-scale/playback behavior becomes relevant.
- Keep browser single-player behavior on the existing global `mainFocus`/`controlInput` path.
- Keep networking out until the server state protocol is clearer.

## Candidate First Implementation Plan

1. Audit server-side import needs
   - `buildWorldAndSceneConfig`
   - `defaultPluginIds`
   - `loadPlugins`
   - `applyWorldModelPlugins`
   - `createHeadlessLoop` or a richer headless harness
   - `createSpacecraftOperatorPlugin` if using a smaller plugin set

2. Curate Solitude exports
   - Export only stable composition helpers needed by non-browser adapters.
   - Keep browser bootstrap private to the browser entry.

3. Add a server/headless smoke test or script
   - Build config.
   - Load Solitude plugins, likely excluding browser-only/render-only plugins if needed.
   - Apply world-model plugins.
   - Create a headless loop.
   - Step with a control input targeting the current single focus.
   - Assert state changed.

4. Record the next gap
   - If one global focus/input blocks controlling both ships in the same tick, document it as the next slice rather than solving it inside the smoke proof.

## Open Design Questions

- Should the first server package be named `@solitude/server`, `solitude-server`, or remain a private `packages/server` adapter?
- Should generic runtime snapshots live in `@solitude/engine/runtime`, `@solitude/engine/world`, or a separate export?
- Should per-entity control routing be a new simulation param, a control capability, or a separate authoritative control plugin?
- Should clients render by mutating a local `World`, or should they render from immutable network snapshots transformed into render-frame caches?
- How much of `domGameLoop` should be split into a reusable app/runtime harness before adding server code?

## Known Risks

- Current package exports are intentionally narrow; server work must not normalize deep imports.
- Default Solitude plugin order is behaviorally significant.
- `mainFocus` is still a global runtime context; multiplayer needs per-client foreground focus and per-entity authoritative controls.
- Playback, pause, time-scale, profiling, and operator-switch plugins may not all make sense on a server.
- Dynamic entity add/remove likely requires explicit world mutation APIs and gravity-state refresh behavior.
- Snapshot bandwidth may become a concern if full entity state is broadcast every frame.

## Completed Slices

- 2026-05-22: Added an opt-in per-entity control path for authoritative headless ticks:
  - `TickParams` / `SimulationPhaseParams` can carry `controlInputsByEntityId`.
  - `HeadlessLoop.stepWithEntityInputs()` accepts entity-addressed control input maps.
  - `spacecraftOperator` uses the map when present to advance multiple manually controlled ships in one tick while preserving the existing single-focus path.
  - `headlessServerComposition.test.ts` now proves `ship:blue` and `ship:red` can both receive controls in one headless Solitude tick.
- 2026-05-22: Added `solitude/headless` and a server-style smoke test proving the default Solitude world can be composed headlessly through public exports and advanced with spacecraft input. This exposed the next real architecture gap as per-entity control routing, not basic server-side composition.
- 2026-05-22: Started client-server architecture memory and set the first work path around a non-networked server/headless composition proof.
