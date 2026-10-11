# My First Orbit: objective and lifecycle specification

This is the step 3 design. Physical predicates and confirmation rules are defined
in [the observation specification](my-first-orbit-observations.md). This document
chooses runtime ownership, objective state, entry, pause, suspension, and reset.
The generic browser runtime/input lifetime prerequisite and standalone entry,
scenario, session, and menu UI are implemented. Completed-frame objective sampling and latched terminal
outcomes and the retained director/guidance capability are implemented.
Instrument presentation and hint controls remain step 5.

## Ownership and reset decision

Retry creates a fresh runtime, world configuration, scene, input dispatcher,
capability registry, and plugin instances. Do not restore a motion snapshot into
an existing run. Spacecraft operator maps, autopilot maneuver state, plugin
controllers, keyboard toggles, and scene controls all belong to the run.

The standalone composition shell owns selection and runtime replacement. It
caches validated discovered plugin factories/modules, not instantiated plugins.
Each launch calls `loadPlugins` with new resolved runtime options, builds a new
configuration, applies world-model contributors, and bootstraps rendering. Only
one runtime may be live. Retry disposes the old runtime before constructing the
replacement; Return to menu disposes it without constructing another.

The browser host owns generic resource lifetime and browser event delivery. The
external standalone pack owns the scenario, objective, adventure control policy,
and session presentation model. Share those through a narrow typed capability
exported by `@solitude/plugin-api`, rather than importing plugin implementations
into the shell. The shell translates accessible menu actions into capability
commands and executes requested lifecycle operations at a frame boundary. It
does not compute orbital predicates or advance guidance timers. Menu strings and
briefing/outcome content belong to the external pack and its localized bundles.

Fresh construction is an infrequent menu action; it does not justify per-frame
snapshots, world cloning, or event-array allocation. Renderer and listener
cleanup is necessary before this choice can work.

## Selection before world assembly

Use the explicit standalone URL selector `?mode=my-first-orbit` or
`?mode=free-flight`. No selector opens the start menu, with My First Orbit and
Free Flight choices, before a world or animation loop is constructed. An unknown
mode displays a selection error with a route back to the menu; do not silently
start a different scenario. Keep other existing URL options as Free Flight
direct-entry shortcuts when no mode is supplied. Locale alone does not bypass
the menu. Explicit mode takes precedence over those shortcuts.

Resolve entry once in standalone composition. Menu launch and URL launch use the
same function and validated selection. Pass the selection as a reserved runtime
option before plugin factory calls; plugins must not read `window.location`.
The selected mode remains fixed for the lifetime of those instances. Retry uses
the same selection, not the current address bar. Returning to menu removes the
mode and direct-entry simulation/debug options from the address bar while
retaining locale; the app remains at the menu until another explicit launch.
Changing URL text alone does not mutate an active world. Browser history-based
navigation is outside the pilot; use replacement rather than adding run entries.

Keep the standalone pack atomic: do not remove individual discovered entries.
The existing `ships` contributor constructs sandbox craft only for Free Flight.
A new adventure world-model contributor constructs exactly one poly-fighter and
sets its focus only for My First Orbit. The solar-system contributor still runs
first. Both contributors stay in the pack and return without contributions for
the other mode. Assert one controllable scenario craft and the required Earth
provider before runtime startup.

Adventure selection forces normal solar data (`orbitalSpeedMultiplier = 1`)
regardless of URL sandbox tuning. Conflicting playback/time-scale/focus options
cannot enter its run configuration. Scenario altitude, initial velocity and
attitude, propulsion, and thresholds follow the observation specification.
Free Flight retains its existing scenario and tuning. Multiplayer retains its
existing lobby and plugin assembly.

## Run state and objective state

A monotonically increasing generation is allocated by the standalone shell for
each launch, including retry. Async callbacks and lifecycle requests carry that
generation; the shell ignores requests from an old or disposed run. The plugin
receives it at construction. One retained session record contains:

- Immutable generation, mode, scenario entity ID, and Earth ID.
- Phase: `briefing`, `flying`, `paused`, `suspended`, `completed`, or `failed`.
- Suspension reason: hidden document, lost window focus, frame gap, or clock
  discontinuity; absent outside suspension.
- Objective status: `recovering`, `confirming`, `completed`, or `failed`;
  accumulated coast milliseconds and a nullable last eligible sample timestamp.
- Latest sample sequence/validity, latched terminal sequence/reason, active-flight
  guidance time, and director hint/transition state reserved for step 4.
- Opt-in expanded-hint preference, initially off for each new adventure run.

Menu and loading/error states belong to the shell, outside a run. Objective
status is independent of phase: an explicitly paused confirming orbit retains
its accrued confirmation. A new run starts in briefing with `recovering`, zero
elapsed time, no samples, no terminal result, and empty guidance history.

There is one objective: recover a safe orbit, then coast for five unpaused real
seconds. Its visible progress has two reversible stages, recovery and coast
confirmation. Safety entry is not a permanent completed subobjective. Exact
unrounded observations drive eligibility. Once completed or failed, the outcome
is immutable until disposal. Only completed advancing samples can evaluate it;
UI commands and HUD refreshes never evaluate an accomplishment.

## Commands and transitions

| Current phase | Command or condition                                      | Result                                                                                                               |
| ------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Briefing      | Begin, with document visible and window focused           | Clear input; enter flying with a fresh time baseline.                                                                |
| Flying        | Pause (`P` or menu action)                                | Enter paused before the next tick; preserve coast progress and guidance time; clear input and eligibility timestamp. |
| Paused        | Resume (`P` or Resume), visible and focused               | Enter flying; first frame rebases time without a physics tick.                                                       |
| Flying        | Visibility/focus loss, gap >250 ms, or nonmonotonic clock | Enter suspended before physics; reset coast confirmation; clear input and eligibility timestamp.                     |
| Suspended     | Explicit Resume, visible and focused                      | Enter flying with a fresh baseline; no automatic restart on visibility/focus return.                                 |
| Flying        | First valid Earth altitude sample ≤80 km                  | Latch failed; freeze subsequent simulation.                                                                          |
| Flying        | Eligible coast reaches 5,000 ms                           | Latch completed; freeze subsequent simulation.                                                                       |
| Any run phase | Retry                                                     | Request replacement; dispose this run; new generation starts at briefing.                                            |
| Any run phase | Return to menu                                            | Request disposal; clear run state; show start menu.                                                                  |

Other commands have no effect. Begin cannot skip the briefing through `P`.
Terminal screens offer Retry and Return to menu, with no Resume. Briefing offers
Begin and Return to menu; pause and suspension offer Resume, Retry, and Return to
menu. Resume remains unavailable while hidden or unfocused. A suspension while
already paused or in briefing clears input and rebases timing without changing
phase or forfeiting preserved progress. Terminal phases remain latched.

Process Retry/Return first, then suspension, then Pause/Resume/Begin, before
simulation. A stop request immediately prevents another tick, even when actual
resource disposal is deferred until the current callback finishes. Failure takes
precedence over completion on the same completed sample. Terminal presentation
may appear on the next render; the next simulation tick must already be blocked.
Commands are consumed once, not held booleans that repeat every frame.

## Frame clock, pause, and suspension

Use animation-frame monotonic timestamps for flight/guidance time, not wall-clock
calendar time. The existing engine applies loop-policy contributors before its
physics tick, so discontinuity detection belongs in the early adventure loop
hook. `afterFrame` is too late to prevent a stalled frame from advancing physics.

Before Begin, observe completed presentation frames while the briefing freezes
simulation, objectives, and guidance. Begin stays disabled with a localized
Preparing flight label until 500 ms of consecutive focused, visible, finite,
monotonic frames with positive deltas ≤250 ms have completed. A discontinuity
resets this initial streak. Readiness latches for this generation; Retry starts
fresh. Return to menu stays available. This startup gate does not relax flight
interruption rules or establish a texture-loading dependency.

At Begin/Resume, the next callback is a baseline frame: no simulation advance,
no objective sample, no guidance time credit. Subsequent active frames require
finite positive delta ≤250 ms and a monotonic timestamp. A delta of exactly
250 ms is permitted; greater gaps suspend. A repeated timestamp advances
nothing; a backwards or nonfinite clock suspends and resets confirmation. Do
not clamp a long delta and continue, catch up missed ticks, or credit a suspended
interval. Visibility and blur notifications suspend immediately, independently
of the next animation callback.

Explicit pause freezes all guidance timers and preserves coast milliseconds.
On resume, the first completed eligible sample rebases the confirmation
sample timestamp without adding elapsed time. An ineligible sample resets the
preserved progress. Suspension instead resets confirmation immediately and
emits its reset transition once; it freezes other guidance time/history. Retry
clears all of them. Each final-command observation is invalidated before a new
tick and marked available only if the scenario resolver runs for that tick.

## Input and plugin order

Add two adventure loop contributors to `standalone-pack-v1`, sharing the
session capability. Order them explicitly:

1. Adventure session/early policy, before playback, pause, time scale, and
   operator switch. It consumes lifecycle actions and clears forbidden direct
   loop requests before those plugins can retain side effects.
2. Existing standalone loop contributors in their current relative order.
3. Adventure final policy, after all other loop-policy contributors. It forces
   1× timing for eligible flight, removes diagnostic fixed-tick overrides, and
   blocks simulation and scene controls in every other phase. Presentation stays
   available for briefing, pause, suspension, and terminal screens.

The early policy also implements `beforeVehicleDynamics` sanitization for
focused and entity-addressed controls. The last propulsion resolver enforces
manual ±10 m/s² with zero RCS and records the applied command. Verify loop and
resolver ordering in composition tests; keyboard handlers run in reverse plugin
order and require their own adventure guard. Disabled diagnostic playback must
not capture, restore, or step the adventure even through direct requests.

A host input handle must support clearing dispatcher control state and pending
provider toggles. Releasing a held key after reset is harmless. Track physical
keys suppressed by a clear and ignore repeat keydown events until keyup, so a
held Space, P, or V cannot reactivate across Begin, Resume, Retry, or menu entry.
Clear input on blur/visibility loss too. The shell retains this release gate
across runtime replacement and applies it to a newly constructed dispatcher;
it owns no semantic spacecraft policy. Simulation input clearing alone cannot
clear closure-local handler state: recreate handlers for a new run, and define
an explicit reset hook for clearing pending handler state within a paused run.

## Runtime disposal contract

`bootstrapRendering`/`bootstrapWith` return a generic runtime handle with
idempotent `dispose` and `clearInput`. The shell creates a
`createBrowserKeyboardHost` once, passes it into each rendering bootstrap, and
disposes it when the shell ends. Runtime disposal detaches its input binding;
the host continues tracking physical key releases between runs. Layout/DPR
cleanup is per instance. The implemented teardown contract is:

- Mark the runtime stopped before cleanup, cancel its outstanding animation
  callback, and prevent an already executing callback from scheduling another.
- Remove keyboard, visibility/focus, resize, DPR, and pagehide listeners through
  per-instance cleanup handles; clear control state and pending input.
- Dispose every view presenter exactly once and remove run-owned view elements.
- Drop references to pipeline, plugin instances, world, and scene; detach
  session UI subscriptions and ignore late generation-tagged notifications.
- Clean partially constructed views/listeners if startup fails. The shell shows
  a startup/render error with Return to menu and permits a fresh launch.

Avoid page reload as retry. Loop initializers may return cleanup, which the
pipeline releases on disposal or failed startup; the pause plugin uses this for
its visibility subscription. This is resource cleanup, not plugin hot unloading.
Factories must own no untracked browser listeners or background work. Any new
subscription must return a disposer. Fatal render failure stops the run;
it is an infrastructure error, not an orbital failure. Host lifetime changes
must preserve remote-client behavior, even though its lobby flow stays unchanged.

## Acceptance and implementation handoff

Lifecycle acceptance covers default menu and both URL entries; no duplicate
sandbox craft; initial paused briefing; Begin without held thrust; fresh retry
from every phase; full operator/autopilot/camera/focus restoration; stale-run
callbacks; pause during confirmation; visibility and focus suspension; frame gap
before physics; explicit resume without time credit; terminal latching; failure
precedence; blocked direct playback/time-warp/focus requests; and startup failure
with cleanup. Retrying repeatedly must leave one animation loop, one input
listener set, and one layout listener set, with all retired presenters disposed.
Use meaningful lifecycle tests and the step 2 objective acceptance cases.

The browser lifetime prerequisite is implemented and tested with stubbed browser
events, animation scheduling, presenters, and pipeline construction. It covers
repeated replacement, disposal inside a callback, startup failure, held-key reset,
pending handler input, subscription cleanup, and retired callbacks. Real browser
playtesting and runtime-cost measurement remain step 6.

The standalone entry/scenario slice implements pre-assembly selection, a calibrated
craft, fresh run generations, and shared launch/retry/menu paths using the retained
keyboard host. The pack owns session content and manual-flight policy; the shell
uses its typed session capability. Playback/time-scale/focus plugins remain atomic
pack entries and contribute no behavior in adventure instances. `V` uses the opt-in Earth-relative velocity reference; other autopilot modes
remain blocked.

The sampling slice implements `solitude.orbitObservation.v1`, a final-command
ledger whose resolver must be last, one retained sample per completed advancing
frame, and `solitude.adventureObjective.v1`. Confirmation credits five eligible
unpaused real seconds; explicit Earth boundary failure takes precedence.
Pause preserves accrued progress and rebases resume; suspension resets it.
Terminal presentation is localized and offers Retry and Return to menu.
The objective exposes retained transition counters and its latest sample for the
next director slice; presentation does not advance the objective.

Director feedback priorities, cues, opt-in hints, cooldowns, semantic instrument
identifiers, and acceptance cases are specified in
[the guidance specification](my-first-orbit-guidance.md). The next session
connects the adventure flight panel and hint controls to the implemented retained
director/guidance capability and its completed-frame/session integration. Real browser playtesting,
end-to-end production-physics outcomes, and runtime-cost verification remain step 6.
