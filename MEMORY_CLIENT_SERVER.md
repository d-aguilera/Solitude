# Client-Server Architecture Memory

## Purpose

- Track the long-running move from browser-only Solitude to a client-server-only application.
- Read this before changing headless runtime, snapshots, server/session/protocol code, network input, or browser remote rendering.

## Target Shape

Solitude should become one deployable client-server app:

```txt
Node server
  - serves built browser client assets
  - owns authoritative game/session state
  - runs headless engine simulation
  - receives input messages
  - broadcasts authoritative snapshots/events

Browser client
  - loads from the Node server
  - creates or joins games
  - sends local input state
  - mirrors authoritative snapshots
  - renders through @solitude/browser
```

Package responsibilities:

- `@solitude/engine`: generic world, physics, runtime snapshots, render data, and runtime seams.
- `@solitude/browser`: browser rendering/rasterizers, input adapters, and remote-world rendering helpers.
- `solitude`: Solitude-specific config, plugins, assets, and browser client entrypoints.
- `@solitude/server`: authoritative sessions, protocol, ticking, HTTP/WebSocket transport, and static client serving.

Standalone browser mode is migration scaffolding, not the destination. Keep `@solitude/browser` and `@solitude/server` separate outer adapters over shared engine/Solitude composition.

## Current Architecture

- The current working proof is `npm run dev:server` on `127.0.0.1:8787`.
- Transport is still HTTP/SSE probe-grade:
  - `POST /message` for create/join/leave/input.
  - `POST /run` and `POST /pause` for server-owned ticking.
  - `POST /step` for manual/debug stepping.
  - `GET /events?gameId=...` for snapshots.
  - `GET /games` for simple discovery.
- `@solitude/server` owns protocol, sessions, transport, ticker, HTTP/SSE probe, and authoritative Solitude headless runtime composition.
- Sessions currently assign clients to pre-existing `ship:blue` and `ship:red`.
- Browser probe dynamically loads a Solitude-owned remote renderer module through Vite transforms and renders snapshots through the engine renderer.
- The dev server keeps Vite transforms on the same origin but closes Vite's websocket; only `8787` should be exposed.

## Important Semantics

- Server is authoritative. Clients send input and render mirrored snapshots.
- Current approach is authoritative snapshots, not deterministic lockstep.
- Input messages patch latest controls and do not emit snapshots by themselves.
- Thrust level keys (`thrust0` ... `thrust9`) are latched selectors on the server: `true` selects a level; key release does not clear it.
- Timed `/run` uses server-received input edge times to split simulation substeps around key transitions, so brief taps apply for roughly their observed duration.
- Manual/debug `/step` keeps a one-step pending press fallback so press/release pairs are not dropped.
- The probe defaults are `dtMillis: 250`, `simulationStepMillis: 25`, `intervalMillis: 250`.
- Control input objects may be partial. Code that compares opposite controls must treat missing values as `false`.

## High-Value Next Steps

1. Make the remote probe more like the real app:
   - remove or gate fallback rendering so engine-render failures are visible;
   - extract protocol/client/rendering concerns from the probe page;
   - create a first-class Solitude remote-client Vite entry.

2. Mature server timing:
   - move from interval-only ticking toward elapsed-clock accumulator behavior;
   - decide snapshot broadcast cadence versus simulation cadence;
   - add lifecycle cleanup for empty/stale games.

3. Move transport toward production:
   - keep HTTP for static assets, health, and optional lobby/listing;
   - likely use WebSocket for join lifecycle, input, snapshots, and session events once the HTTP/SSE proof feels solid.

4. Improve multiplayer model:
   - per-client focus/camera semantics;
   - dynamic ship creation/removal;
   - gravity/index refresh APIs if entities become dynamic.

5. Optimize later:
   - compact snapshot deltas/versioning;
   - interpolation/prediction;
   - bandwidth and allocation review outside prototype UI paths.

## Known Risks

- Default Solitude plugin order is behaviorally significant.
- `mainFocus` remains a global runtime context in parts of the app; multiplayer needs per-client focus ownership.
- Playback, pause, time-scale, profiling, operator-switch, and some browser-only plugins may not belong on the server.
- The probe still allocates freely in UI/network paths. Avoid moving that allocation into engine hot paths.
- HTTP/SSE is useful for proving architecture but is not the final latency/transport story.

## Slice Log

### 2026-05-25

- Documented final target as a client-server-only deployment.
- Added real engine-rendered remote snapshots in the probe:
  - `remoteWorldMirror`;
  - `remoteWorldRenderer`;
  - `remoteCanvasRenderer`;
  - Solitude `remoteProbeRenderer`.
- Kept Vite transforms behind the same dev HTTP origin while closing the websocket/HMR port.
- Added server-owned fixed simulation substeps for `/run`.
- Added duration-aware server input handling for brief taps during timed runs.
- Fixed server thrust selector latching.
- Fixed partial attitude input handling so released/missing opposite controls do not create phantom opposite yaw/roll.

### 2026-05-24

- Added game discovery (`GET /games`) and join buttons in the probe.
- Added server-owned run/pause ticking and then extracted ticker code.
- Added live snapshot viewport, keyboard messaging, retained held input, and probe UX improvements.
- Added browser-safe HTTP/SSE client helpers and keyboard patcher.

### 2026-05-23

- Added `@solitude/server` package and authoritative headless runtime proof.
- Added protocol, sessions, transport, HTTP/SSE probe, and dev-server runner.
- Added browser `remoteWorldMirror`.
- Cleaned dev-server port behavior so the probe exposes the Solitude HTTP port only.

### 2026-05-22

- Promoted generic runtime snapshot capture/apply into `@solitude/engine/runtime`.
- Added reusable snapshot storage and apply workspaces.
- Added per-entity control routing for headless authoritative stepping.
