# Client-Server Gameplay Feel Plan

## Purpose

- Bring the client/server gameplay feel as close as possible to the standalone browser version.
- Treat the current client/server proof as migration scaffolding, not an API to preserve.
- Prefer the realistic end state over cautious compatibility.
- Keep this file current as a plan, not as a chronological implementation log.

## Preferences

- Server authority remains non-negotiable.
- WebSocket is the real-time gameplay transport.
- HTTP remains for static assets, lobby discovery/management, and health checks.
- Remove compatibility paths when the replacement is in place.
- Avoid optional parameters unless absence is semantically meaningful.
- Avoid re-export convenience layers.
- Prefer direct package ownership and direct imports over compatibility facades.
- Move forward in bold steps.

## Target Shape

```txt
Node server
  - serves built browser client assets
  - owns authoritative sessions and simulation timing
  - runs fixed-step headless Solitude games
  - receives sequenced input over WebSocket
  - broadcasts authoritative model/state messages

Browser client
  - creates or joins games through the server
  - sends local input immediately over WebSocket
  - renders at requestAnimationFrame cadence
  - interpolates remote authoritative entities
  - predicts the locally controlled ship
  - reconciles prediction against authoritative snapshots
```

## Roadmap

1. Make WebSocket the only gameplay transport.
   - Keep HTTP for `GET /`, static assets, `GET /games`, `DELETE /games/:gameId`, and `GET /health`.
   - Remove or isolate legacy/debug gameplay routes: `POST /message`, `POST /run`, `POST /pause`, `POST /step`, and `GET /events`.
   - Keep one gameplay protocol path for create, join, leave, input, start/stop, model updates, and snapshots.

2. Replace client-selected run parameters with server-owned policy.
   - Remove client-provided `dtMillis`, `intervalMillis`, and `simulationStepMillis`.
   - The client asks to start or stop a game; the server decides timing.
   - Use fixed 60 Hz simulation as the baseline policy.
   - Start with 30 Hz or 60 Hz snapshot broadcast based on measured cost.

3. Promote the authoritative runner to a first-class server subsystem.
   - Session manager owns game/session state.
   - Game runner owns ticking active games.
   - Transport forwards protocol messages and broadcasts runner output.
   - Snapshot production should come from the runner, not from request-shaped ticking.

4. Add authoritative time semantics to snapshots.
   - Snapshot messages should carry authoritative simulation time.
   - Arrival time should not define simulation time.
   - Keep sequence/tick metadata suitable for ordering and diagnostics.

5. Replace the two-snapshot client interpolator with an ordered buffer.
   - Keep a small ring of recent authoritative snapshots.
   - Drop stale or out-of-order snapshots.
   - Sample by target authoritative simulation time.
   - Interpolate between nearest snapshots.
   - Allow only short bounded extrapolation when the buffer underruns.

6. Add client prediction for the locally controlled ship.
   - Local controls must affect the assigned ship immediately.
   - Reuse Solitude simulation/control logic where practical.
   - Reconcile predicted state against authoritative snapshots.
   - Keep other entities interpolated from server state.

7. Make inputs sequence-aware.
   - Input messages should include a client input sequence.
   - Authoritative snapshots should acknowledge the last processed input sequence per controlled entity.
   - The client should replay unacknowledged local inputs after reconciliation.

8. Split static model data from high-frequency dynamic state.
   - `gameModel` owns static or slow-changing entity configuration.
   - `snapshot` owns high-frequency position, velocity, orientation, and control-facing dynamic state.
   - Avoid repeatedly sending static scenario data once the model is known.

9. Review bandwidth, allocation, and protocol shape after feel improves.
   - Compact deltas, entity versioning, and binary-friendly encodings belong after the real-time feel path is structurally sound.
   - Do not move prototype UI/network allocation patterns into engine hot paths.

## Current Plan

Deliver the real-time authoritative loop first:

- WebSocket-only gameplay path is in place.
- Server-owned fixed 60 Hz simulation policy is in place.
- Server-owned active game runner.
- Fixed-rate authoritative snapshot broadcast.
- Snapshot messages with authoritative simulation time.
- Client interpolation buffer based on simulation time instead of arrival time.

Then deliver predicted local flight:

- Sequenced input messages.
- Snapshot acknowledgements for processed input.
- Client-side prediction for the assigned ship.
- Smooth reconciliation against server state.
- Interpolated remote entities.

## Clear Next Step

Promote the authoritative runner to a first-class server subsystem:

- session manager owns game/session state;
- game runner owns ticking active games;
- transport forwards protocol messages and broadcasts runner output;
- snapshot production comes from the runner, not from request-shaped ticking.

## Things To Watch

- Default Solitude plugin order is behaviorally significant.
- `mainFocus` is still global in parts of the runtime; multiplayer needs per-client focus/render ownership.
- Browser-only plugins should not leak into the authoritative server runtime.
- Snapshot cadence increases can expose bandwidth, serialization, and GC pressure quickly.
- Client prediction must avoid inventing a second spacecraft model that drifts from server behavior.
