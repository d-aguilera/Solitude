# My First Orbit Memory

## Memory rules

- This document is concise hand-off context between sessions, written in present tense.
- Keep only current scope, decisions, implementation state, and next steps.
- Replace outdated wording in place; omit history, change explanations, and session narratives.
- Add design information as implementation planning progresses.

## Work and commit rules

- Read `MEMORY.md` and this document at session start; use short sessions with one concrete handoff task.
- End each session with current decisions/state and an explicit next task in this document. Respect the handoff's design-only or implementation scope.
- Commit this endeavor with the exact subject `My first orbit N`, starting at `My first orbit 1` and incrementing N for each subsequent commit. Inspect Git history to determine the next number; keep unrelated changes out of the series.
- Format modified files with Prettier. Follow `MEMORY.md` validation requirements for code changes; explicitly report checks that are not run.

## Scope

- My First Orbit is one short standalone adventure: the player recovers an unsafe orbit and achieves a stable, safe orbit.
- Target play time is approximately five minutes, with contextual control guidance, relevant instrument highlights, optional hints, clear success feedback, and instant retry.
- Standalone provides a start menu with My First Orbit and Free Flight; adventure pause provides Resume, Retry, and Return to menu. URL options remain direct-entry shortcuts. Multiplayer retains its existing lobby.
- The pilot establishes the minimum gameplay awareness needed to understand the active goal, observe progress, recognize accomplishments, and guide the player.
- Existing physics, orbital telemetry, controls, and autopilot provide the foundation. Product behavior respects the external plugin boundary and performance constraints.
- Multiplayer, additional adventures, maneuver planning, and a general campaign system remain outside pilot scope.

## High-level implementation plan

1. Define scenario, player actions, outcomes, assistance, and entry/pause/retry/exit flows.
2. Specify reusable semantic observations and temporal accomplishment rules.
3. Define objective state and lifecycle, including consistent simulation/guidance reset.
4. Implement a rule-based director with feedback priorities and cooldowns.
5. Connect presentation through semantic instrument identifiers; assemble adventure plugins.
6. Playtest completion, failure, retry, guidance, and runtime cost; tune the experience.

## Pilot design

- **Scenario:** one craft at Earth-orbit apoapsis, facing Earth-relative prograde, autopilot initially off. Altitude targets 400 km; predicted periapsis altitude targets -50 km. The briefing states that automatic orbit recovery is offline, the trajectory intersects Earth, and manual forward thrust raises the orbit's lowest point. Numerical targets require simulation calibration.
- **Flow:** selecting My First Orbit initializes a fresh scenario and paused opening briefing; Begin starts flight. Free Flight opens the existing sandbox. Completion/failure pauses flight and offers Retry or Return to menu.
- **Player actions:** inspect highlighted periapsis altitude, align to velocity (`V`) if needed, thrust forward (`Space`), release, and coast. Success depends on the orbit rather than a key sequence.
- **Success:** Earth-dominated bound orbit, periapsis altitude ≥150 km, apoapsis altitude ≤600 km, sustained for five unpaused real seconds without propulsion. Invalid observations, a primary change, or unmet conditions reset confirmation. This measures near-term safety, not indefinite N-body stability.
- **Failure:** actual Earth altitude ≤80 km, an adventure boundary without atmosphere physics. Unsafe predictions and escape trajectories prompt correction; there is no time limit.
- **Assistance:** contextual cues are on by default; expanded hints are opt-in. Highlight periapsis with plain-language labels, cue forward thrust, then cue release when the safe-orbit conditions hold. Warnings outrank hints; completion/failure outranks both.
- **Autopilot policy:** propulsion is manual; velocity alignment (`V`) remains available as an optional attitude assist. Automatic circularization (`X` / `circleNow`) is disabled through the adventure control policy, including direct control requests. The lesson focuses on burn timing and orbital effects; the offline-recovery premise does not imply that attitude assistance is broken.
- **Flight policy:** 1× simulation, no time-warp/focus switching; pause freezes simulation and guidance timers. Adventure propulsion supports a deliberate multi-second burn; acceleration and available controls require calibration. Sandbox propulsion remains unchanged.
- **Reset:** Retry restores the full starting world, focus, camera, controls/autopilot, objective state, hint history, and timers; returns to the opening briefing; clears held input. Return to menu stops the adventure and clears its state. URL adventure entry uses the same initialization path as menu selection.

## Handoff

- Step 1 has a pilot design; no feature code exists.
- Next session covers step 2: validate scenario numbers, specify observations/temporal rules, and identify telemetry, gentle-propulsion, and autopilot-restriction plugin/API seams. Update this document; feature implementation follows the specification.
- Inspect `plugins/core-pack-v1/src/orbit-telemetry/orbitReadout.ts`, `plugins/spacecraft-operator/src/{propulsionLimits,controlLogic,core}.ts`, and `plugins/standalone-pack-v1/src/ships/index.ts`. Readout apsides are center distances; adventure altitude subtracts Earth's radius. Maximum thrust is 1,000,000 m/s²; the lowest nonzero manual setting is approximately 1,372 m/s² and requires adaptation for this exercise.
- Keep observations reusable and adventure policy plugin-owned. Detailed director/presentation design remains open. Session completion includes a concise memory update and a concrete next task.
