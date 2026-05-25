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

- The codebase now has a browser-testable server-authoritative protocol probe, but it is still closer to an architecture prototype than a full multiplayer product.
- The engine already owns generic world setup, gravity, collisions, spin, simulation phase ordering, plugin ports, and a basic headless loop.
- Browser runtime is already an outer adapter that composes DOM input, layout, renderers, the game loop, and Solitude plugins.
- Solitude already has multiple controllable ships in the default solar-system model (`ship:blue`, `ship:red`).
- Runtime focus switching currently swaps one local foreground focus between pre-existing ships; multiplayer needs per-client/entity ownership instead of one global foreground operator.
- Generic runtime snapshot capture/apply now lives in `@solitude/engine/runtime`.
- Server/session/protocol code exists in `@solitude/server` and can create games, join clients to preallocated ships, accept entity-owned input, step the authoritative world, and emit snapshots.
- A minimal HTTP/SSE probe runs with `npm run dev:server` and can be exercised from a browser. It is a probe, not the final transport architecture.
- Browser remote-world mirror code can apply authoritative snapshots into a local engine `World`.
- Browser remote-world renderer code can now render authoritative snapshots from that mirror into the engine `RenderedView` path, including scene init/update, labels, segments, camera updates, and optional rasterization.
- The HTTP/SSE probe still uses its direct snapshot canvas; it is not yet wired to the browser remote renderer because the probe is served as static assets without a browser module bundle.

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
   - Generic capture/apply exists in `@solitude/engine/runtime`.
   - Snapshot storage and apply workspaces support reusable allocation patterns.
   - Remaining work: compact deltas, schema/version policy, bandwidth strategy, interpolation metadata.

2. Headless runtime orchestration
   - Keep `createHeadlessLoop` useful as a small direct test stepper.
   - Add a richer headless runtime harness when needed, closer to the non-rendering subset of `domGameLoop`.
   - Remaining work: server-owned tick scheduling, fixed-rate policy, plugin filtering, and lifecycle cleanup.

3. Per-entity control routing
   - Entity-addressed control maps exist for headless authoritative ticks.
   - Spacecraft operator can advance multiple manually controlled ships in one tick through that path.
   - Remaining work: browser network input adapter, held-input semantics, and disconnect/leave input clearing.

4. Server package

- `@solitude/server` exists with runtime, protocol, sessions, transport, ticker, and HTTP/SSE probe exports.
  - Do not import browser code.
  - Current sessions assign clients to preallocated `ship:blue` / `ship:red`.
- Remaining work: retention/cleanup, room listing, lifecycle policy, fixed timestep/accumulator policy, and eventually a production transport.

5. Browser network mode
   - Add a client runtime path that sends input over the network.
   - Wire authoritative snapshots through `remoteWorldMirror` and `remoteWorldRenderer` into a renderable local world.
   - Keep current standalone browser mode intact.

6. Dynamic game/session model
   - Add create/join game support.
   - Initially assign clients to pre-existing ships.
   - Later add dynamic ship creation/removal and any required gravity/index refresh APIs.

## Current Slice

Status: first browser-testable HTTP/SSE probe implemented; server-retained held input, keyboard-state messaging, server-owned ticking, and a simple live snapshot viewport now make the demo page feel like an actual remote-client prototype. Browser-side remote rendering now has a reusable non-loop harness, but the probe page is still using its direct snapshot renderer.

Currently available:

- `npm run dev:server` starts a Node HTTP server on `127.0.0.1:8787`.
- `POST /message` accepts create/join/leave/input protocol messages.
- `POST /step` advances a game and emits an authoritative snapshot.
- `GET /events?gameId=...` streams snapshots over server-sent events.
- The served probe page can create/join games, list existing games, auto-connect the snapshot stream, use spacecraft keyboard controls, run/pause a server-owned step loop, and render incoming snapshots into a simple canvas viewport.
- The Vite SSR loader used by the dev script is closed before the HTTP server starts; the probe should only expose the Solitude HTTP port, not Vite's HMR port.

Important current behavior:

- Joining the same game with the same client id is idempotent for assignment: the server returns `joined` for the existing entity and does not consume another ship.
- Input messages patch the latest held control state for the assigned entity. They do not emit snapshots by themselves.
- The probe's forward burn toggle sends `burnForward: true` to start and `burnForward: false` to stop; the server retains the latest value across authoritative steps.
- The probe also sends keydown/keyup patches for spacecraft controls (`Space`, `W/A/S/D`, `Q/E`, `N/M`, `B`, `0-9`) while an entity is assigned.
- The snapshot viewport renders directly from network snapshots with a small log-scaled top-down projection. It does not yet use `remoteWorldMirror` or the engine renderer.
- `@solitude/browser/remoteWorldRenderer` can apply a runtime snapshot to a local mirror, refresh scene/camera state, collect labels/segments, and render into a `RenderedView` using `DefaultViewRenderer`.
- The `Run` button now starts a server-owned interval via `POST /run`; `Pause` stops it via `POST /pause`. Manual `/step` remains available for debugging.
- `GET /games` exposes current game summaries with assigned/available entity ids so clients can discover games before joining.

Next focused slice:

- Wire the browser-testable probe to a bundled browser module path that can use `@solitude/browser/remoteWorldRenderer`, or create an equivalent remote-mode entry in the Solitude app where Vite already handles browser module loading.
- Keep browser single-player behavior on the existing global `mainFocus`/`controlInput` path.

## Candidate Next Slices

1. Render remote snapshots in a browser page
   - The current probe has a direct snapshot canvas, but not an engine-rendered mirrored world.
   - `@solitude/browser/remoteWorldRenderer` now composes a local mirrored world, scene, view, render cache, and `DefaultViewRenderer`.
   - Remaining work: make the browser page load a real browser bundle or add a remote app entry so incoming SSE snapshots can feed `renderSnapshot()`.
   - Then rasterize the returned `RenderedView` through Canvas/WebGL rasterizers instead of the direct top-down snapshot renderer.

2. Extract the probe page into reusable browser modules
   - Move the remaining inline demo wiring out of the HTML string when it starts blocking larger browser slices.
   - Keep protocol/client state, keyboard control state, and rendering/mirror concerns separable.
   - This can be done alongside the first rendered remote mode if the inline page becomes too awkward.

3. Mature the server-owned tick loop
   - A transport-agnostic `@solitude/server/ticker` owns run/pause interval lifecycle for the probe.
   - Remaining work: add game lifecycle cleanup, room/session ownership, and fixed timestep/accumulator behavior.

4. Extract a browser client protocol adapter
   - Convert local control state into protocol input messages.
   - Manage client/game/entity identity, sequence numbers, fetch/SSE calls, and reconnect hooks outside the demo HTML.
   - This is a cleaner prerequisite for wiring the real Solitude app into remote mode.

## Open Design Questions

- Should clients send only changed controls, complete control states, or both? Current probe sends changed controls into server-retained state.
- Should the next visible browser proof live in `@solitude/server` as a probe page, in `@solitude/browser` as reusable adapter code, or in the Solitude app behind a mode flag?
- Should clients render by mutating a local `World` via `remoteWorldMirror`, or should they render from immutable network snapshots transformed into render-frame caches?
- How much of `domGameLoop` should be split into a reusable app/runtime harness before adding server code?
- When should HTTP/SSE give way to WebSockets or WebTransport? Current HTTP/SSE is sufficient for probe work but not necessarily for production input latency.

## Known Risks

- Current package exports are intentionally narrow; server work must not normalize deep imports.
- Default Solitude plugin order is behaviorally significant.
- `mainFocus` is still a global runtime context; multiplayer needs per-client foreground focus and per-entity authoritative controls.
- Playback, pause, time-scale, profiling, and operator-switch plugins may not all make sense on a server.
- Dynamic entity add/remove likely requires explicit world mutation APIs and gravity-state refresh behavior.
- Snapshot bandwidth may become a concern if full entity state is broadcast every frame.
- The current probe allocates freely in UI/network paths; keep it out of engine hot paths and revisit before productionizing.
- Browser-driven `/step` loops are useful for testing but are not a trustworthy server-authoritative timing model.

## Completed Slices

- 2026-05-25: Added a reusable browser remote renderer:
  - `@solitude/browser/remoteWorldRenderer` composes `remoteWorldMirror`, `createScene`, view definitions, scene camera state, render-frame cache, and `DefaultViewRenderer`;
  - incoming runtime snapshots can now be applied to a mirrored world and rendered into an engine `RenderedView`;
  - render-facing plugin hooks for scene init/update, labels, segments, and view object filters are included;
  - added `rasterizeRenderedView()` so a later browser bundle can draw the rendered view through an existing rasterizer.
- 2026-05-24: Added game discovery:
  - session manager and transport expose game summaries;
  - `GET /games` returns summaries with assigned and available entity ids;
  - the probe can refresh existing games and join them without manually typing a game id.
- 2026-05-24: Extracted server ticking into `@solitude/server/ticker`:
  - HTTP `/run` and `/pause` now delegate interval lifecycle to a transport-agnostic ticker;
  - ticker exposes `runGame`, `pauseGame`, `pauseAll`, and `isRunning`;
  - ticker tests cover snapshot emission, loop replacement, missing-game self-pause, and cleanup.
- 2026-05-24: Added server-owned run/pause ticking to the HTTP probe:
  - `POST /run` starts an interval that steps a game and publishes snapshots over SSE;
  - `POST /pause` stops the interval;
  - the probe's Run/Pause button now controls the server loop instead of using browser-side `/step` polling;
  - manual `/step` remains available for debugging and deterministic tests.
- 2026-05-24: Added a live snapshot viewport to the server probe:
  - incoming authoritative snapshots now draw into a canvas on the demo page;
  - the viewport centers on the assigned entity and uses a log-scaled top-down projection;
  - snapshot log entries are compact summaries instead of full entity dumps;
  - this is intentionally a direct network-snapshot view, not the final `remoteWorldMirror` + engine renderer path.
- 2026-05-24: Added browser client adapter and keyboard-state messaging:
  - added `@solitude/server/client` with a browser-safe HTTP/SSE protocol client and keyboard input patcher;
  - the probe now sends keydown/keyup patches for spacecraft controls while assigned to an entity;
  - keyboard input uses the same server-retained held-input semantics as the forward-burn toggle.
- 2026-05-24: Added server-retained held-input semantics:
  - input messages now patch the assigned entity's held controls instead of applying for only one step;
  - authoritative steps reuse the latest held controls until a later input message changes them;
  - leaving a game clears the leaving client's held entity controls;
  - the probe's forward burn action is now a start/stop toggle that works with the run loop.
- 2026-05-23: Added probe run/pause controls:
  - page can repeatedly call `/step` at a configurable interval;
  - this creates an immediately watchable live tick loop without adding server-owned scheduling yet;
  - continuous controls are still not solved because input remains one-shot/next-step in the probe.
  - superseded by the 2026-05-24 server-owned run/pause loop.
- 2026-05-23: Cleaned up `npm run dev:server` port behavior:
  - Vite is used only as a temporary SSR/TypeScript loader;
  - Vite HMR is disabled and Vite is closed before the Solitude HTTP server starts;
  - the dev probe should expose only the Solitude HTTP port (`127.0.0.1:8787` by default).
- 2026-05-23: Improved the HTTP/SSE probe stream UX:
  - create/join now auto-connects the snapshot stream;
  - the old “Connect events” button became “Reconnect stream”;
  - stepping while the stream is open avoids duplicate snapshot logging.
- 2026-05-23: Added `@solitude/server/http` and a root `npm run dev:server` probe:
  - serves a minimal browser page for create/join/input/step interaction;
  - accepts client protocol messages via `POST /message`;
  - steps games via `POST /step`;
  - streams authoritative snapshot messages via server-sent events at `GET /events`;
  - runs through Vite's SSR loader so TypeScript server code can be exercised without adding a dev runner dependency;
  - remains a thin Node HTTP adapter over the existing in-process transport, not a replacement for engine/runtime work.
- 2026-05-23: Added `@solitude/server/transport`:
  - validates unknown inbound payloads with protocol guards;
  - routes valid client messages into the in-process session manager;
  - exposes `stepGame()` for authoritative snapshot emission;
  - remains in-process and transport-free, but is shaped for a future WebSocket wrapper.
- 2026-05-23: Added `@solitude/browser/remoteWorldMirror`:
  - creates a local engine `World` from a world config;
  - applies authoritative runtime snapshots into existing world objects;
  - reuses the indexed runtime snapshot apply workspace;
  - remains non-DOM and does not depend on `solitude` or `@solitude/server`.
- 2026-05-23: Added an in-process `@solitude/server/sessions` manager:
  - creates games backed by `createSolitudeServerGame()`;
  - joins clients to preallocated `ship:blue` and `ship:red`;
  - accepts protocol input messages only for the client's assigned entity;
  - steps games and emits snapshot protocol messages;
  - remains transport-free and WebSocket-free.
- 2026-05-23: Added transport-agnostic `@solitude/server/protocol` message types:
  - client messages cover `createGame`, `joinGame`, `leaveGame`, and `input`;
  - server messages cover `gameCreated`, `joined`, `snapshot`, and `error`;
  - protocol includes `gameId`, `clientId`, `entityId`, `sequence`, and `tick` where relevant;
  - added small constructors for server messages and lightweight guards for ingress/egress validation;
  - no WebSocket or transport dependency introduced.
- 2026-05-23: Added `@solitude/server` with a non-networked authoritative runtime proof:
  - `createSolitudeServerGame()` composes `solitude/headless`;
  - server steps require entity-addressed control inputs;
  - runtime snapshots are captured into reusable storage after each step;
  - server package declares `solitude` and `@solitude/engine` dependencies and imports no browser package;
  - package boundary tooling handled the new workspace package without changes.
- 2026-05-22: Promoted generic entity-state snapshots into `@solitude/engine/runtime`:
  - added `captureRuntimeSnapshot`, `applyRuntimeSnapshot`, and entity-level helpers;
  - added reusable `createRuntimeSnapshot` / `captureRuntimeSnapshotInto` APIs so future server broadcasts can avoid per-capture object graph allocation after initial storage setup;
  - added reusable apply workspaces and `applyRuntimeSnapshotWithWorkspace` so future client snapshot application can avoid repeated linear state lookup and per-apply map allocation;
  - kept playback-owned metadata in Solitude while delegating generic entity capture/apply to the engine;
  - added engine runtime snapshot tests for generic entity state plus controllable frame/angular velocity;
  - playback snapshot tests continue to cover the Solitude metadata wrapper.
- 2026-05-22: Added an opt-in per-entity control path for authoritative headless ticks:
  - `TickParams` / `SimulationPhaseParams` can carry `controlInputsByEntityId`.
  - `HeadlessLoop.stepWithEntityInputs()` accepts entity-addressed control input maps.
  - `spacecraftOperator` uses the map when present to advance multiple manually controlled ships in one tick while preserving the existing single-focus path.
  - `headlessServerComposition.test.ts` now proves `ship:blue` and `ship:red` can both receive controls in one headless Solitude tick.
- 2026-05-22: Added `solitude/headless` and a server-style smoke test proving the default Solitude world can be composed headlessly through public exports and advanced with spacecraft input. This exposed the next real architecture gap as per-entity control routing, not basic server-side composition.
- 2026-05-22: Started client-server architecture memory and set the first work path around a non-networked server/headless composition proof.
