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
- `index.ts`: composes the above into a `GamePlugin`

Loop plugins can also influence per-frame policies such as whether the sim,
scene, or HUD advance for a given tick, and may run post-frame cleanup.

## Registration

Available plugins are exported from `src/plugins/index.ts`.
Infra/bootstrap chooses which plugins to enable via `loadPlugins` (e.g. `src/infra/domBootstrap.ts`).
