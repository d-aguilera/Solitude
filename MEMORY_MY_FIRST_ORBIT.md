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

- **Scenario:** one craft at Earth-orbit apoapsis, facing Earth-relative prograde, autopilot initially off. Altitude is 400 km; predicted periapsis altitude is -50 km. The briefing states that automatic orbit recovery is offline, the trajectory intersects Earth, and manual forward thrust raises the orbit's lowest point. These targets are validated with normal solar data and production headless physics.
- **Flow:** selecting My First Orbit initializes a fresh scenario and paused opening briefing; Begin starts flight. Free Flight opens the existing sandbox. Completion/failure pauses flight and offers Retry or Return to menu.
- **Player actions:** inspect highlighted periapsis altitude, align to velocity (`V`) if needed, thrust forward (`Space`), release, and coast. Success depends on the orbit rather than a key sequence.
- **Success:** Earth-dominated bound orbit, periapsis altitude ≥150 km, apoapsis altitude ≤600 km, sustained for five unpaused real seconds without propulsion. Invalid observations, a primary change, or unmet conditions reset confirmation. This measures near-term safety, not indefinite N-body stability.
- **Failure:** actual Earth altitude ≤80 km, an adventure boundary without atmosphere physics. Unsafe predictions and escape trajectories prompt correction; there is no time limit.
- **Assistance:** contextual cues are on by default; expanded hints are opt-in. Highlight periapsis with plain-language labels, cue forward thrust, then cue release when the safe-orbit conditions hold. Warnings outrank hints; completion/failure outranks both.
- **Autopilot policy:** propulsion is manual; velocity alignment (`V`) remains available as an optional attitude assist. Automatic circularization (`X` / `circleNow`) is disabled through the adventure control policy, including direct control requests. The lesson focuses on burn timing and orbital effects; the offline-recovery premise does not imply that attitude assistance is broken.
- **Flight policy:** 1× simulation, no time-warp/focus switching; pause freezes simulation and guidance timers. Adventure propulsion is fixed at 10 m/s² for a deliberate multi-second burn. Sandbox propulsion remains unchanged.
- **Calibration and observations:** `docs/my-first-orbit-observations.md` specifies step 2. The initial 400 km / -50 km orbit supports recovery with fixed 10 m/s² manual forward/reverse thrust; forward recovery takes approximately six seconds. RCS translation and numeric thrust changes are disabled in the adventure. `V` requires an opt-in Earth-relative velocity reference because current alignment uses world velocity. Success uses completed-frame observations and final applied propulsion, never rendered thrust levels.
- **Reset:** Retry restores the full starting world, focus, camera, controls/autopilot, objective state, hint history, and timers; returns to the opening briefing; clears held input. Return to menu stops the adventure and clears its state. URL adventure entry uses the same initialization path as menu selection.

## Handoff

- Steps 1–3 are specified; no feature code exists. Read `docs/my-first-orbit-observations.md` for physics/observation rules and `docs/my-first-orbit-lifecycle.md` for objective state, entry, runtime ownership, suspension, and reset.
- Reset uses fresh world/configuration/scene/input/plugin instances; the standalone shell caches discovered factories only and owns generation-tagged replacement. The external standalone pack owns scenario, objective, policy, and localized session presentation through a typed capability. `?mode=my-first-orbit` and `?mode=free-flight` use the same pre-assembly selection as the menu. Explicit pause preserves coast progress; suspension resets it before physics; Begin/Resume rebase without a tick.
- Next session implements the generic disposable browser runtime and input reset/release gate described in the lifecycle specification: cancellation, listener/layout/presenter cleanup, partial-startup cleanup, and held-key suppression across replacement. Verify one live runtime after repeated construction. This is a prerequisite implementation slice; adventure scenario/objective follow it, while director and instrument design remain steps 4 and 5.
- Existing seams: direct world-model placement, ordered spacecraft propulsion resolvers, `beforeVehicleDynamics` control sanitization, and completed-world `loop.afterFrame` sampling. Required additions: shared validated orbit-observation capability and opt-in autopilot velocity-reference capability. Adventure policy stays plugin-owned; sandbox and multiplayer behavior remain unchanged.
- Calibration covers normal solar data, one poly-fighter, 30/60/120 Hz immediate burns, and 60/180-second delayed burns followed by 300 seconds of coast. Browser behavior, the new alignment assist, very late recovery, and runtime cost remain implementation/playtest checks. Detailed director/presentation design remains open.
