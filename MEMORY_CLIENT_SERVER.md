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
- `@solitude/protocol`: browser-safe protocol types, message constructors/guards, HTTP/WebSocket client adapters, and input patching helpers.
- `solitude`: Solitude-specific config, plugins, assets, and browser client entrypoints.
- `@solitude/server`: authoritative sessions, protocol, ticking, HTTP/WebSocket transport, and static client serving.

Standalone browser mode is migration scaffolding, not the destination. Keep `@solitude/browser` and `@solitude/server` separate outer adapters over shared engine/Solitude composition.

## Current Architecture

- The current working proof is `npm run dev:server` on `127.0.0.1:8787`.
- Production-like local mode is `npm run build` then `npm run start:server`; the Node server serves built `dist/remote.html` plus authoritative API routes.
- Transport is now production-shaped for the interactive path:
  - `GET /socket` upgrade for create/join/leave/input, run/pause, and authoritative snapshots.
  - `GET /games` for simple lobby discovery.
  - `GET /health` for deployment health checks.
  - Legacy/debug HTTP routes remain for now: `POST /message`, `POST /run`, `POST /pause`, `POST /step`, and `GET /events?gameId=...`.
- `@solitude/server` owns protocol, sessions, transport, ticker, HTTP/WebSocket serving, and authoritative Solitude headless runtime composition.
- Sessions create ships dynamically on join and remove them on explicit leave. The current named slots are still `ship:blue` and `ship:red`, but they are no longer pre-existing world entities.
- Browser remote client now has a first-class Solitude Vite entry (`packages/solitude/remote.html` -> `src/remoteClient.ts`) that uses shared protocol/client helpers and renders snapshots through the engine renderer.
- Browser tabs generate distinct default client ids, receive authoritative game-model messages for dynamic ships, and rebuild their remote render mirror when ships join, leave, or disconnect.
- Remote client rendering is decoupled from snapshot arrival: server snapshots feed a delayed interpolation buffer, while the browser renders through `requestAnimationFrame`.
- Remote mode intentionally runs only render/readout-safe Solitude plugins in the browser. Server-authoritative spacecraft and autopilot controls are sent over protocol; browser-only display/readout state stays local.
- The dev server keeps Vite transforms on the same origin but closes Vite's websocket; only `8787` should be exposed.

## Important Semantics

- Server is authoritative. Clients send input and render mirrored snapshots.
- Current approach is authoritative snapshots, not deterministic lockstep.
- Input messages patch latest controls and do not emit snapshots by themselves.
- Thrust level keys (`thrust0` ... `thrust9`) are latched selectors on the server: `true` selects a level; key release does not clear it.
- Timed `/run` uses server-received input edge times to split simulation substeps around key transitions, so brief taps apply for roughly their observed duration.
- `dtMillis / intervalMillis` defines the server simulation rate for `/run`; the ticker accumulates elapsed wall time, runs due fixed simulation substeps, emits the latest snapshot after one or more substeps, and carries leftover simulation time forward.
- Manual/debug `/step` keeps a one-step pending press fallback so press/release pairs are not dropped.
- The probe defaults are `dtMillis: 250`, `simulationStepMillis: 25`, `intervalMillis: 250`.
- Control input objects may be partial. Code that compares opposite controls must treat missing values as `false`.
- Explicit `leaveGame` and WebSocket disconnect both clear the client's entity controls; games with no assigned clients are cleaned up immediately.

## High-Value Next Steps

1. Optimize later:
   - compact snapshot deltas/versioning;
   - prediction/reconciliation;
   - bandwidth and allocation review outside prototype UI paths.

## Known Risks

- Default Solitude plugin order is behaviorally significant.
- `mainFocus` remains a global runtime context in parts of the app; multiplayer needs per-client focus ownership.
- Playback, pause, time-scale, profiling, operator-switch, and some browser-only plugins may not belong on the server.
- The probe still allocates freely in UI/network paths. Avoid moving that allocation into engine hot paths.
- Legacy HTTP/SSE routes remain for debug compatibility; the interactive path should stay on WebSocket.

## Slice Log

### 2026-05-27

- Tightened multiplayer socket lifecycle:
  - WebSocket join/leave model changes now broadcast `gameModel` updates to already-connected clients;
  - WebSocket disconnect now releases only that socket's assigned ship and lets remaining clients continue;
  - closing a tab frees its ship slot for later joins.
- Fixed dynamic ship motion:
  - headless loops now expose an explicit gravity-state refresh for world add/remove;
  - server runtime refreshes gravity aliases after dynamic ship join/leave so newly joined ships translate under thrust instead of only rotating.

### 2026-05-25

- Documented final target as a client-server-only deployment.
- Added real engine-rendered remote snapshots in the probe:
  - `remoteWorldMirror`;
  - `remoteWorldRenderer`;
  - `remoteCanvasRenderer`;
  - Solitude `remoteClientRenderer`.
- Kept Vite transforms behind the same dev HTTP origin while closing the websocket/HMR port.
- Added server-owned fixed simulation substeps for `/run`.
- Added duration-aware server input handling for brief taps during timed runs.
- Fixed server thrust selector latching.
- Fixed partial attitude input handling so released/missing opposite controls do not create phantom opposite yaw/roll.
- Moved protocol/client helpers into `@solitude/protocol` and shifted the probe browser runtime into a Solitude-owned remote client module.
- Removed the old `@solitude/server/client` and `@solitude/server/protocol` compatibility exports; server code imports the shared protocol contract directly.
- Added the first-class Solitude remote-client Vite entry and moved the probe page/style ownership out of `@solitude/server`.
- Added production-like built-asset serving: `npm run start:server` serves `dist/remote.html`, hashed assets, and authoritative server routes from one Node process.
- Matured server timing from interval-assumed ticks to elapsed-clock accumulation with fixed simulation substeps.
- Added lifecycle cleanup for empty games after explicit leave and pause matching game tickers when sessions disappear.
- Matured remote client runtime/rendering:
  - browser render cadence now uses `requestAnimationFrame`, independent of network snapshot cadence;
  - authoritative snapshots are position/velocity/frame interpolated with a short local display delay;
  - remote HUD text is fed by render/readout-safe HUD panel providers;
  - remote autopilot controls (`V`, `C`, `X`) send server-authoritative state patches;
  - remote-mode control/display ownership is documented explicitly.
- Moved interactive transport toward production:
  - added `/socket` WebSocket upgrade for create/join/leave/input, run/pause, and snapshots;
  - switched the Solitude remote client to the WebSocket adapter;
  - kept HTTP for static assets, `/games`, `/health`, and legacy/debug routes.
- Improved multiplayer model:
  - remote browser tabs now default to unique client ids, so separate windows join as separate clients;
  - server sessions dynamically add a client's ship on join and remove it on explicit leave;
  - protocol gained `gameModel` messages so clients rebuild render mirrors when dynamic ship entities change;
  - engine/world gained explicit add/remove/refresh helpers for dynamic entity indexes.

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
