# Plugins

This directory is the plugin catalog and composition layer.

## Layering rule

- Inner layers (`domain`, `app`, `render`) must never import from `src/plugins`.
- Infra/bootstrap code selects which plugins to load.
- Plugins may depend on any layer they need; treat them as an outer layer.

## Structure

Each plugin lives in its own folder. A typical split is:

- `core.ts`: control/logic hooks (app + domain dependencies)
- `input.ts`: input bindings or DOM adapters (infra dependencies)
- `loop.ts`: loop state hooks (infra dependencies)
- `hud.ts`: HUD overlays or render-specific formatting (render dependencies)
- `scene.ts`: scene init/update hooks and view filters (app + setup dependencies)
- `segments.ts`: view overlay segment providers (app + domain dependencies)
- `simulation.ts`: deterministic simulation phase hooks such as vehicle dynamics
- `views.ts`: view registration, camera offsets, and camera frame strategies
- `worldModel.ts`: pre-runtime world/scenario model contribution
- `index.ts`: composes the above into a `GamePlugin`

Loop plugins can also influence per-frame policies such as whether the sim, scene, or HUD advance for a given tick, can request a fixed real tick delta for diagnostics, and may run post-frame cleanup. When multiple loop plugins write the same frame-policy field, later plugins in the bootstrap order win.

View plugins register named views through the view registry. The primary canvas and layout plumbing are core-owned, but the active primary camera rig is registered by plugins. The default runtime gets its primary forward spacecraft camera from `spacecraftOperator`; optional views such as axial picture-in-picture cameras are registered by plugins. Infra owns the canvas elements and their DOM IDs.

HUD plugins write directly into a preallocated HUD grid. Keep each plugin focused on one telemetry group, and avoid allocating per-cell objects in the HUD refresh path.

Simulation plugins run inside the fixed tick order. The default runtime includes the `spacecraftOperator` plugin, which owns spacecraft thrust, RCS, attitude vehicle dynamics, input bindings, and the primary forward camera rig.

The `spacecraftOperator` plugin also contributes the current spacecraft key bindings and action names for roll/pitch/yaw, burns, RCS translation, and thrust-level selection. Base input actions are reserved for generic/main-view controls such as look and camera offset.

Plugins may declare focused-entity requirements. Infra validates those requirements against the assembled world and `mainFocus` during setup, before simulation/HUD/scene hooks run. Missing hard requirements fail startup with the plugin id, focus entity id, and missing capability.

## Registration

Available plugins are exported from `src/plugins/index.ts`. Infra/bootstrap chooses which plugins to enable via `loadPlugins` (e.g. `src/infra/domBootstrap.ts`). Infra passes runtime URL options to plugins as a raw string map; each plugin owns validation and interpretation of its own option keys.

## World model

World-model plugins contribute scenario objects before world setup runs. They add generic entity definitions and set the required main focus entity id.

Core setup requires a plugin-contributed main focus entity. Scenario-specific placement logic belongs in the contributing plugin.

The default browser runtime enables the `solarSystem` plugin, which contributes the solar bodies plus the default main and enemy ships.

## Diagnostic playback

The playback plugin is enabled by runtime options parsed by infra:

- `?mode=capture&scenario=moon-circle`: fly normally, press `L` once to capture a snapshot and begin recording playback-owned controls, then press `L` again to dump a paste-ready script module to the console.
- `?mode=playback&scenario=moon-circle`: apply the saved script snapshot, start paused, use `P` to start/pause/resume playback, pause at the end, then press `P` once more to release normal control.
- `?mode=playback&scenario=moon-circle-long&log=circle-now`: enable the circle-now measurement logger for that playback run. The logger samples only while `circleNow` is active and dumps console JSON at playback end, including `schemaVersion: 3`, the circle-now algorithm version, active-relative eccentricity threshold timings, and per-sample target-bearing diagnostics.
- Add `&autopilot=v1`, `&autopilot=v2`, `&autopilot=v3`, `&autopilot=v4`, or `&autopilot=v5` to select the circle-now/autopilot algorithm for interactive or playback runs. The default is `v5`.

Playback is intentionally a control-state recorder/player, not a raw keyboard event macro. It owns only flight/autopilot controls and uses a fixed real tick delta with scaled simulation time so ship maneuverability remains real-time.

Capture stores the effective time scale from recording start; changing time scale during recording is warned about because v1 scripts have one top-level time scale, not a time-scale timeline.

The `scenario` query value is a script id. Capture accepts any non-empty id; playback succeeds once that id is registered in `playback/scripts/index.ts`, otherwise it fails closed with a missing-script status.

Diagnostic loggers are optional and routed by `log=<mode>`; v1 includes only `circle-now`. When no log is requested, playback does not create a logger.
