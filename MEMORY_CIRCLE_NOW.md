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

## Manual Procedure That Inspired Circle-Now

- Circle-now was originally based on the empirical manual procedure used before the autopilot existed.
- Manual procedure:
  - Approach the target planet/moon until it becomes the dominant gravity source.
  - Press `C` to align the ship's nose to the dominant body.
  - With the nose pointing at the body, roll until the body's apparent trajectory looks horizontal in the view.
  - Momentarily release/re-engage `C` as needed to check or refresh the visual alignment to the body.
  - If relative speed is too high, burn while pointing at the body to get closer or stabilize apparent distance.
  - Once visually "horizontal" and at a relatively stable apparent distance, use RCS guided by HUD in/out and prograde/retrograde cues until eccentricity is low enough.
- Current circle-now implementation mirrors this recipe:
  - Keep the forward axis pointed inward at the dominant body.
  - Roll until the right axis lines up with the tangential direction.
  - Compute circularization delta-v and project it onto the available forward main thrust and right-axis RCS controls.
- This means the current algorithm automates a pilot-facing visual maneuver, not a pure orbital optimal-control solution. That is intentional and user-valuable: it keeps the target body centered so the pilot can witness and understand the maneuver.
- `C` / align-to-body is non-propulsive but not an instant snap: it computes an attitude command, updates angular velocity through the normal acceleration-limited control path, and rotates the ship frame from angular velocity. It does not consume modeled thrust/RCS/fuel. See `MEMORY_ATTITUDE_AUTOPILOT.md` for the dedicated attitude-control interpretation.
- Potential implementation inefficiency:
  - The inward-pointing attitude and tangential-roll alignment are coupled. If the roll target is hard to acquire or moves quickly, the useful thrust/RCS projection can remain poor even when the desired circularization delta-v is known.
  - In those cases, circle-now may spend most of its time rotating toward a visual frame instead of applying acceleration in the most useful direction.
  - The saved long/OK logs support this concern: the long case has the correct Moon primary and a valid velocity-derived tangent, but remains near-perpendicular to useful tangent alignment for much of the maneuver.
  - This does not prove the manual procedure is wrong. It may mean the implementation is too literal and lacks the human pilot's judgment: tolerate good-enough alignment, stop chasing small target-frame changes, wait for geometry to settle, and apply correction only when the available axes are useful.

## Entry points and wiring

- Input plugin mapping: `KeyX` → `circleNow` in `src/plugins/autopilot/input.ts`.
- Control flag: `circleNow` is a plugin-provided dynamic control input key; base control input shape lives in `src/app/controlPorts.ts`.
- Plugin registration: `createAutopilotPlugin` in `src/plugins/autopilot/index.ts` wires input, controls, and HUD.
- Tick flow: `getPropulsionCommandForTick` in `src/app/game.ts` asks control plugins to resolve propulsion; the autopilot plugin switches to circle-now thrust when the flag is active.
- Attitude flow: `updateShipAngularVelocityFromInput` in `src/app/controls.ts` asks control plugins for attitude commands; the autopilot plugin returns circle-now attitude when the flag is active.

## Attitude algorithm (orientation + roll)

- Implemented in `computeCircleNowAttitudeCommand` in `src/plugins/autopilot/logic.ts`.
- Steps:
  - Align forward axis toward the dominant body ("inward") via `computeAlignToDirectionCommand`.
  - Roll-only alignment so the ship's right axis matches the tangential direction via `computeRollToDirectionCommand`.
- Tangential direction is computed in `getTangentialDirection`:
  - Use relative velocity minus its radial component.
  - If that fails (near-zero tangential speed), fallback to ship right projected onto the orbital plane.

## Thrust algorithm (delta-v toward circular orbit)

- Implemented in `computeCircleNowThrust` in `src/plugins/autopilot/logic.ts`.
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
- Status: unresolved; the 2026-04-18 sim-time-control fix candidate was reverted because ship maneuverability must remain tied to real frame time.

## Relevance after autopilot plugin extraction (2026-04-18)

- Still relevant:
  - User-facing behavior and repro notes.
  - The target-motion-rate hypothesis.
  - The failed experiment history: forward-first gating, roll suspension, warning-only HUD, and full-authority circle-now thrust.
  - HUD warning semantics, especially `TAN RATE`.
- Stale but mapped:
  - Old `src/app/autoPilot.ts` references now map to `src/plugins/autopilot/logic.ts`.
  - Old input wiring references now map to `src/plugins/autopilot/input.ts` plus the generic plugin-aware DOM input path.
  - Old HUD/render references now map to `src/plugins/autopilot/hud.ts`.
- Start-fresh guidance:
  - Do not restart the investigation from zero; preserve the behavioral history.
  - Do restart from the current plugin code paths and simulation-time boundary, because the old file map was pre-extraction.

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
  - `TAN RATE <value>` (tangential direction rotates too fast; current HUD warning threshold is 20°/s).
- The `TAN RATE` warning is the one that showed up at time scale x32 and correlated with the runaway roll.

## Behavioral changes attempted

- **Forward-first roll gating**: previously tried rolling only after forward axis is aligned inward. Did not resolve; reverted.
- **Roll suspension based on target rate** (previously tried):
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

- The issue is not just invalid tangential direction or primary changes.
- Rejected theory after 2026-04-18: making ship attitude, rotation, thrust, and RCS advance with `dtMillisSim` would match gravity/orbit target motion.
- Reason rejected: ship maneuverability is intentionally bound to real frame `dtMillis`; controlling the ship at sim time makes high-time-scale flight unusable and prevents even approaching the Moon at x32.
- Remaining problem: circle-now still needs a strategy for target-plane motion at high time scale while preserving real-time maneuverability.

## Diagnostic playback workflow (2026-04-19)

- Added a diagnostic playback plugin so the Moon circle-now repro can be captured and replayed without manual piloting every time.
- Capture:
  - Open `?mode=capture&scenario=moon-circle`.
  - The playback plugin also accepts other non-empty scenario ids; `moon-circle` is just the first saved-script target.
  - Fly normally to the desired initial state.
  - Press `L` once to capture a full world/ship snapshot and begin recording playback-owned control state.
  - The dumped script stores the effective time scale from recording start; changing time scale while recording is currently warned about but not faithfully represented by the v1 script contract.
  - Press `L` again to dump a paste-ready TypeScript script module to the console.
- Playback:
  - Save the dumped script into a registered module under `src/plugins/playback/scripts/`.
  - Open `?mode=playback&scenario=<script-id>`.
  - Add `&log=circle-now` to enable the circle-now measurement logger for that playback run.
  - The plugin applies the snapshot before gravity state is built, starts paused, and waits for `P`.
  - Playback runs with the script's fixed real tick and time scale; ship maneuverability still uses the fixed real tick, not raw sim-time authority.
  - At script end, playback pauses; pressing `P` after done releases normal control.
- First captured playback run:
  - Initial playback render exposed an empty-trajectory polyline bug; fixed by making the renderer skip preallocated polylines with no valid samples.
  - Paused/waiting playback initially showed HUD but blank views because camera poses were not initialized until scene advance; fixed by initializing camera poses/render cache during loop setup.
  - The saved snapshot is Earth-adjacent (`dominantBodyId: planet:earth`, roughly 6,471 km from Earth center and 401,111 km from the Moon), so this capture includes the transfer approach rather than starting at the Moon diagnostic state.
  - The run also showed why time-scale changes during capture matter: the current v1 script has one top-level time scale, not a time-scale timeline.
- Milestone playback repro: long case (2026-04-19):
  - User captured and embedded a new script after the playback fixes; it is now registered as `moon-circle-long` in `src/plugins/playback/scripts/moonCircleLong.ts`.
  - Playback sanity checks passed: time-scale HUD shows the script scale correctly and the initial paused frame renders before pressing `P`.
  - The script records `timeScale: 32` and a final `circleNow: true` phase lasting `28540.5 ms` (~28.5 s real time, ~15.2 min sim time at x32).
  - User confirmed the long circle-now maneuver reproduces the problem we need to solve: the autopilot eventually works, but takes about 29 seconds and feels pathologically slow for the available thrust authority.
  - The script's snapshot reports `dominantBodyId: planet:earth`; measured from the snapshot, the ship starts roughly 106,807 km from Earth center and 295,108 km from the Moon. This is expected because `dominantBodyId` is a derived capture-start breadcrumb only; it is not restored state and belongs in the future measurement log.
- Comparison playback repro: ok case (2026-04-19):
  - User recorded another Moon trip and registered it as `moon-circle-ok` in `src/plugins/playback/scripts/moonCircleOK.ts`.
  - The script records `timeScale: 32` and a final recorded `circleNow: true` hold lasting `13263.3 ms`; user did not release `X` immediately, so the script duration overstates the actual circularization time.
  - User measured the effective circularization time after the fact as roughly `8.6 s` real time.
  - Qualitative difference: the OK run took only about half a roll to reach tangent alignment, then eccentricity rapidly reached zero.
  - We now have a paired comparison: `moon-circle-long` (~29 s, many-roll/slow-feeling circularization) vs `moon-circle-ok` (~8.6 s measured, quick tangent acquisition).
  - Future autopilot fixes and diagnostics should compare both scripts before judging behavior.
- Circle-now measurement logger (2026-04-19):
  - Added optional `?mode=playback&scenario=<script-id>&log=circle-now`.
  - V1 samples only while `circleNow` is active and emits console JSON once at playback end.
  - Newly emitted logs include top-level `schemaVersion: 3` and `circleNowAlgorithmVersion`.
  - The first saved comparison logs were backfilled as historical `schemaVersion: 1`; the 2026-04-22 target-rate/projection logs before algorithm versioning are historical `schemaVersion: 2`.
  - Samples are stored as a flat numeric array with `sampleFields`, `sampleStride`, `primaryIds`, and `tangentialSources` lookup tables for lower runtime overhead.
  - 2026-04-22 schema-v2 expansion added per-sample target-rate and projection diagnostics: tangent-roll error rate, projected tangent-bearing rate, raw tangential direction rate, ship-forward direction rate, tangential projection quality, and desired-acceleration axis dots.
  - 2026-04-23 schema-v3 expansion added `circleNowAlgorithmVersion` without changing the sample fields.
  - The summary reports active real/sim duration, active start playback time, eccentricity start/final/min, absolute and active-relative threshold-crossing times, total absolute roll estimate, primary transitions, acceleration-efficiency min/max/average, and final radius/altitude/radial/tangential values.
  - Run both `moon-circle-long` and `moon-circle-ok` with `&log=circle-now` to compare the long and OK cases.
- Saved comparison logs (schema v1, committed baseline):
  - Long case: `src/plugins/playback/logs/circleNow/moon-circle-long-20260419-2022.json`.
  - OK case: `src/plugins/playback/logs/circleNow/moon-circle-ok-20260419-2010.json`.
  - Both logs use `primaryIds: ["planet:moon"]`, report no primary transitions, and use the velocity-derived tangential source for every sample.
  - Long case summary: 1712 samples, active duration ~28.53 s real / ~913.07 s sim, `e < 0.001` at ~18.05 s after circle-now became active, total absolute roll ~1692°, median absolute tangential roll alignment ~86.7°, median acceleration efficiency ~0.0037.
  - OK case summary: 796 samples, active duration ~13.27 s real / ~424.53 s sim, `e < 0.001` at ~8.67 s after circle-now became active, total absolute roll ~163°, median absolute tangential roll alignment ~0.05°, median acceleration efficiency ~0.0208.
  - Key comparison result: the long case is not explained by primary switching or missing tangential direction. The standout difference is tangent-roll acquisition: long spends most of the maneuver roughly perpendicular to useful tangent alignment, while OK reaches useful tangent alignment within a few seconds and eccentricity collapses quickly.

## Next investigation plan

- Use the saved logs above as the baseline comparison before changing autopilot behavior.
- First question to answer: why does `moon-circle-long` fail to acquire useful tangent roll alignment for ~18 s while `moon-circle-ok` gets under 30° tangent-roll error after ~1.7 s and under 10° after ~2.5 s?
- 2026-04-22 log comparison answered the first question more narrowly:
  - Long case rolls immediately and hard, then gets phase-locked near `-88°` tangent-roll error from ~0.5 s to ~17 s while roll angular velocity is clamped at `-1.6 rad/s` (~`-91.7°/s`).
  - Estimated target bearing rate around the ship-forward roll axis is also ~`-91.6°/s` during that plateau, so the roll controller is chasing a moving target at essentially its own max speed and cannot close the remaining error.
  - OK case has estimated target bearing near stationary during acquisition: median roughly `+8°/s` in the first 0.5 s, `-5°/s` from 0.5-2 s, and ~`0°/s` afterward; the same roll authority closes the error quickly.
  - Long case crosses `|roll error| <= 90°` at ~0.52 s, but does not reach `<= 60°` until ~17.95 s or `<= 30°` until ~18.42 s. OK case reaches `<= 60°` at ~1.20 s, `<= 30°` at ~1.70 s, and `<= 10°` at ~2.52 s.
  - Practical conclusion: the trip point is the instantaneous tangent-roll target bearing moving at/near max roll authority after inward alignment, producing a long phase lock near perpendicular thrust/RCS projection. It is not a failure to command roll.
- Focus on `computeCircleNowAttitudeCommand`, `computeRollToDirectionCommand`, and the interaction between inward alignment, tangent roll alignment, and thrust projection.
- Keep the rejected boundary intact: ship maneuverability remains based on real fixed tick time; gravity/celestial motion remains based on scaled sim time.

## Candidate Courses Of Action

- Course A: preserve the manual-inspired visual mode and fix controller quality.
  - Keep the target body centered as the defining circle-now UX.
  - Improve roll acquisition with damping, hysteresis, "good enough" tangent thresholds, target smoothing, or staged behavior.
  - Avoid blindly chasing instantaneous tangent changes when the available thrust/RCS axes are not yet useful.
  - This is the preferred first course because it keeps the feature aligned with the proven manual procedure.
- Course B: make the current implementation less literal.
  - Still point mostly inward, but allow temporary deviation or relaxed inward alignment when doing so improves circularization authority.
  - Treat inward pointing as a visual/comfort goal, not an absolute constraint on every tick.
  - Measure whether this reduces total roll and improves acceleration efficiency without making the maneuver feel confusing.
- Course C: add or prototype a delta-v-first circularizer.
  - Orient the ship to maximize useful projection of the desired circularization delta-v, then use main thrust/RCS accordingly.
  - This may be faster, but it changes the spirit of circle-now because the planet may no longer stay centered.
  - Consider this a separate mode or later comparison target rather than the immediate fix.
- Course D: improve diagnostics before changing control behavior.
  - Add logger fields for desired delta-v direction versus ship forward/right axes, and possibly target tangent angular rate during playback.
  - Use this if the current logs are insufficient to distinguish poor roll control from bad thrust projection.

## Code touch points (updated during this session)

- `src/plugins/autopilot/logic.ts`
  - Circle-now attitude, thrust, autopilot mode, and manual-actuation disengage logic.
- `src/plugins/autopilot/input.ts`
  - `KeyX` mapping and autopilot toggle semantics.
- `src/plugins/autopilot/hud.ts`
  - Autopilot HUD status and circle-now warning tracker.
- `src/app/game.ts`
  - Tick orchestration; ship controls/physics use real frame time while gravity/celestial spin use simulation time.
- `src/app/controls.ts`
  - Generic plugin control hooks and attitude command application.
- `src/plugins/playback/`
  - Diagnostic snapshot capture, duration-phase script recording, and fixed-tick playback for circle-now repros.
- `src/infra/domRuntimeOptions.ts`
  - Browser query parser for `mode`/`scenario` diagnostic runtime options.
- `src/infra/domGameLoop.ts`
  - Supports optional `FramePolicy.tickDtMillis` and initial sim-time baselines for playback snapshots.

## Troubleshooting iteration (2026-04-18)

- Hypothesis:
  - The x32 roll bug is caused by a split time base: gravity advances with scaled simulation time, but ship attitude, rotation, thrust, and RCS use unscaled real frame time.
  - This makes circle-now chase a target plane that is moving up to 32x faster than the controller can physically follow.
- Attempted change:
  - In `src/app/game.ts`, pass `dtMillisSim` to propulsion resolution, attitude update, ship rotation, main thrust, and RCS translation.
  - Scene/camera/HUD timing remains on real `dtMillis`.
- Temporary tests:
  - Added headless tests proving thrust delta-v and attitude acceleration scaled with simulation time.
  - Ran `npx vitest run src/infra/__tests__/headlessGameLoop.test.ts`.
- Result:
  - Rejected and reverted, including the temporary tests, before interactive x32 confirmation.
  - User clarified that ship maneuverability must remain on real frame time; otherwise high-time-scale approach is uncontrollable.

## Troubleshooting iteration (2026-04-22)

- Hypothesis:
  - The paired saved logs may be sufficient to identify what trips circle-now without adding new logger fields.
- Exact test:
  - Decoded the flat sample arrays in:
    - `src/plugins/playback/logs/circleNow/moon-circle-long-20260419-2022.json`
    - `src/plugins/playback/logs/circleNow/moon-circle-ok-20260419-2010.json`
  - Compared active-relative milestones, signed tangent-roll error, roll angular velocity, inward alignment, acceleration efficiency, commands, and eccentricity.
  - Estimated target-bearing rate around the roll axis using `errorDot + angularVelocityRoll` from the signed tangent-roll error series.
- Result:
  - Confirmed enough data to pinpoint the tripping mechanism.
  - Long case:
    - Starts rolling immediately and reaches `|roll error| <= 90°` at ~0.52 s.
    - Then stays near `-88°` roll error from ~0.5 s to ~17 s while `angularVelocityRollRadps` is clamped at `-1.6 rad/s`.
    - Estimated target-bearing rate during that plateau is ~`-91.6°/s`, matching max roll speed, so the controller is phase-locked and cannot close tangent alignment.
    - Acceleration efficiency remains near zero during the plateau because the available forward/right axes are nearly perpendicular to the desired delta-v projection.
  - OK case:
    - The target bearing is nearly stationary during acquisition, so the same roll controller closes error normally (`<=30°` by ~1.70 s and `<=10°` by ~2.52 s).
  - Confirmed/reframed theory:
    - The bug is target-bearing motion at the visual/inward-pointing roll frame, not bad primary selection, missing tangent direction, or lack of roll command.
    - Next fix should avoid chasing the instantaneous tangent bearing when it moves at/near roll authority. Candidate fixes should preserve real-time ship maneuverability and likely use smoothing, lead/lag compensation, hysteresis/staging, or an alternate good-enough target instead of raw instantaneous roll alignment.

## Troubleshooting iteration (2026-04-22, schema-v2 replay pair)

- New logs:
  - `src/plugins/playback/logs/circleNow/moon-circle-long-20260422-1925.json`
  - `src/plugins/playback/logs/circleNow/moon-circle-ok-20260422-1928.json`
- Hypothesis:
  - The new schema-v2 rate/projection fields should reveal whether the moving target comes from raw tangential-vector motion, ship-forward/inward frame motion, or projection degeneracy.
- Exact test:
  - Decoded both flat sample arrays and compared tangent-roll error, tangent-roll error rate, projected tangent-bearing rate, raw tangential direction rate, ship-forward direction rate, tangential projection quality, desired-acceleration axis dots, and acceleration efficiency.
- Result:
  - Confirmed: the long-case moving target is primarily the raw velocity-derived tangential direction rotating in world space.
  - Long case summary:
    - `schemaVersion: 2`, 1687 samples, active duration ~28.12 s real / ~899.73 s sim.
    - `e < 0.001` at ~24.27 s active, total absolute roll ~2225.8 deg, average acceleration efficiency ~0.151.
    - From ~2 s to ~23 s, tangent-roll error sits near `-88°`, roll velocity is clamped near `-91.7°/s`, projected tangent-bearing rate is near `-91.6°/s`, and raw tangential direction rate is near `+91.6°/s`.
    - During the plateau, ship-forward direction rate is only ~2-3°/s, `tangentialForwardDot` is near zero, and `tangentialProjectionLength` is ~1.0. This rejects projection degeneracy and rejects inward-frame motion as the main source.
    - Desired acceleration is almost entirely along ship `-up` during the plateau (`desiredAccelerationUpDot` near `-0.999`, forward dot near 0, right dot near a few hundredths), so the available forward/right actuators have near-zero authority and acceleration efficiency stays near ~0.001.
  - OK case summary:
    - `schemaVersion: 2`, 729 samples, active duration ~12.15 s real / ~388.8 s sim.
    - `e < 0.001` at ~9.57 s active, total absolute roll ~158.8 deg, average acceleration efficiency ~0.269.
    - Raw tangential direction and ship-forward direction both move quickly during early acquisition, but their projected bearing remains modest: median projected tangent-bearing rate ~+27.7°/s in the first 0.5 s, ~-5.8°/s from 0.5-2 s, and ~0°/s after 2 s.
    - By ~2 s the desired acceleration is mostly along ship right (`desiredAccelerationRightDot` around `-0.94` to `-1.0`) instead of ship up, so RCS can act usefully while roll settles.
- Practical conclusion:
  - Circle-now sometimes has to chase a moving target because the velocity-derived tangent can precess around the inward-pointing roll axis at roughly max roll speed. In the long geometry, that leaves the desired circularization acceleration in the ship-up axis, which circle-now cannot actuate. The fix should not focus on projection quality; it should change how circle-now handles high raw tangent-bearing rates and unavailable actuator authority.

## Implementation iteration (2026-04-22, phased circle-now)

- Change:
  - This implementation is now recorded as circle-now algorithm version `v2`.
  - Runtime selection supports `?autopilot=v1` for the previous stateless/immediate circle-now algorithm and `?autopilot=v2` for the phased algorithm. Default is `v2`.
  - Added a private circle-now controller state in the autopilot control plugin with phases: `acquireNose`, `acquirePlane`, `circularize`.
  - `acquireNose`: inward attitude only, roll damped to zero, propulsion disabled.
  - `acquirePlane`: inward attitude plus full tangent roll acquisition, propulsion disabled.
  - `circularize`: inward attitude plus minor roll corrections; propulsion is gated/scaled by how much desired circularization acceleration lies in the ship forward/right actuator plane.
- Thresholds:
  - Nose phase exits at inward alignment `<= 8°` and pitch/yaw angular rate `<= 0.3 rad/s`, or after `1500 ms` if inward alignment is `<= 15°`.
  - Plane phase exits at `|roll error| <= 30°`, or `|roll error| <= 60°` with actuator-plane score `>= 0.35`, or after `2500 ms` with actuator-plane score `>= 0.25`.
  - Circularize suppresses propulsion below actuator-plane score `0.25`, linearly scales from `0.25` to `0.5`, and uses full computed propulsion at `>= 0.5`.
  - Circularize applies full roll correction above `45°`, half correction from `15°` to `45°`, and no roll correction below `15°`.
- Tests:
  - Added `src/plugins/autopilot/logic.test.ts`.
  - Covered nose-only attitude/zero propulsion, nose-to-plane transition, plane roll/zero propulsion, ship-up suppression, ship-right allowance, and reset when circle-now is inactive.
  - `npm run typecheck` passed.
  - `npm run test` passed: 14 files / 43 tests.
- Next validation:
  - Re-run the schema-v2 playback pair (`moon-circle-long-2`, `moon-circle-ok-2`) and compare active time to `e < 0.001`, total roll, acceleration efficiency, and whether the long case avoids the ship-up dead zone.

## Validation iteration (2026-04-22, phased circle-now replay)

- Log:
  - `src/plugins/playback/logs/circleNow/moon-circle-long-20260422-2054.json`
  - Patched on 2026-04-23 to `schemaVersion: 3` with `circleNowAlgorithmVersion: "v2"`.
- User result:
  - Runaway rolling appears fixed in manual testing; no repeated uncontrollable roll was observed across many circle-now attempts.
  - New failure: the sequential procedure is slower, so the ship often escapes the intended planet/moon before circularization and the autopilot switches primary, usually to the Sun. User had to slow down substantially before pressing `X`.
- Replay result:
  - `moon-circle-long-2` after phased controller: `schemaVersion: 2`, 1687 samples, active duration ~28.12 s real / ~899.73 s sim.
  - Total absolute roll dropped to ~203.9° versus ~2225.8° before the phased change, confirming the runaway roll symptom is fixed.
  - Primary transitions from Moon to Sun at sample 266 / playback elapsed ~8583.33 ms, which is ~4.43 s after circle-now became active.
  - Eccentricity relative to the Moon stays essentially flat around ~202245 through the Moon-primary window, showing the phased controller is not applying useful early Moon capture correction before the primary switch.
  - The logger's `mainCommand`/`rcsCommand` fields are theoretical diagnostic commands, not the actual phase-gated propulsion output. Do not interpret nonzero command fields during acquisition phases as applied thrust.
- Diagnosis:
  - The phase split removed the roll chase, but disabling propulsion during `acquireNose` / `acquirePlane` also removed the original algorithm's immediate radial braking.
  - In the long replay, initial Moon radial speed is extremely high and inward alignment starts near the fallback threshold, then worsens during the pass. Waiting for nose/plane acquisition lets the ship leave the Moon-dominant region.
  - Manual procedure did allow thrust while pointing at the body if relative speed was too high; the phased implementation was too strict by making early phases non-propulsive.
- Next candidate fix:
  - Keep roll/RCS circularization gated, but allow early **radial-only main thrust** during `acquireNose` and `acquirePlane` when the nose is sufficiently aligned inward.
  - Early radial braking should project only the radial delta-v onto the forward main engine; it should not use tangential RCS or chase the moving tangent plane.
  - This preserves the runaway-roll fix while restoring the manual procedure's "slow down while pointing at the body" behavior.

## Versioning update (2026-04-23)

- The autopilot/circle-now algorithm is now runtime-selectable:
  - `?autopilot=v1`: old stateless/immediate circle-now behavior.
  - `?autopilot=v2`: phased circle-now behavior. This is the default.
- Runtime options are now passed from infra as a raw string map. Autopilot validates `autopilot`; playback validates `mode`, `scenario`, and `log`. Infra no longer knows plugin-specific option values.
- Circle-now logs now use `schemaVersion: 3` and include top-level `circleNowAlgorithmVersion`.
- Latest phased replay log patched:
  - `src/plugins/playback/logs/circleNow/moon-circle-long-20260422-2054.json`
  - Patched to `schemaVersion: 3` and `circleNowAlgorithmVersion: "v2"`.

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

- Use `&log=circle-now` in playback mode.
- Compare summaries first: active duration, active-relative eccentricity threshold times, total absolute roll estimate, acceleration efficiency, and primary transitions.
- Then inspect flat samples around major differences, especially tangent roll alignment angle, inward alignment angle, delta-v magnitude, main/RCS command fractions, and tangential source.
