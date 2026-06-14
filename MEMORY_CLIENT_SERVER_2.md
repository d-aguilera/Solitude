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
   - Keep HTTP for `GET /`, static assets, `GET /games`, and `GET /health`.
   - Remove or isolate legacy/debug gameplay routes: `POST /message`, `POST /run`, `POST /pause`, `POST /step`, and `GET /events`.
   - Keep one gameplay protocol path for create, join, leave, input, model updates, and snapshots; created games run automatically.

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

5. Disable client interpolation while tightening the protocol.
   - Render the latest authoritative snapshot directly.
   - Let protocol cadence, payload weight, ordering, and jitter be plainly visible.
   - Keep interpolation/prediction out of the diagnostic loop until the server stream is structurally better.

6. Split static model data from high-frequency dynamic state.
   - `gameModel` owns static or slow-changing entity configuration.
   - `snapshot` owns high-frequency position, velocity, orientation, and control-facing dynamic state.
   - Avoid repeatedly sending static scenario data once the model is known.

7. Add server stream instrumentation.
   - Track snapshot cadence, payload size, fanout, simulation step timing, and socket counts.
   - Expose rolling metrics over HTTP so optimization work has a scoreboard.
   - Keep the metrics close to runner/socket boundaries instead of engine hot paths.

8. Add model versioning and stream recovery rules.
   - `gameModel` should publish a model version.
   - `snapshot` should identify the model version it depends on.
   - The client should reject, buffer, or recover when dynamic updates outrun static model state.

9. Review compact dynamic encoding.
   - Measure before choosing between compact JSON shape, quantization, deltas, or binary-friendly arrays.
   - Do not move prototype UI/network allocation patterns into engine hot paths.

10. Apply the first compact dynamic encoding.
    - Round snapshot positions to integer world units.
    - Round remaining high-frequency motion numbers to six decimals.
    - Keep the live protocol shape easy to inspect until binary earns its complexity.

11. Add pressure-test multiplayer capacity.
    - Expand server-owned assignable ships beyond two.
    - Spawn lazily joined ships around Earth at distributed meridians with stable starting velocities.
    - Add a headless WebSocket load harness that joins N clients, sends basic input, and samples `/metrics`.

12. Make inputs sequence-aware.
    - Input messages should include a client input sequence.
    - Authoritative snapshots should acknowledge the last processed input sequence per controlled entity.
    - The client should replay unacknowledged local inputs after reconciliation.

13. Replace the two-snapshot client interpolator with an ordered buffer.
    - Keep a small ring of recent authoritative snapshots.
    - Drop stale or out-of-order snapshots.
    - Sample by target authoritative simulation time.
    - Interpolate between nearest snapshots.
    - Allow only short bounded extrapolation when the buffer underruns.
    - This was intentionally pushed behind local prediction because perceived input latency was the larger gameplay problem.

14. Add client prediction for the locally controlled ship.
    - Local controls must affect the assigned ship immediately.
    - Reuse Solitude simulation/control logic where practical.
    - Reconcile predicted state against authoritative snapshots.
    - Keep other entities interpolated from server state.

15. Harden prediction/reconciliation feel.
    - Keep visual correction smoothing for the assigned ship.
    - Keep prediction metrics available through `window.__solitudePredictionMetrics`.
    - Keep reconciliation render-only so HUD/projection/autopilot readouts are not polluted by temporary visual correction.
    - Tune only against interactive feel plus metrics; avoid special-case release patches unless the measured model demands them.

## Current Plan

Delivered authoritative loop foundation:

- WebSocket-only gameplay path is in place.
- Server-owned fixed 60 Hz simulation policy is in place.
- Server-owned active game runner is in place.
- Fixed-rate authoritative snapshot broadcast.
- Snapshot messages with authoritative simulation time.
- Latest-snapshot rendering is in place while the protocol stream is made leaner.
- Static/dynamic message split is in place.
- Server stream instrumentation is in place.
- Model versioning and stream recovery rules are in place.
- Compact dynamic encoding review is in place.
- First compact dynamic encoding change is in place.
- Pressure-test multiplayer capacity is in place.

Delivered local input/prediction feel:

- Sequenced input messages and snapshot input acknowledgements are in place.
- Load harness input latency mode is in place.
- Client-side prediction is in place for the locally controlled ship.
- Visual reconciliation smoothing and prediction error metrics are in place.
- Reconciliation is render-only for the controlled ship, so HUD/projection readouts observe the restored local state.
- Gameplay input now uses one-way WebSocket messages; snapshots remain the acknowledgement path.

Delivered remote presentation smoothing:

- Ordered interpolation buffer based on simulation time.
- Interpolated remote entities with a small default presentation delay.
- Bounded extrapolation only when the buffer underruns.
- The local controlled ship stays on the latest-authority prediction/reconciliation path, not the delayed remote interpolation path.

## Clear Next Step

Tune and measure multiplayer feel after the one-way input and simulation-time interpolation slice:

- verify local feel, remote smoothness, and `window.__solitudePredictionMetrics` together;
- measure snapshot inter-arrival jitter and input send-to-ack p50/p95 under load;
- use those metrics to decide whether to tune interpolation delay, broadcast cadence, or payload/fanout next.

## Things To Watch

- Default Solitude plugin order is behaviorally significant.
- `mainFocus` is still global in parts of the runtime; multiplayer needs per-client focus/render ownership.
- Browser-only plugins should not leak into the authoritative server runtime.
- Snapshot cadence increases can expose bandwidth, serialization, and GC pressure quickly.
- Client prediction must avoid inventing a second spacecraft model that drifts from server behavior.
- Prediction/reconciliation fixes should be tested near high-contrast geometry like the Moon; pitch-release snaps were easier to see there than in empty space.
- Visual correction must not leak into HUD/projection/autopilot readouts; restore the local ship state after render-only smoothing.
