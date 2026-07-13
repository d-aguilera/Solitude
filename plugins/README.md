# External Plugins

This workspace contains independently built plugins that the Solitude browser
hosts discover and load at runtime.

## Boundary

- External plugin source may import only `@solitude/plugin-api` from the host
  workspace. The package-boundary check enforces this rule.
- External plugin artifacts must be self-contained ES modules with no bare
  package imports. `npm run build:plugins` verifies this before assembling the
  browser plugin set.
- Product packages do not depend on external plugin packages. Deployment
  assembly places plugin pack artifacts and an ordered `plugin-set.json`
  beside the browser products.
- External plugins are trusted code. They run in the host page and are not a
  security sandbox.
- Browser hosts begin from a fixed same-origin `loader.json`. Its
  `allowedOrigins` list is the application-level allowlist for the plugin set,
  pack manifests, plugin manifests, and module entries. Cross-origin plugins
  require an explicit origin entry and matching page CSP changes.

## Runtime Documents

The plugin-set document lists plugin pack manifests in runtime order. Each pack
owns an ordered list of one or more plugin manifests, allowing one independently
built package to publish several related runtime plugins. Each plugin manifest
declares its schema version, exact host API version, target environment, id,
and ES-module entry URL. The runtime validates every pack and plugin manifest
before importing any plugin module.

`plugins/browser-plugin-packs.json` is the deployment assembly list. Adding a
pack there makes `npm run build:plugins` build its workspace package, validate
and copy its complete artifact directory, and publish its pack manifest through
the browser plugin set.

The default assembled loader configuration allows only `self`. JSON plugin
documents are fetched without following redirects, and browser pages enforce a
`script-src 'self'` Content Security Policy. Allowing a trusted external plugin
host therefore requires two deliberate deployment changes:

1. Add its exact HTTP(S) origin to `loader.json`.
2. Add the same origin to the page's `script-src` CSP.

CORS permission from the external host is also required. These controls limit
which trusted code can load; they do not sandbox code after loading.

The module must export `createPlugin`. Factories are retained and instantiated
with the current runtime options whenever the host creates a plugin
composition.

## Current Pack

- `core-pack-v1`: first multi-plugin pack, shared by standalone and remote
  rendering. It currently contains:
  - `autopilotHud`: localized autopilot mode and circle-now diagnostic HUD
    readouts for the focused entity.
  - `axialViews`: localized top/front/left/right picture-in-picture camera
    definitions.
  - `bodyLabels`: localized names, distance, and speed labels for scene bodies.
  - `mainViewLookaround`: shared local look rotation, reset, and camera-offset
    controls for standalone and remote rendering.
  - `orbitSegments`: analytic bound-orbit segments around the focused entity's
    dominant gravity body, with keyboard toggle behavior.
  - `orbitTelemetry`: localized orbit state, apsis, circularization, and timing
    readouts for the focused entity.
  - `runtimeTelemetry`: shared localized simulation-time and rolling-FPS HUD
    driven by browser presentation-frame samples.
  - `solarSystemMaterials`: Earth and Moon texture materials plus pack-owned
    texture assets.
  - `shipTelemetry`: localized speed and spacecraft control telemetry for the
    focused entity.
  - `targetingLaser`: targeting beam, target lock, impact/miss markers, and
    keyboard toggle behavior.
  - `trajectories`: sampled ring-buffer polylines for controllable bodies and
    primary solar-system bodies.
  - `velocitySegments`: forward/backward world segments along the focused
    entity's velocity vector.

The core pack is the migration destination for existing first-party plugins as
the external API grows to support their required contribution types.
