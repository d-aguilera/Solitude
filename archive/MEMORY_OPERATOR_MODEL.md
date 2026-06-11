# Operator Model Memory

## Final Update

This memory doc is finished and archived.

## Purpose

- Dedicated context for generalizing Solitude's main interactive subject.
- Use this before work that changes the main controlled body, primary view, input ownership, spacecraft controls, camera rigs, HUD contexts, telemetry, autopilot, playback, or simulation plugin phases.
- Goal: make the main ship plugin-owned behavior rather than a core assumption, while preserving a fast generic core runtime.

## How To Use This Doc

- Start from **Current Slice**. Treat everything else as background unless the slice points at it.
- Keep each code change narrow enough to finish with typecheck/test in one Codex session.
- When a slice completes, update **Completed Slices**, choose the next slice, and refresh **Current Slice**.
- When a topic is too large to solve inline, add a compact note under **Open Questions** instead of expanding the main roadmap.
- Prefer adapter/bridge steps over rewrites. The plan should survive many small commits.

## Current Slice

Status: operator runtime focus switching is implemented; operator-model follow-up work is active.

Next focused change:

- Extend runtime focus switching into explicit foreground/background operator UX:
  - distinguish focused control/HUD emphasis from background autonomous ships;
  - decide whether background operator status should appear in HUD, labels, or another overlay.

Success criteria:

- Tick ordering remains covered by tests.
- Manual controls, autopilot, playback, and HUD control readouts remain behavior-compatible.
- Browser runtime setup still installs the current spacecraft behavior by default; generic headless setup receives spacecraft behavior only when the caller explicitly supplies the plugin.
- Browser runtime setup installs the Solitude operator switch plugin by default; `Tab` swaps focus/control between `ship:blue` and `ship:red`.
- Spacecraft operator state is keyed by focused entity id.
- Autopilot mode is persisted per controlled ship; unfocused ships continue autonomous autopilot modes while manual controls remain focused-only.
- Runtime/headless setup validates plugin focused-entity requirements before behavior hooks use the focus.
- Core owns the primary view definition while plugins supply camera rigs; the first registered rig is current and setup fails if none exists.
- Core config/tick setup does not own initial thrust level; spacecraft operator owns spacecraft control state.
- No new plugin-to-core layering violations.
- `rg mainControlledBody packages` remains empty.
- `rg "mainControlledEntityId|setMainControlledEntityId" packages` remains empty.
- `rg "pilotLookState|pilotCameraOffset|updatePilot" packages` remains empty.
- `rg "@deprecated" packages` remains empty.
- `rg "setupShips|ShipsSetup|createShipsFromConfig|ShipPhysicsConfig|ShipInitialStateConfig|ShipPhysics" packages` should remain empty; core setup should stay controllable-body-first.
- `computeShipOrbitReadoutInto` should remain absent.
- `rg "legacyKind|LegacyEntityKind" packages` remains empty.
- render scene adaptation should use `renderable.role`.
- `rg "ShipBody" packages` remains empty.
- trajectory planning should not read `legacyKind`.
- Typecheck and tests pass.

## Completed Slices

- 2026-04-29: Audited `pilot`, `ship`, `mainControlledBody`, and spacecraft-control references.
- 2026-04-29: Added a `FocusContext` runtime bridge as `mainFocus` on `WorldSetup`, `WorldAndScene`, plugin params, and render params, while keeping `mainControlledBody` aliases intact.
- 2026-04-29: Renamed primary-view app/config plumbing to `mainView*` names. Kept deprecated `pilot*` aliases and render-config fallback helpers for compatibility.
- 2026-04-29: Migrated easy generic focus consumers to `mainFocus`: render label anchor, velocity segments, and orbit telemetry. Added generic `computeOrbitReadoutInto` with `computeShipOrbitReadoutInto` retained as compatibility wrapper.
- 2026-04-29: Added `mainFocus` to `ViewFrameUpdateParams` and migrated primary/axial camera frame callbacks to read the focused body's frame through `mainFocus`, with `mainControlledBody` kept as a compatibility alias.
- 2026-04-29: Added an explicit no-op simulation phase API skeleton with hooks around vehicle dynamics, gravity, collisions, and spin. Wired DOM/headless collection and added an order test while preserving existing spacecraft behavior.
- 2026-04-29: Isolated the existing thrust/RCS/attitude vehicle-dynamics block into `src/app/spacecraftVehicleDynamics.ts`, preserving current direct invocation and control-plugin behavior. Later moved it under `src/plugins/spacecraftOperator/`.
- 2026-04-29: Routed spacecraft vehicle dynamics through `SimulationPlugin.updateVehicleDynamics` with the current spacecraft adapter auto-installed inside `createTickHandler`; phase params now carry mutable tick output.
- 2026-04-29: Moved default spacecraft vehicle-dynamics registration out of `createTickHandler`; DOM/headless setup now installs the spacecraft simulation adapter and passes the full simulation plugin list into core.
- 2026-04-29: Made spacecraft dynamics a named `spacecraftOperator` plugin contribution. Browser defaults include it in `defaultPluginIds`; headless installs the same plugin explicitly by default.
- 2026-04-29: Moved spacecraft-specific action names and key bindings out of base input and into `spacecraftOperator.input`; base actions now cover generic/main-view look and camera offset controls.
- 2026-04-29: Moved spacecraft thrust/RCS/attitude command interpretation out of `src/app/controls.ts` and into `src/plugins/spacecraftOperator/controlLogic.ts`. `src/app/mainViewControls.ts` now owns main-view look logic; `src/app/controls.ts` is only a temporary main-view compatibility re-export.
- 2026-05-01: Removed the unused `src/app/controls.ts` compatibility re-export. Added generic `controlledBody` fields to control plugin attitude/propulsion params while keeping deprecated `ship` aliases, and migrated autopilot's control plugin bridge to the generic field.
- 2026-05-02: Migrated plugin-facing contexts to focused-body plumbing:
  - HUD plugins, orbit telemetry, spacecraft telemetry, autopilot HUD, and velocity segments use `mainFocus.controlledBody`.
  - `spacecraftOperator` vehicle dynamics now applies to `mainFocus.controlledBody`.
  - Playback loop, capture/logging, and circle-now diagnostics now use `controlledBody`/`mainFocus` instead of `mainControlledBody`.
  - View/render params and camera frame updates no longer carry a `mainControlledBody` alias.
  - Simulation phase, HUD, scene, segment, and loop plugin params no longer expose `mainControlledBody`; loop params now require `mainFocus`.
- 2026-05-02: Updated `MEMORY.md` with the phase boundary and committed it as Operator model 22. The sharper operator-specific handoff is this document.
- 2026-05-02: Removed the remaining core setup/runtime `mainControlledBody` bridge:
  - `WorldSetup` and `WorldAndScene` now expose only `mainFocus`.
  - Headless/runtime tests assert through `mainFocus.controlledBody`.
  - `rg mainControlledBody src` is empty.
- 2026-05-02: Made `mainFocusEntityId` the canonical config/world-model name while preserving compatibility:
  - `WorldAndSceneConfig` accepts `mainFocusEntityId`, with deprecated `mainControlledEntityId` fallback.
  - `WorldModelRegistry` exposes `setMainFocusEntityId`, with deprecated `setMainControlledEntityId` alias.
  - Setup and scene validation resolve focus identity through a shared helper.
  - Solar-system content registers the default focused entity via the new world-model API.
- 2026-05-02: Retired the config/world-model compatibility names:
  - removed `mainControlledEntityId` from `WorldAndSceneConfig`;
  - removed `setMainControlledEntityId` from `WorldModelRegistry`;
  - removed focus-id fallback handling and compatibility tests;
  - `rg "mainControlledEntityId|setMainControlledEntityId" src` is empty.
- 2026-05-02: Retired deprecated main-view `pilot*` aliases:
  - removed `PilotLookState`, `pilotLookState`, `pilotCameraOffset`, and `updatePilot*` exports;
  - render config now requires `mainViewCameraOffset` / `mainViewLookState`;
  - `rg "pilotLookState|pilotCameraOffset|updatePilot" src` is empty.
- 2026-05-02: Retired deprecated control-plugin `ship` aliases:
  - removed `ship` from `AttitudeCommandParams` and `PropulsionCommandParams`;
  - spacecraft operator plugin callbacks now pass only `controlledBody`;
  - `rg "@deprecated" src` is empty.
- 2026-05-02: Renamed core setup construction from ships to controllable bodies:
  - `setupShips.ts` became `setupControllableBodies.ts`;
  - setup config types and helper functions now use `ControlledBody*` / controllable-body terminology;
  - setup error messages refer to controlled bodies;
  - scenario spacecraft files still use spacecraft/ship names where they describe actual content.
- 2026-05-02: Cleaned generic core local ship wording:
  - collisions, camera positioning, controlled-body rotation, and RCS comments now use controlled-body wording;
  - removed unused `computeShipOrbitReadoutInto` wrapper;
  - generic domain tests use controlled-body fixture names;
  - remaining core-facing `ship` matches are explicit compatibility IDs, legacy render roles, or spacecraft-specific names.
- 2026-05-02: Made setup classify from components instead of `legacyKind`:
  - stars are detected by light emitter plus celestial capabilities;
  - planets are detected by celestial gravity/collision/spin/Keplerian capabilities;
  - controlled bodies are detected by the controllable component;
  - setup/headless tests build without legacy metadata while world records retain default compatibility roles.
- 2026-05-02: Made render scene adaptation use explicit render roles:
  - added `RenderableConfig.role` with `controlledBody`, `celestialBody`, and `lightEmitter`;
  - `sceneAdapter` no longer reads `legacyKind`;
  - solar-system renderable entities assign roles when contributing world-model config;
  - render adapter tests build without legacy metadata.
- 2026-05-02: Removed `ShipBody` compatibility alias:
  - deleted the alias from `domainPorts`;
  - plugin/playback/logging/test code now types focused/controlled objects as `ControlledBody`;
  - playback snapshot field names were still compatibility-shaped at this point; this was later removed by the v2-only playback migration.
- 2026-05-02: Removed trajectory planner dependency on `legacyKind`:
  - planet trajectory candidates come from Keplerian state and non-light-emitter components;
  - trajectory tests build without legacy metadata.
- 2026-05-02: Removed `BodyId` and duplicate `EntityId`.
- 2026-05-02: Implemented the V1 operator boundary:
  - `GamePlugin` can declare focused-entity capability requirements;
  - DOM/headless setup validates requirements against `mainFocus`;
  - `spacecraftOperator` made the default primary forward camera behavior plugin-provided.
- 2026-05-02: Added main-view camera rig state:
  - plugins register named `MainViewCameraRig` entries separately from auxiliary views;
  - core creates exactly one primary view from the first registered rig;
  - `spacecraftOperator` registers `spacecraft.forward`;
  - missing or duplicate active rigs fail clearly during view definition build.
- 2026-05-03: Removed initial thrust-level ownership from core:
  - deleted `thrustLevel` from world config and tick handler setup;
  - `spacecraftOperator` owns closure-local spacecraft control state initialized to thrust level `1`;
  - playback still overrides spacecraft thrust level through the neutral mutable control-state bag;
  - moved thrust/RCS velocity application helpers from app physics into `spacecraftOperator`.
- 2026-05-03: Removed thrust/RCS readout output from core:
  - deleted `currentThrustLevel` and `currentRcsLevel` from tick output and HUD context;
  - removed the now-empty tick output pipe from core/runtime loops;
  - plugin composition creates spacecraft operator telemetry and shares it with spacecraft dynamics plus ship telemetry HUD.
- 2026-05-03: Replaced core spacecraft propulsion command ports with a plugin capability registry:
  - added generic app-level `PluginCapabilityProvider` / `PluginCapabilityRegistry` and DOM/headless assembly;
  - removed the shared plugin protocol module compromise; plugins define local structural views of the `spacecraft.propulsionResolver.v1` runtime contract instead of importing peer plugin or shared plugin-layer code;
  - autopilot now publishes a raw `spacecraft.propulsionResolver.v1` capability provider using its local structural contract;
  - spacecraft operator consumes propulsion resolvers from the registry using its own local runtime guard when resolving per-tick vehicle dynamics;
  - removed `ThrustCommand`, `RcsCommand`, `PropulsionCommand`, `PropulsionCommandParams`, and `ControlPlugin.resolvePropulsionCommand` from core/app ports;
  - guard searches should keep `src/plugins/autopilot` free of `spacecraftOperator` imports and avoid `src/plugins/capabilities` shared protocol modules.
- 2026-05-05: Migrated playback snapshots to generic entity/focus schema and intentionally dropped old script compatibility:
  - `PlaybackSnapshot.entities` is now required and is the only world snapshot payload;
  - snapshot metadata records `focusEntityId`;
  - removed `PlaybackShipSnapshot`, `PlaybackRotatingBodySnapshot`, and v1 `ships` / `planets` / `stars` apply/capture paths;
  - migrated `random-trip` to the new schema for interactive refactor testing.
- 2026-05-05: Removed `legacyKind` from source:
  - deleted `LegacyEntityKind` and `EntityRecord.legacyKind` from domain ports;
  - deleted `EntityConfig.legacyKind` from app config ports;
  - removed solar-system `legacyKind` contributions and setup copy-through;
  - setup/world records now carry entity identity only.
- 2026-05-05: Completed core category naming cleanup for the entity-model objective:
  - replaced `setupPlanets.ts` / `PlanetsAndStarsSetup` with `setupKeplerianBodies.ts` / `KeplerianBodiesSetup`;
  - replaced `PlanetPhysicsConfig` / `StarPhysicsConfig` and domain `PlanetPhysics` / `StarPhysics` with generic Keplerian/spherical body physics types;
  - replaced app render config category types with `EntityRenderConfig`;
  - changed render scene object kinds from `ship` / `planet` / `star` to `controlledBody` / `orbitalBody` / `lightEmitter`;
  - renamed axial spin handling from `applyCelestialSpin` to `applyAxialSpin`.
- 2026-05-06: Package-split Phase 0 boundary hardening:
  - `createHeadlessLoop` no longer imports or auto-installs `spacecraftOperator`;
  - generic headless composition now accepts caller-supplied `GamePlugin[]` and derives control plugins, capability providers, requirements, and simulation contributions from that list;
  - browser defaults still install spacecraft behavior through the Solitude plugin catalog, while headless tests pass `createSpacecraftOperatorPlugin()` explicitly when testing spacecraft dynamics.
- 2026-05-16: Implemented first runtime focus/control switch:
  - added a generic `updateFocusContext` helper in engine app code;
  - added Solitude `operatorSwitch` plugin enabled by default after `solarSystem`;
  - `Tab` swaps focus/control between `ship:main` and `ship:enemy` while preventing browser focus movement;
  - spacecraft operator control state is now per focused entity id, preserving each ship's thrust level;
  - this slice cleared transient autopilot actions on focus swap; the later autonomous-control slice superseded this by restoring stored per-ship autopilot state.
- 2026-05-16: Added background autonomous autopilot continuation:
  - autopilot mode is stored in per-entity spacecraft control state owned by the autopilot plugin;
  - autopilot publishes a local structural `spacecraft.autonomousControl.v1` capability provider;
  - spacecraft operator consumes autonomous-control providers to synthesize per-entity effective input, without knowing autopilot state keys;
  - manual thrust/RCS/attitude input remains focused-only;
  - returning focus to a ship restores its stored autopilot mode into foreground input/HUD state.
- 2026-05-19: Closed the runtime focus-switching series:
  - `Tab` switches foreground focus during normal runtime and while playback is waiting, playing, paused, or done;
  - playback records per-phase `focusEntityId`, with old scripts defaulting phase focus to snapshot metadata;
  - during playback, recorded controls apply to the recorded phase focus while the viewed/HUD focus can switch independently;
  - operator switch requests a scene/overlay refresh on focus swaps so paused playback updates camera/HUD without advancing simulation;
  - default plugin order now keeps playback before operator switch, with tests documenting that ordering dependency.
- 2026-05-20: Extracted main-view lookaround controls:
  - added the `mainViewLookaround` plugin for arrow-key look, look reset, and primary camera offset controls;
  - added a generic `GamePlugin.viewControls` hook for per-frame view-control state updates;
  - removed browser/engine product default input actions and key bindings;
  - renamed the remaining engine scene export to `updateSceneViewCameras`, which only refreshes camera poses/frames.

## Decision Log

- 2026-04-27: Chose "operator model" as the initiative name because the target is broader than a main-ship plugin. The future unit of switching is likely an operator mode: focus, camera, controls, HUD emphasis, and control system together.
- 2026-04-27: Main view should remain core-owned. Plugins should contribute camera rigs or operator modes for that view, not own the primary view/canvas itself.
- 2026-04-27: Do not reduce core to only the gravity engine. Core should still own generic world/runtime orchestration, focus selection, main view plumbing, and deterministic simulation phases.
- 2026-05-19: Axial/PIP views stay linked to the primary view/focus. They are alternate views of the foreground operator, not independently targetable cameras.
- 2026-05-19: During recording, input is attributed to the entity focused at that time. During playback, `Tab` may switch the viewed/focused entity, but recorded input still applies to the entity that was focused when that input was recorded.

## Current Architecture

- Core owns generic focus (`mainFocusEntityId` / `mainFocus`), world/runtime orchestration, deterministic simulation phase ordering, render assembly, and the primary view definition/canvas/layout target.
- Runtime world state is generic entity/capability based. `World.controllableBodies` remains the current controlled-body capability array.
- Plugins declare focused-entity requirements, and DOM/headless setup validates them against the assembled world and current `mainFocus`.
- Browser runtime installs Solitude's default plugin catalog, including `solarSystem`, `operatorSwitch`, `spacecraftOperator`, telemetry, autopilot, playback, and rendering helpers.
- Generic headless runtime does not auto-install Solitude spacecraft behavior; callers compose Solitude plugins explicitly when needed.
- Browser/engine input has no product default actions. Main-view lookaround input comes from `mainViewLookaround`, spacecraft input actions come from `spacecraftOperator`, and `Tab` focus switching comes from `operatorSwitch`.
- The primary view is core-owned. Plugins register main-view camera rigs; `spacecraftOperator` currently contributes `spacecraft.forward`, and core uses the first registered rig.
- Spacecraft vehicle dynamics runs through the `spacecraftOperator` simulation plugin before gravity. Manual thrust/RCS/attitude input is focused-only.
- Spacecraft operator state is keyed by entity id, so each controlled ship remembers persistent state such as thrust level.
- Autopilot owns its per-entity mode state and publishes capability providers:
  - `spacecraft.propulsionResolver.v1` for per-tick propulsion commands.
  - `spacecraft.autonomousControl.v1` for background autonomous-control input synthesis.
- `spacecraftOperator` consumes spacecraft capabilities structurally through the generic capability registry; it should not import peer plugins or know peer-plugin private state keys.
- Playback snapshots are v2-only: generic `entities` plus snapshot metadata with `focusEntityId`.
- Playback currently acts as an input lock during replay and has a small explicit allowlist for non-playback actions such as pause, profiling, and operator focus swapping. This is action-string coupling rather than import coupling, but it is still a known input-ownership smell.

## Current Direction

- The next useful operator-model work is UX around foreground/background operation:
  - make it easier to see what background autonomous ships are doing;
  - distinguish focused control/HUD emphasis from background autonomous state;
  - decide whether background operator status belongs in HUD, labels, telemetry panels, or another overlay.
- Playback/runtime perspective switching is still the main open product capability: watch from one ship while another recorded/autonomous control target continues its maneuver.
- Future input-model work should replace playback's hard-coded locked-input allowlist with declarative action ownership/lock policy, so plugins can mark actions as playback-recorded, runtime-pass-through, debug, operator, etc. Playback should lock/replay categories of recorded controls rather than knowing sibling plugin action names.
- Keep adding operator concepts above the engine boundary. Core should remain generic; Solitude plugins should define spacecraft semantics, autopilot, HUD/readouts, and default focus-switch behavior.
- When peer plugins need to cooperate, use opaque capability ids plus local structural guards instead of direct plugin imports or shared plugin-layer protocol modules.

## Open Questions

- How should HUD/readouts represent multiple operated ships without cluttering the primary view?
- Should future operator modes use explicit mode records that bundle focus target, camera rig, input context, control system, and HUD emphasis?
- What key-collision policy is needed when multiple operator modes or selectable control contexts coexist?
- What is the minimal declarative input lock/ownership API that lets playback lock recorded controls while allowing runtime/operator/debug actions through without plugin-specific action allowlists?

## Watch-Outs

- Do not collapse entity contribution, control system, camera rig, HUD/readout, autopilot, and operator selection into one monolithic main-ship plugin.
- Preserve onion layering: engine/domain/app/render/browser packages must not import from Solitude plugins.
- Keep plugin phase ordering deterministic and allocation-conscious; avoid event-bus or ECS patterns in hot per-frame paths unless there is a concrete performance story.
- Keep spacecraft naming inside spacecraft-specific plugins, scenario IDs/assets, visual roles, and user-facing labels. Core should continue using generic focus/entity/control terminology.
- Playback compatibility with old script schemas was intentionally dropped; keep built-in scripts migrated when schema changes.
- Avoid adding more sibling-plugin action names to playback's input lock allowlist; prefer solving the declarative input policy first if more pass-through controls are needed.
- Keep the guard searches in **Current Slice** green after operator/entity cleanup.
