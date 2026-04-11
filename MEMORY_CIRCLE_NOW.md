# Circle Now Memory (Spin-Off)

## Troubleshooting Discipline (must-follow)

- Update this doc after **every** troubleshooting iteration.
- Record each **theory/hypothesis**, the **exact change or test**, and the **result** (confirmed / rejected / inconclusive).
- Include concrete reproduction details (time scale, body, approach) when available.
- The goal is to avoid repeating the same ideas and to build a reliable history of what was tried.

## Purpose

- Dedicated memory for the "circle now" autopilot so we don't re-litigate the same context.
- This exists because the feature still has a stubborn bug and prior fixes have failed.

## Feature overview

- User-facing control: press `X` to enable "circle now".
- Goal: drive the ship toward a circular orbit around the dominant body.
- Implementation is split into attitude control (orientation/roll) and propulsion (thrust + RCS).

## Entry points and wiring

- Input mapping: `KeyX` → `circleNow` in `src/infra/domKeyboardInput.ts`.
- Control flag: `circleNow` lives in `src/app/controlPorts.ts`.
- Tick flow: `getPropulsionCommandForTick` in `src/app/game.ts` switches to circle-now thrust when the flag is held.
- Attitude flow: `updateShipAngularVelocityFromInput` in `src/app/controls.ts` uses circle-now attitude when the flag is held.

## Attitude algorithm (orientation + roll)

- Implemented in `computeCircleNowAttitudeCommand` in `src/app/autoPilot.ts`.
- Steps:
  - Align forward axis toward the dominant body ("inward") via `computeAlignToDirectionCommand`.
  - Roll-only alignment so the ship's right axis matches the tangential direction via `computeRollToDirectionCommand`.
- Tangential direction is computed in `getTangentialDirection`:
  - Use relative velocity minus its radial component.
  - If that fails (near-zero tangential speed), fallback to ship right projected onto the orbital plane.

## Thrust algorithm (delta-v toward circular orbit)

- Implemented in `computeCircleNowThrust` in `src/app/autoPilot.ts`.
- Uses the dominant body's primary (`getDominantBodyPrimary`) and mu = `G * mass`.
- Computes:
  - `r` from primary to ship and unit radial direction `rHat`.
  - Relative velocity `vRel = ship.velocity - body.velocity`.
  - Radial speed: `radialSpeed = dot(rHat, vRel)`.
  - Tangential speed: `|vRel - radialComponent|` and its direction when possible.
  - Circular speed: `sqrt(mu / r)`.
  - Target delta-v: cancel radial speed, adjust tangential speed toward circular.
- Delta-v is clamped by max accel for the frame, then projected into:
  - Main engine forward axis (thrust).
  - RCS right axis (lateral translation only).

## Observed bug (current)

- Symptom: the ship rolls repeatedly (often ~20+ full rotations) while the orbit eccentricity very slowly decreases to zero.
- We have attempted to fix this several times and failed so far.
- Status: unresolved; keep this doc updated with new findings and attempts.

## Session findings (2026-04-04)

- Repro is strongly time-scale dependent.
  - At time scale x1 (and below x32), repeated roll >360° did not appear in tests.
  - At time scale x32, the neverending roll is consistent, especially when entering a new gravity well (example: approaching the moon, then pressing `X`).
- Root cause signal: the tangential target direction can rotate faster (in real time) than the roll controller can track.
  - `alignToTangentMaxAngularSpeed` is ~1.6 rad/s (~92°/s).
  - When tangential direction rate exceeds this, roll keeps chasing and accumulates multiple full rotations.
- This was confirmed with a HUD warning: `TAN RATE` appeared during the long-roll phase and disappeared once the roll settled into a circular orbit.
- Observed behavior at x32: the `TAN RATE` warning flickers on/off while the ship keeps rolling; it only settles once the rate stays low enough for a while.
- Working user hypothesis: the ship is chasing an impossible-to-reach plane while circling; the roll target keeps moving faster than the controller can track.

## Instrumentation added (HUD)

- Circle-now warnings are displayed in the HUD while `X` is held.
- Earlier in the session, we added full CN telemetry (radial/tangential speeds, source, delta angle, rate) but later removed it, keeping **warnings only**.
- Warnings currently include:
  - `NO TAN` (no valid tangential direction),
  - `TAN LOW` (tangential speed < 1 m/s),
  - `FALLBACK` (tangential direction from fallback projection),
  - `TAN FLIP` (direction flips between frames),
  - `TAN SWING` (direction swings > 45°),
  - `TAN RATE <value>` (tangential direction rotates too fast; warning threshold ~60°/s).
- The `TAN RATE` warning is the one that showed up at time scale x32 and correlated with the runaway roll.

## Behavioral changes attempted

- **Forward-first roll gating**: previously tried rolling only after forward axis is aligned inward. Did not resolve; reverted.
- **Roll suspension based on target rate** (current):
  - In `computeCircleNowAttitudeCommand`, roll alignment is skipped if the tangential direction rotates faster than a limit.
  - Limits tried:
    - `circleNowMaxTangentialRate = 1.0 rad/s (~57°/s)`; warning threshold ~60°/s.
    - Later lowered to `20°/s` for both suspension and warning to make the effect obvious.
  - Observed behavior: `TAN RATE` flickers on/off; roll suspends and resumes rapidly, so it still churns without settling. Changing the threshold did not eliminate the issue.
- **Perf tweak**: avoid computing the roll command when roll is suspended.
- **State reset**: added a reset so tangential history is cleared when `X` is released.
- **Result**: roll suspension logic has been removed from code (did not solve).
- **Autopilot ignores manual thrust level** (current):
  - Circle-now now uses full authority (`maxThrustPercent = 1.0`) instead of the manual thrust level.
  - Result: did not fix the rolling issue.

## Current hypothesis

- The issue is not just invalid tangential direction or primary changes; it is primarily **target motion rate** vs. controller capability at high time scales.
- Roll is still trying to chase a plane that is moving faster than the roll controller can track.

## Code touch points (updated during this session)

- `src/app/autoPilot.ts`
  - Added rate-based roll suspension when tangential direction rotates too fast.
  - Skipped roll command calculation if roll is suspended (perf).
- `src/app/controls.ts`
  - Resets circle-now attitude state when `X` is released.
- `src/infra/domGameLoop.ts`
  - Added circle-now debug state tracking for HUD warnings.
- `src/render/DefaultHudRenderer.ts`
  - Displays only warnings for circle-now (no CN telemetry).
- `src/render/renderPorts.ts`
  - Added circle-now debug fields for HUD warnings.

## Timeline of key steps (2026-04-04)

- Verified geometric plane alignment idea and built a vector diagram of the orbit plane vs. tangential direction.
- Tried forward-first roll gating; no fix → reverted.
- Added HUD telemetry for circle-now (rad/tan, source, delta, rate) → confirmed `TAN RATE` at x32.
- Simplified HUD to warnings only.
- Implemented rate-based roll suspension and lower threshold; still seeing intermittent chase at x32.

## Notes for future debugging

- The roll behavior is driven by `computeRollToDirectionCommand` and the tangential vector.
- Circle-now thrust only uses forward thrust and right RCS translation; there is no up/down translation command.
- The orbit target is derived from the dominant body primary, so any rapid change in primary could affect stability.

## What to log next time

- Initial orbit parameters (r, speed, eccentricity).
- Tangential direction calculation path (velocity-derived vs fallback).
- Attitude command outputs per tick (roll rate, pitch, yaw).
- Delta-v magnitude before/after clamping and the chosen accel axes.
- Whether the dominant body primary changes during the maneuver.
