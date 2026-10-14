# My First Orbit architecture issues

## Current effort and session rules

All six issues below are accepted and important. Resolve them in numbered order,
one issue per fresh session. The HUD/screen rearrangement effort is on hold until
all six architecture issues are fixed.

- Read `MEMORY.md`, `MEMORY_MY_FIRST_ORBIT.md`, and this document at session start.
- The next fresh session starts with **issue #1: control restrictions depend on
  plugin order**. Inspect the actual callback chains before choosing the fix.
- Implement and validate the current issue, then update its status here and the
  explicit next task in `MEMORY_MY_FIRST_ORBIT.md`.
- Continue the exact `My first orbit N` commit series. Inspect Git history for
  the next number; keep each issue's changes separate from the other issues.
- Preserve gameplay behavior, physical thresholds, plugin boundaries, and the
  CPU/allocation constraints in `MEMORY.md`. Avoid building a general campaign
  system as part of these fixes.
- Follow `MEMORY.md` formatting and validation requirements for code changes.
  Report any checks not run.

The review found no direct engine onion or external-plugin import violations.
`npm run check:boundaries` passed, and 95 targeted tests passed across seven
files. The findings concern responsibility and runtime dependencies that the
existing import checks do not fully assess.

## Issue #1 — Control restrictions depend on plugin order

**Status:** Pending; next fresh session.

**Concern:** Coupling and policy enforcement.

`adventure/final.ts` checks that its propulsion resolver is last, but equivalent
assumptions for keyboard dispatch and frame-policy overrides are unguarded.
`adventure/index.ts` sanitizes direct input among ordinary simulation hooks.
Keyboard handlers run in reverse provider order, propulsion resolvers run in
provider order, and loop callbacks mutate a shared frame policy. Adding or
reordering plugins can change enforcement.

Relevant code:

- `plugins/standalone-pack-v1/src/adventure/final.ts`
- `plugins/standalone-pack-v1/src/adventure/index.ts`
- `plugins/standalone-pack-v1/src/adventure/policy.ts`
- `packages/input/src/keyboard.ts`
- `packages/engine/src/app/gamePipeline.ts`
- `packages/engine/src/app/pluginRuntime.ts`
- `plugins/standalone-pack-v1/vite.config.ts`

**Direction:** Introduce explicit final policy phases, or validate every
required ordering constraint during composition. Choose the smallest coherent
solution after tracing keyboard, direct-input, simulation, frame-policy, and
propulsion paths; checking only the propulsion resolver is insufficient.

**Completion criteria:** Policy precedence is explicit and enforced. Tests
cover conflicting/reordered contributors and demonstrate that unsupported
assembly fails clearly or cannot override adventure restrictions. Preserve
pause/suspension, manual propulsion, disabled controls, and completed-frame
objective sampling; retain Free Flight and multiplayer behavior.

## Issue #2 — Objective rules import scenario construction

**Status:** Pending.

**Concern:** Onion layering.

`adventure/objective.ts` and `adventure/guidance.ts` import entity identifiers
from `adventure/scenario.ts`, which also owns provider discovery and world
construction. Rules therefore depend on an outer setup module. The boundary
checker enforces onion layers only inside the engine and misses this dependency.

**Direction:** Move scenario identifiers and rule parameters into a
dependency-free definition consumed by both setup and rules, or supply them
through explicit parameters. Keep world construction and capability discovery
outside objective rules.

**Completion criteria:** Objective and guidance rules no longer import scenario
construction. Their dependencies point inward, and existing scenario and
objective behavior remains covered by tests.

## Issue #3 — Gameplay observations are owned by a presentation plugin

**Status:** Pending.

**Concern:** Coupling and capability ownership.

`plugins/core-pack-v1/src/orbit-telemetry/index.ts` publishes both the telemetry
HUD and the orbital observation provider implemented in `observation.ts`. The
adventure requires that provider through `adventure/final.ts`, so removing or
replacing a presentation plugin also removes a gameplay dependency.

**Direction:** Give orbital observations an independently composable provider;
let both HUD and adventure consume it. Preserve the external plugin boundary
and the retained, explicit-entity sampler rather than moving scenario knowledge
into the host engine.

**Completion criteria:** Gameplay observations are available without activating
the orbital telemetry HUD. HUD and adventure share the observation service with
unchanged validity, unavailable/escape/negative-altitude semantics, and no new
per-frame allocation burden.

## Issue #4 — Session owns lifecycle, clocks, presentation, and guidance assembly

**Status:** Pending.

**Concern:** Single responsibility.

`adventure/session.ts` manages phase transitions, simulation eligibility,
startup frame stability, localized dialog construction, objective creation,
guidance creation, and orbit-line state. These responsibilities change for
different reasons and make lifecycle changes harder to assess independently.

**Direction:** Extract clock/readiness policy and presentation projection. Keep
the session focused on lifecycle transitions and orchestration, with explicit
dependencies for objective and guidance behavior.

**Completion criteria:** Lifecycle, clock/readiness policy, and presentation
projection have clear ownership. Preserve zero-tick Begin/Resume baselines,
startup readiness, explicit-pause coast preservation, suspension resets,
generation guards, and input clearing.

## Issue #5 — Guidance mixes decisions with instrument presentation

**Status:** Pending.

**Concern:** Single responsibility and coupling.

`adventure/guidance.ts` combines formatting, positional instrument indexing,
cue selection, cooldowns, and progress detection. It repeats the objective's
150 km/600 km safety thresholds and five-second confirmation duration. Tuning
the objective can leave advice and displayed progress inconsistent; changing
instrument order can silently change which reading receives an update or
emphasis.

**Direction:** Centralize rule parameters, separate cue decisions from
presentation updates, and address instruments through their semantic IDs.
Reuse the dependency-free definitions established by issue #2.

**Completion criteria:** Objective, guidance, and progress formatting consume
one authoritative set of rule parameters. Instrument updates and emphasis do
not rely on numeric positions. Preserve cue priority, hysteresis, cooldowns,
pause/suspension behavior, localized text, retained objects, and accessible
presentation.

## Issue #6 — Reusable standalone plugins know the specific adventure

**Status:** Pending.

**Concern:** Coupling and contract scope.

The pause, playback, time-scale, ships, and operator-switch plugins each disable
themselves through `isAdventure()`. The shared contract in
`packages/plugin-api/src/standalone-session.ts` also hardcodes the adventure mode
and Earth-specific samples. Another adventure would require changes across
these otherwise reusable components.

**Direction:** Prefer composition-owned feature selection or a run policy that
expresses allowed capabilities. Separate reusable session contracts from
first-orbit-specific objective, sample, and guidance contracts where justified.
Keep content behavior in external plugins and preserve atomic host-specific
pack activation.

**Completion criteria:** Reusable plugins do not branch on the specific
first-orbit adventure identity. Session and policy contracts have explicit
scope; scenario-specific data does not expand the generic session surface.
Preserve menu/URL entry, fresh Retry generations, Free Flight, and multiplayer
composition without introducing a general campaign system.

## Deferred HUD/screen effort

After all six issues are complete, resume the requested HUD and PiP
rearrangement: move the top PiP windows closer to their respective screen
corners and use the space between them for a readable, unobscured HUD. Preserve
stage highlights and surface-altitude readings. The top-left PiP currently
partially covers inclination; retain the player's feedback that the meaning of
inclination is unclear when reviewing labels/help.

Remaining browser acceptance checks stay tracked in
`my-first-orbit-validation.md`; architecture work does not imply those checks
have passed.
