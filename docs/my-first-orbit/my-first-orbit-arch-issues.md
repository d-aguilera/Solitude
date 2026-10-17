# My First Orbit architecture issues

## Current effort and session rules

All six issues below are accepted and important. All six issues are now complete. Resume the deferred HUD/screen rearrangement effort next.

- The next fresh session resumes **HUD/PiP layout**, then the remaining browser acceptance checks.
- Implement and validate the current issue, then update its status here and the explicit next task in `MEMORY_MY_FIRST_ORBIT.md`.
- Continue the exact `My first orbit N` commit series. Inspect Git history for the next number; keep each issue's changes separate from the other issues.
- Preserve gameplay behavior, physical thresholds, plugin boundaries, and the CPU/allocation constraints in `MEMORY.md`. Avoid building a general campaign system as part of these fixes.
- Follow `MEMORY.md` formatting and validation requirements for code changes. Report any checks not run.

The review found no direct engine onion or external-plugin import violations. `npm run check:boundaries` passed, and 95 targeted tests passed across seven files. The findings concern responsibility and runtime dependencies that the existing import checks do not fully assess.

## Issue #1 — Control restrictions depend on plugin order

**Status:** Complete.

**Original concern:** Coupling and policy enforcement.

Before the fix, `adventure/final.ts` checked that its propulsion resolver was last, but equivalent assumptions for keyboard dispatch and frame-policy overrides were unguarded. `adventure/index.ts` sanitized direct input among ordinary simulation hooks. Keyboard handlers run in reverse provider order, propulsion resolvers run in provider order, and loop callbacks mutate a shared frame policy. Adding or reordering plugins can change enforcement.

Relevant code:

- `plugins/standalone-pack-v1/src/adventure/final.ts`
- `plugins/standalone-pack-v1/src/adventure/index.ts`
- `plugins/standalone-pack-v1/src/adventure/policy.ts`
- `packages/input/src/keyboard.ts`
- `packages/engine/src/app/gamePipeline.ts`
- `packages/engine/src/app/pluginRuntime.ts`
- `plugins/standalone-pack-v1/vite.config.ts`

**Direction:** Introduce explicit final policy phases, or validate every required ordering constraint during composition. Choose the smallest coherent solution after tracing keyboard, direct-input, simulation, frame-policy, and propulsion paths; checking only the propulsion resolver is insufficient.

**Completion criteria:** Policy precedence is explicit and enforced. Tests cover conflicting/reordered contributors and demonstrate that unsupported assembly fails clearly or cannot override adventure restrictions. Preserve pause/suspension, manual propulsion, disabled controls, and completed-frame objective sampling; retain Free Flight and multiplayer behavior.

**Implemented enforcement:** API v12 exposes a setup-only `validateAssembly` callback with ordered contributor identities/capabilities and the actual loop, control, and materialized simulation hook lists. Shared browser/headless assembly runs validators before loop initialization or simulation; browser keyboard input attaches only after pipeline validation succeeds. No validation runs per frame.

The adventure validates session processing first, frame policy last, final input sanitization last among pre-dynamics hooks, startup observation first, completed sampling last, keyboard guard first in dispatch, collision-free key bindings, and propulsion resolution last. Final input sanitization now lives in `adventureFinalPolicy`; early session sanitization still protects ordinary loop callbacks from direct forbidden requests. Adventure assembly permits only the supported spacecraft dynamics and autopilot control contributors, rejects post-dynamics simulation hooks and initial-clock overrides, and includes anonymous headless additions in validation. The session rejects a missing/inactive final policy. Errors identify the policy and violated constraint/contributor. Plugins remain trusted same-realm code; these checks enforce supported execution contracts.

**Validation:** all 585 tests pass across the full-suite run and a separate rerun of the 11 HTTP/WebSocket tests, which require localhost binding outside the sandbox. Full workspace typechecking/package boundaries and standalone production build pass. Production-physics recovery/confirmation regressions pass. New real pipeline/dispatcher tests cover reordered/conflicting contributors, factory hooks, entity-addressed sanitization, pause/resume/suspension, manual forward/reverse propulsion, missing final policy, Free Flight, and headless additions. Generic assembly tests cover inherited hooks and frozen inspection records. Browser startup tests verify rejected pipelines never attach keyboard input. Architecture regeneration changes only timestamp/formatting and is restored.

## Issue #2 — Objective rules import scenario construction

**Status:** Complete.

**Concern:** Onion layering.

Before the fix, `adventure/objective.ts` and `adventure/guidance.ts` imported entity identifiers from `adventure/scenario.ts`, which also owns provider discovery and world construction. Rules therefore depend on an outer setup module. The boundary checker enforces onion layers only inside the engine and misses this dependency.

**Direction:** Move scenario identifiers and rule parameters into a dependency-free definition consumed by both setup and rules, or supply them through explicit parameters. Keep world construction and capability discovery outside objective rules.

**Completion criteria:** Objective and guidance rules no longer import scenario construction. Their dependencies point inward, and existing scenario and objective behavior remains covered by tests.

**Implemented boundary:** `adventure/definition.ts` has no imports and owns immutable craft/Earth identifiers, initial apsis altitudes, safe-orbit altitude bounds, failure altitude, and coast confirmation duration. Scenario construction, objective, guidance, and final sampling/policy import their definitions directly; scenario construction no longer exports identifiers. Provider discovery and world construction remain in `scenario.ts`. Numeric values and gameplay are unchanged; no runtime configuration or per-frame allocations are added. Guidance formatting and instrument separation remain scoped to issue #5.

**Validation:** all 585 tests pass, including scenario calibration, exact objective thresholds, guidance, and production-physics regressions. Full workspace typechecking/package boundaries, standalone production build, and Prettier pass. Existing tests retain independent numeric expectations. Architecture regeneration changes only timestamp/formatting and is restored.

## Issue #3 — Gameplay observations are owned by a presentation plugin

**Status:** Complete.

**Concern:** Coupling and capability ownership.

Before the fix, `plugins/core-pack-v1/src/orbit-telemetry/index.ts` published both the telemetry HUD and the orbital observation provider implemented in `observation.ts`. The adventure required that provider through `adventure/final.ts`, so removing or replacing a presentation plugin also removed a gameplay dependency.

**Direction:** Give orbital observations an independently composable provider; let both HUD and adventure consume it. Preserve the external plugin boundary and the retained, explicit-entity sampler rather than moving scenario knowledge into the host engine.

**Completion criteria:** Gameplay observations are available without activating the orbital telemetry HUD. HUD and adventure share the observation service with unchanged validity, unavailable/escape/negative-altitude semantics, and no new per-frame allocation burden.

**Implemented boundary:** `orbitObservation` is a separate runtime plugin entry in the atomic core browser pack, owning physical calculations and the retained explicit-entity sampler. It publishes the unchanged gameplay sampling contract plus a detailed-readout extension for instrument values. `orbitTelemetry` publishes only its HUD and binds the service through capability discovery, with no cross-plugin implementation imports. Assembly validates one detailed provider; presentation-only remote hosts bind it once on first draw. Both consumers retain their output records, and the service retains scratch vectors/readout/primary storage. HUD timing, circularization, center-distance, invalid-radius, negative-altitude, and escape semantics are preserved. Production-physics and policy suites activate the observation provider without the orbital HUD.

**Validation:** All 590 tests pass across the full-suite run and the separate rerun of the 11 localhost HTTP/WebSocket tests outside the sandbox. Full workspace typechecking/package boundaries, standalone production build, and Prettier pass. Architecture regeneration changes only timestamp/formatting and is restored. No browser playtest or CPU/GC trace is performed for this slice.

## Issue #4 — Session owns lifecycle, clocks, presentation, and guidance assembly

**Status:** Complete.

**Concern:** Single responsibility.

Before the fix, `adventure/session.ts` managed phase transitions, simulation eligibility, startup frame stability, localized dialog construction, objective creation, guidance creation, and orbit-line state. These responsibilities change for different reasons and make lifecycle changes harder to assess independently.

**Direction:** Extract clock/readiness policy and presentation projection. Keep the session focused on lifecycle transitions and orchestration, with explicit dependencies for objective and guidance behavior.

**Completion criteria:** Lifecycle, clock/readiness policy, and presentation projection have clear ownership. Preserve zero-tick Begin/Resume baselines, startup readiness, explicit-pause coast preservation, suspension resets, generation guards, and input clearing.

**Implemented boundary:** `adventure/clock.ts` owns retained startup readiness and flight timestamp policy, returning hold/advance/suspend decisions without per-frame allocations. `adventure/presentation.ts` owns localized dialog projection from explicit mode, phase, readiness, and focus values. `adventure/session.ts` owns lifecycle commands, transitions, subscriptions, input clearing, and orchestration through injected clock, presentation, and rule-effect dependencies; it no longer imports objective/guidance implementations, locale bundles, or orbit-line state. `adventure/composition.ts` constructs each fresh objective/director and connects their lifecycle effects and orbit-line dependency. The plugin and test callers consume that composition directly, without forwarding exports or shared API changes.

**Validation:** All 595 tests pass across the full-suite run and a separate rerun of the 11 localhost HTTP/WebSocket tests outside the sandbox. Full workspace typechecking/package boundaries, standalone production build, and Prettier pass. New boundary tests cover injected lifecycle effects, input/listener ordering, independent readiness/flight baselines, and dialog actions/content in en/es/fr. Existing production-physics, captured-clock, objective/guidance, pause/suspension, fresh-generation, held-input, Free Flight, and multiplayer regressions pass. Architecture regeneration changes only timestamp/formatting and is restored. No browser playtest or CPU/GC trace is performed for this slice.

## Issue #5 — Guidance mixes decisions with instrument presentation

**Status:** Complete.

**Concern:** Single responsibility and coupling.

Before the fix, `adventure/guidance.ts` combined formatting, positional instrument indexing, cue selection, cooldowns, and progress detection. Instrument text repeated the objective's 150 km/600 km safety thresholds and five-second confirmation duration. Tuning the objective can leave advice and displayed progress inconsistent; changing instrument order can silently change which reading receives an update or emphasis.

**Direction:** Centralize rule parameters, separate cue decisions from presentation updates, and address instruments through their semantic IDs. Reuse the dependency-free definitions established by issue #2.

**Completion criteria:** Objective, guidance, and progress formatting consume one authoritative set of rule parameters. Instrument updates and emphasis do not rely on numeric positions. Preserve cue priority, hysteresis, cooldowns, pause/suspension behavior, localized text, retained objects, and accessible presentation.

**Implemented boundary:** `adventure/guidanceDirector.ts` owns retained cue decisions, alignment hysteresis, progress detection, acknowledgments, hint preferences, and active-flight cooldowns without localization or instrument dependencies. `adventure/guidancePresentation.ts` owns localized text, instrument values/formatting/emphasis, display revisions, and subscriptions. `adventure/guidance.ts` composes them behind the unchanged capability. Instrument updates, numeric caches, and emphasis use semantic IDs independently of display order. Guidance templates in en/es/fr interpolate rule parameters once per run from `adventure/definition.ts`; coast formatting uses the same confirmation duration as the objective, including the pre-completion display cap. Raw SI readings and all presentation/decision records remain retained, and numeric text is cached by displayed precision.

**Validation:** All 600 tests pass across the full-suite run and a separate rerun of the 11 localhost HTTP/WebSocket tests outside the sandbox. Full workspace typechecking/package boundaries, standalone production build, and Prettier pass. New tests run decisions independently of presentation, reorder instruments while checking identity/value/emphasis retention, and deliberately change authoritative rule parameters to verify objective decisions, advice, localized targets, and coast progress in en/es/fr. Existing cue priority, hysteresis, cooldowns, pause/suspension, subscriptions, accessible DOM, and production-physics regressions pass. Architecture regeneration changes only timestamp/formatting and is restored. No browser playtest or CPU/GC trace is performed for this slice.

## Issue #6 — Reusable standalone plugins know the specific adventure

**Status:** Complete.

**Concern:** Coupling and contract scope.

Before the fix, pause, playback, time-scale, ships, and operator-switch each disabled themselves through `isAdventure()`. The shared contract in `packages/plugin-api/src/standalone-session.ts` also hardcoded the adventure mode and Earth-specific samples. Another adventure would require changes across these otherwise reusable components.

**Direction:** Prefer composition-owned feature selection or a run policy that expresses allowed capabilities. Separate reusable session contracts from first-orbit-specific objective, sample, and guidance contracts where justified. Keep content behavior in external plugins and preserve atomic host-specific pack activation.

**Completion criteria:** Reusable plugins do not branch on the specific first-orbit adventure identity. Session and policy contracts have explicit scope; scenario-specific data does not expand the generic session surface. Preserve menu/URL entry, fresh Retry generations, Free Flight, and multiplayer composition without introducing a general campaign system.

**Implemented boundary:** `standalone-pack-v1/src/composition/` owns run selection and the five sandbox deployment entries. First Orbit receives identity-only inactive entries before any reusable factory constructs state; Free Flight and legacy direct compositions retain the real features. Deployment entries forward runtime options and the host context unchanged. Reusable pause, playback, time-scale, ships, and operator-switch implementations no longer import session contracts or inspect scenario identity. The atomic browser pack, manifest IDs, and plugin order are unchanged. Selection happens at factory construction, adding no frame work or retained feature state in adventure runs.

The dependency-free `@solitude/plugin-api/standalone-session` surface now contains only reusable lifecycle, generation, commands, and dialog contracts, with an opaque content mode. `standalone-entry` explicitly scopes Solitude's two-mode selection and localized menu/session extension. `my-first-orbit` owns the existing Earth-specific samples, objective, guidance, and instrument contracts. Consumers import directly from their owning subpaths; there are no compatibility forwarding exports or new campaign abstractions. Existing capability IDs, samples, physical thresholds, and gameplay behavior are unchanged.

**Validation:** All 607 tests pass across the full-suite run and a separate rerun of the 11 localhost HTTP/WebSocket tests outside the sandbox. Full workspace typechecking/package boundaries, standalone production build, and Prettier pass. New regressions verify that composition skips factory construction, forwards host context, and selects all five features while their reusable factories ignore adventure identity. A reusable lifecycle fixture requires no Solitude menu labels or First Orbit data. Existing menu/URL, Retry generations, policy precedence, production-physics, pause/suspension, guidance, Free Flight, and multiplayer regressions pass. Architecture regeneration changes only timestamp/formatting and is restored. No browser playtest or CPU/GC trace is performed for this slice.

## Deferred HUD/screen effort

After all six issues are complete, resume the requested HUD and PiP rearrangement: move the top PiP windows closer to their respective screen corners and use the space between them for a readable, unobscured HUD. Preserve stage highlights and surface-altitude readings. The top-left PiP currently partially covers inclination; retain the player's feedback that the meaning of inclination is unclear when reviewing labels/help.

Remaining browser acceptance checks stay tracked in `my-first-orbit-validation.md`; architecture work does not imply those checks have passed.
