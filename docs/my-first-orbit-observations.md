# My First Orbit: observations and accomplishment specification

This is the step 2 specification. It defines scenario calibration, reusable
observations, temporal rules, and the external plugin seams needed by the pilot.
Shared observations, completed-frame objective sampling, and the Earth-relative
alignment reference are implemented alongside the step 3 lifecycle. Director priorities and semantic instrument presentation remain steps 4
and 5.

## Calibrated scenario

Use the normal solar-system content (`orbitalSpeedMultiplier = 1`) and one
poly-fighter. Earth has radius 6,371,000 m and provider-derived mass
5.972802939487484e24 kg; use the provider values rather than hard-coded mass.
The current poly-fighter mass is 1.5168515625e17 kg. Include its gravity in
calibration, although the osculating observation uses `G * primary.mass`, matching
the existing orbit readout.

Construct the craft at apoapsis with Earth-relative altitude 400,000 m and
predicted periapsis altitude -50,000 m. For Earth radius `R`, use
`ra = R + 400000`, `rp = R - 50000`, `a = (ra + rp) / 2`, and
`v = sqrt(mu * (2 / ra - 1 / a))`. Add Earth's velocity to this tangential
relative velocity. Initial relative speed is approximately 7,539.984 m/s.
Set the attitude from the relative velocity, with zero angular velocity and
autopilot off. `createOrbitingPlacement` constructs a circular orbit and aligns
to world velocity, so it cannot supply this scenario unchanged.

Use a fixed main-engine acceleration of 10 m/s² while holding forward or reverse
thrust. Disable lateral RCS translation and numeric thrust-level changes during
the adventure. Manual attitude controls and `V` remain available. Reverse thrust
provides an overshoot correction; initial guidance teaches forward thrust only.
There is no automatic engine cutoff: the player chooses when to release.
Sandbox retains its current acceleration and controls.

At the starting apoapsis, impulsive estimates are:

| Outcome                                 | Required added prograde speed | Burn at 10 m/s² |
| --------------------------------------- | ----------------------------: | --------------: |
| Periapsis reaches 150 km                |                    60.521 m/s |         6.052 s |
| Circular orbit at 400 km                |                   133.022 m/s |        13.302 s |
| Apoapsis reaches the 600 km upper limit |                   188.656 m/s |        18.866 s |

These estimates provide a roughly 13-second release window after first reaching
the safety threshold. The six-second burn is one action inside the approximately
five-minute guided experience, not a minimum total adventure duration. Do not add
an artificial wait to extend play time.

### Headless calibration evidence

Calibration uses the current solar-system world, production Newtonian gravity
provider, spacecraft operator, poly-fighter entity, and `computeOrbitReadoutInto`.
The temporary diagnostic harness adds a propulsion resolver producing
`10 / maxThrustAcceleration` for forward thrust, with zero RCS. It steps the
headless loop at 1×, releases on the first sample satisfying periapsis ≥150 km
and apoapsis ≤600 km, then coasts for 300 seconds. The initial radial offset is
`(+ra, 0, 0)` and relative velocity is `(0, v, 0)`; the craft keeps its initial
attitude throughout. Delayed burns use the same attitude, with no alignment
assist. All other solar bodies remain in the normal world.

| Tick rate | Wait before burn | Burn duration | Minimum periapsis during coast | Maximum apoapsis during coast |
| --------- | ---------------: | ------------: | -----------------------------: | ----------------------------: |
| 30 Hz     |              0 s |       6.067 s |                     150.488 km |                    400.000 km |
| 60 Hz     |              0 s |       6.067 s |                     150.488 km |                    400.000 km |
| 120 Hz    |              0 s |       6.058 s |                     150.208 km |                    400.000 km |
| 60 Hz     |             60 s |       6.083 s |                     150.476 km |                    400.057 km |
| 60 Hz     |            180 s |       6.200 s |                     150.080 km |                    400.454 km |

A second sweep releasing at 175 km takes 6.800 s at each of 30, 60, and 120 Hz
and retains periapsis ≥175.250 km over the coast. This is evidence of margin,
not a new success threshold. With no burn, actual altitude crosses the 80 km
failure boundary after approximately 1,709.417 s (28.49 minutes) at 60 Hz; initial
osculating period is 5,270.501 s. The unsafe prediction is urgent guidance, not
an imminent five-minute forced failure.

This validates immediate and three-minute-delayed recovery under production
N-body physics. It does not validate arbitrary departure directions, very late
recovery, browser input timing, the proposed alignment assist, or indefinite
stability. Those require implementation checks and step 6 playtesting. The
temporary harness lives outside tracked source; the recipe above records its
inputs and release rule for reproduction.

## Reusable observations

Observations describe the physical state without adventure thresholds or prose.
Keep them in external plugins and expose narrow typed capabilities through
`@solitude/plugin-api`; do not import another plugin's implementation.

One retained observation record is updated once after each completed advancing
frame for the scenario entity. Identify it with a run generation, monotonically
increasing sample sequence, entity ID, primary ID, simulation timestamp, and
monotonic real timestamp. Consumers share that sample; HUD rendering must not
advance objective timers or compute another accomplishment sample.

| Observation                  | Meaning and validity                                                                                                                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orbitValid`                 | Relative position/velocity and primary mass/radius are finite; radius and mu are positive; derived eccentricity and periapsis are finite and nonnegative. Reject zero angular momentum for this pilot's safe-orbit decision. |
| `primaryId`                  | Current dominant gravity body, using the existing world primary-selection rule.                                                                                                                                              |
| `isBound`                    | Negative specific orbital energy and eccentricity <1. Unbound is a valid unsafe observation; its apoapsis is absent, not a fabricated finite value.                                                                          |
| `altitudeMeters`             | Center distance minus the selected primary's physical radius.                                                                                                                                                                |
| `periapsisAltitudeMeters`    | Predicted center-distance periapsis minus primary radius; may legitimately be negative.                                                                                                                                      |
| `apoapsisAltitudeMeters`     | Predicted center-distance apoapsis minus primary radius for a valid bound orbit; otherwise absent.                                                                                                                           |
| `radialSpeedMetersPerSecond` | Relative velocity projected onto the primary-relative radial direction.                                                                                                                                                      |
| `progradeAlignmentCosine`    | Dot product of normalized forward and primary-relative velocity; absent when either direction is invalid or velocity is negligible.                                                                                          |
| `propulsionActive`           | Any nonzero final main/RCS command applied to this entity during the completed frame; unavailable if the command observer did not run. Attitude rotation alone is not propulsion.                                            |

Earth altitude for failure is a separate explicit-body distance observation. It
remains usable if the dominant primary changes or orbital calculations fail.
Missing Earth/entity state makes it unavailable, never a safe value. Do not use
the current dominant primary's altitude as a substitute for Earth altitude.

Orbit computation returns validity explicitly and clears unavailable fields so
an invalid sample cannot expose previous apsides. The current readout's `true`
return does not establish finite derived values: wrap or strengthen validation
before using it for decisions. A near-circular orbit can have absent apsis times
and still be valid. Apsis timing is optional guidance, not required for success.

Reuse preallocated records and math scratch, cache primary radius lookup for the
world lifetime, and avoid per-frame event arrays or full-world snapshots. The
existing primary lookup allocates a result and scans spheres/masses; introduce
an `Into` variant or equivalent retained lookup when sharing the sampler rather
than multiplying those scans across consumers. Runtime-cost verification belongs
to step 6; no CPU budget claim is established by this calibration.

## Pilot predicates and temporal accomplishments

Thresholds are adventure configuration, with SI units and inclusive boundaries:

- `safeOrbit`: valid observation for the scenario craft; primary is
  `planet:earth`; bound orbit; periapsis altitude ≥150,000 m; finite apoapsis
  altitude ≤600,000 m.
- `coasting`: valid final-command observation and no applied main or RCS thrust.
- `belowBoundary`: valid explicit Earth altitude ≤80,000 m.
- `progradeAligned`: valid alignment cosine ≥`cos(10 degrees)`. This is an
  assistance predicate, never a success requirement.

The objective evaluates only while flight is active. Evaluate failure first;
`belowBoundary` produces a latched failure on its first completed sample. Safe
predictions do not override actual boundary failure. Invalid orbital data alone
does not produce failure.

Confirmation starts on the first completed sample with `safeOrbit && coasting`,
with elapsed time zero. For subsequent consecutive eligible samples, add the
positive monotonic real-time delta between those samples. At accumulated
5,000 ms, latch completion. Never credit the interval before the first eligible
sample, or an interval whose preceding sample is unsafe/propelled. The last burn
frame cannot start a coast interval, even if its final orbit is safe.

Any unsafe sample, invalid required observation, unknown final propulsion,
primary/entity change, run-generation change, or nonmonotonic clock resets
confirmation to zero. These do not create terminal outcomes by themselves.
There is no threshold hysteresis for completion: rounded HUD values cannot
qualify an unsafe orbit. A held thrust key with zero effective acceleration is
coasting; an autonomous or direct-control burn is propulsion regardless of keys.

Explicit pause preserves accumulated confirmation and freezes all guidance
timers. Resume requires a fresh eligible sample and rebases its timestamp,
crediting no paused interval. A frame gap greater than 250 ms is a discontinuity:
reset confirmation and request suspension before another physics tick. This
prevents tab suspension or a stalled frame from earning five seconds or jumping
through the Earth boundary. Step 3 must define suspension/resume integration;
ordinary 30 Hz flight stays well within this bound. Time-warp requests cannot
alter the 1× adventure clock.

The reusable hold rule owns elapsed time and eligibility only. The objective
latches terminal outcomes once per run. `safeOrbitEntered`,
`confirmationStarted`, `confirmationReset`, and `safeOrbitConfirmed` are semantic
transitions available to later guidance; retry clears their history. Safety
entry is reversible and does not mark a required permanent milestone. A player
can complete with any physically qualifying orbit, without pressing a prescribed
key sequence or using alignment assistance.

Acceptance cases for implementation include exact thresholds; 4.999 s versus
5 s; a burn on the otherwise-completing sample; invalid/unbound/changed-primary
samples; pause/resume with preserved elapsed time and no pause credit; frame
gaps and backwards clocks; failure/completion on the same frame; repeated
terminal samples; and retry with held input and stale sample generations.

## Existing seams and required additions

### Shared telemetry

`plugins/core-pack-v1/src/orbit-telemetry/orbitReadout.ts` already computes
relative orbital elements, and `orbitTelemetry` publishes the reusable `solitude.orbitObservation.v1`
capability through `@solitude/plugin-api/telemetry`.
Expose an explicit-entity `sampleInto` operation and validity; the adventure
sampler owns frame sampling and shares its retained result with objective and
guidance. Keep Earth thresholds outside that provider.

Use the browser external `loop.afterFrame` hook for completed-world sampling.
`simulation.afterVehicleDynamics` precedes gravity and collision resolution,
so it is appropriate for final propulsion bookkeeping, not final orbital
evaluation. Gate sampling with the resolved `framePolicy.advanceSim`, active
flight state, and a real simulation advance. Terminal outcome latching prevents
the next tick through the adventure loop policy. No broader physics hook export
is necessary for this pilot; headless calibration samples after `loop.step`.

### Gentle propulsion and command observation

`@solitude/plugin-api/spacecraft` exposes ordered propulsion resolvers. Add an
adventure-owned resolver after the autopilot resolver. During active adventure
flight it derives manual signed thrust directly from `burnForward` and
`burnBackwards` (both pressed cancel), scales to `10 / maxThrustAcceleration`,
and produces zero RCS. During briefing, pause, suspension, and terminal states
it produces zero propulsion. Outside the adventure it returns the incoming
command unchanged. Reuse its output object.

The adventure resolver must be last and record its actual outgoing command for
the scenario entity. Verify that ordering in composition. The focused operator
telemetry reports rendered integer levels, not physical acceleration, and a
nonzero resolver command at stored level zero can still render zero. Therefore
those HUD levels cannot establish coasting. Command observation must cover the
completed tick and distinguish unavailable data from zero. If a future assembly
allows later resolvers, move observation to an operator-owned final-command
capability rather than recording an intermediate result.

### Autopilot and control restrictions

Use an adventure `beforeVehicleDynamics` hook to sanitize mutable control input
before operator control-state updates and attitude resolution. Clear `circleNow`
and unsupported actions in both focused input and entity-addressed inputs; do
not depend on hiding the `X` keyboard binding. The final manual-only resolver
also prevents autonomous propulsion from escaping the policy. For the pilot,
allow manual attitude and velocity alignment; clear `alignToBody` and `orbit`
to keep assistance focused on the lesson. Disallowed requests never select or
persist an autopilot mode.

The default `V` implementation normalizes world velocity. At the calibration starting location it differs from
Earth-relative prograde by approximately 86 degrees. The opt-in `spacecraft.velocityReference.v1` capability through
`@solitude/plugin-api/spacecraft` lets an active
adventure provider selects Earth as the reference for the scenario entity, and
the autopilot subtracts that reference entity's velocity before alignment.
With no active reference provider, retain world-velocity behavior. Missing or
invalid requested reference yields no alignment command, not world-velocity
fallback. One active provider is allowed per entity; conflicting selections are
configuration errors. The provider chooses the reference; autopilot continues
to own attitude control. Do not mutate world velocity to trick the controller.

### Scenario and flight lifecycle

`worldModel.contributeWorldModel`, celestial-body provider lookup, and
`controllableEntityProvider.createEntity` support direct scenario placement.
The current standalone ships contributor adds two sandbox craft; adventure
selection must choose a scenario contributor before world assembly so that
those craft are not also added. Only one craft is controllable in the pilot.
Runtime reset/menu ownership and the selection mechanism are step 3 work.

Standalone pause/time-scale/playback/operator-switch behavior is plugin-owned.
While selected, an adventure input-policy loop contributor must run before these
handlers to clear disallowed requests; a final loop-policy contributor must run
after them to enforce pause/suspension and 1×. They share adventure state through
a capability. A single late loop hook cannot prevent an earlier handler's side
effects. The step 3 assembly design must establish both positions explicitly.
Numeric thrust keys, focus switching, time-scale changes, and diagnostic playback
cannot bypass it. A keyboard input lock alone cannot restrict direct requests.
Keep free-flight behavior and multiplayer assembly unchanged.

The operator stores per-entity thrust/autopilot state in closure-local maps, and
autopilot also retains maneuver state. A motion snapshot alone cannot satisfy
retry. Step 3 must choose fresh runtime/plugin instances or explicit reset
contracts covering those stores, pending keyboard toggles, camera/focus,
observations, and objective/guidance timers. This is an implementation dependency,
not missing information needed to complete step 2.
