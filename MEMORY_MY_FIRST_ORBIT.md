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
- **Calibration and observations:** `docs/my-first-orbit-observations.md` specifies step 2. The initial 400 km / -50 km orbit supports recovery with fixed 10 m/s² manual forward/reverse thrust; forward recovery takes approximately six seconds. RCS translation and numeric thrust changes are disabled in the adventure. `V` uses the opt-in Earth-relative velocity reference; default sandbox alignment continues to use world velocity. Success uses completed-frame observations and final applied propulsion, never rendered thrust levels.
- **Reset:** Retry restores the full starting world, focus, camera, controls/autopilot, objective state, hint history, and timers; returns to the opening briefing; clears held input. Return to menu stops the adventure and clears its state. URL adventure entry uses the same initialization path as menu selection.

## Handoff

- Steps 1–4 are specified. The generic browser lifetime prerequisite and standalone entry/scenario/session slice are implemented. Read `docs/my-first-orbit-observations.md` for physical predicates and `docs/my-first-orbit-lifecycle.md` for lifecycle rules. Shared validated orbit observations, completed-frame objective confirmation/failure, and terminal presentation are implemented. Director and instrument presentation are specified in `docs/my-first-orbit-guidance.md` but not implemented.
- Standalone opens a localized start menu by default; locale alone preserves the menu. Explicit `?mode=my-first-orbit` / `?mode=free-flight` and legacy simulation/debug URL shortcuts share the launch path. Unknown modes show a selection error. Return to menu clears entry/tuning parameters and future launch tuning while retaining locale.
- The shell caches discovered factories, constructs fresh plugins/config/world/scene/input for each generation, retains one keyboard host across runs, and owns deferred replacement/disposal. The external standalone pack publishes `solitude.standaloneSession.v1` through `@solitude/plugin-api/standalone-session`, owns localized menu/briefing/pause/suspension content, and supplies the adventure scenario. Stale callbacks are generation-guarded; startup/fatal renderer failures offer Return to menu.
- The atomic standalone pack contains an early `standaloneSession` and last `adventureFinalPolicy`. Sandbox `ships` contributes only in Free Flight; the adventure contributes only `ship:first-orbit`, at calibrated Earth-relative 400 km / -50 km with prograde attitude and zero angular velocity. Assembly validates required providers, sole controllable craft, and focus. Adventure launch forces normal solar data and excludes conflicting URL options.
- Adventure starts in briefing. Begin/Resume clear input and rebase without a tick. Pause, blur/visibility loss, frame gaps over 250 ms, and invalid/backwards clocks freeze flight; suspension requires explicit Resume. Retry requests immediately block flight and construct a fresh generation in briefing. Input gates survive replacement. Explicit pause preserves coast progress; resume rebases its first eligible sample without pause credit. Suspension resets confirmation immediately.
- Adventure playback, sandbox pause/time scale, and focus-switch factories remain in the pack but publish no behavior for adventure instances. Early direct-input sanitization and final keyboard/frame/propulsion policy enforce 1× manual ±10 m/s² with no RCS/numeric thrust changes. `V` is enabled through the opt-in `spacecraft.velocityReference.v1` capability and aligns to Earth-relative velocity; all other autopilot modes remain blocked. Missing/invalid references produce no alignment command; multiple active references are configuration errors. The briefing explains the success thresholds and manual corrections; contextual guidance remains pending. Sandbox and multiplayer behavior retain their previous assembly.
- `orbitTelemetry` publishes `solitude.orbitObservation.v1` through `@solitude/plugin-api/telemetry`. Its explicit-entity sampler clears unavailable fields, validates finite physical/derived data and nonzero angular momentum, preserves negative periapsis altitude, and leaves escape apoapsis absent. Primary selection has a retained `Into` lookup.
- The final adventure policy invalidates command availability before each tick, records any final manual propulsion, verifies that its resolver is last, and samples once after each completed advancing frame. A retained sample identifies generation, sequence, entity/primary, simulation time, and real time; explicit Earth distance is independent of orbital validity. `solitude.adventureObjective.v1` exposes the latest sample, reversible safety/confirmation state, elapsed coast time, and retained transition counters for the director.
- Five consecutive eligible unpaused real seconds latch completion; actual Earth altitude ≤80 km latches failure first. Invalid, unsafe, propelled, unknown-command, changed-entity/primary/generation, and discontinuous samples reset confirmation. Terminal phases block the next tick and present localized Retry/Return to menu actions. Retry constructs fresh samples/objective/transitions with the existing held-input release gate.
- Tests cover mode/scenario selection, clocks, replacement/stale callbacks, direct restrictions, validated observations, Earth-relative alignment, exact objective thresholds, 4.999/5 seconds, burn-frame exclusion, unknown commands, duplicate samples, pause/suspension/reset, terminal latching, and failure precedence. Frame integration tests use a stub orbit provider; the production provider has physical-data tests. Full typecheck/tests and standalone production build pass. Real browser playtesting, end-to-end production-physics completion/failure, very late recovery, and runtime-cost checks remain outstanding.
- Director design uses one prioritized current-state cue, immediate warning/release replacement, opt-in expanded hints, active-flight cooldowns, and an assistance-only alignment deadband. Shared samples and objective state drive advice; retained transition counters are not event queues, and safe-entry acknowledgments use state edges because propelled safe frames can repeat the counter. Adventure-owned altitude instruments avoid reinterpreting the existing center-distance HUD rows. A separate narrow guidance capability supplies the generic shell with localized presentation and hint controls. See `docs/my-first-orbit-guidance.md` for ownership, timings, identifiers, and acceptance cases.
- **Next task (implementation):** implement the pure retained director, typed `solitude.adventureGuidance.v1` capability, en/es/fr cues/hints, completed-frame evaluation after objective sampling, and session pause/suspension/reset integration. Test the guidance acceptance cases before connecting the adventure flight panel and hint controls in the following presentation slice. Browser/production-physics playtesting and runtime-cost measurement remain step 6.
