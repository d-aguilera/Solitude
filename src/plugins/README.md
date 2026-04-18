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
- `views.ts`: view registration, camera offsets, and camera frame strategies
- `index.ts`: composes the above into a `GamePlugin`

Loop plugins can also influence per-frame policies such as whether the sim,
scene, or HUD advance for a given tick, and may run post-frame cleanup.

View plugins register named views through the view registry. The primary view is
core; optional views such as axial picture-in-picture cameras should be
registered by plugins. Infra owns the canvas elements and their DOM IDs.

HUD plugins write directly into a preallocated HUD grid. Keep each plugin
focused on one telemetry group, and avoid allocating per-cell objects in the
HUD refresh path.

## Registration

Available plugins are exported from `src/plugins/index.ts`.
Infra/bootstrap chooses which plugins to enable via `loadPlugins` (e.g. `src/infra/domBootstrap.ts`).
