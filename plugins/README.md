# External Plugins

This workspace contains independently built plugins that Solitude browser and
server hosts discover and load at runtime.

## Boundary

- External plugin source may import only exported `@solitude/plugin-api/*`
  subpaths from the host workspace. The package-boundary check enforces this
  rule. There is deliberately no package-root export: plugins select only the
  API surface they use.
- External plugin artifacts must be self-contained ES modules with only
  contained relative imports. `npm run build:plugins` verifies the complete
  module graph before assembling browser and server plugin sets.
- Product packages do not depend on external plugin packages. Deployment
  assembly places plugin pack artifacts and ordered `plugin-set.json`
  documents beside their browser or server products.
- External plugins are trusted code. They run in the host page and are not a
  security sandbox.
- Browser hosts begin from a fixed same-origin `loader.json`. Its
  `allowedOrigins` list is the application-level allowlist for the plugin set,
  pack manifests, plugin manifests, and module entries. Cross-origin plugins
  require an explicit origin entry and matching page CSP changes.

## Runtime Documents

The plugin-set document lists plugin pack manifests in runtime order. Each pack
is an atomic deployment and activation unit: it declares its supported `hosts`
and owns an ordered list of one or more plugin manifests. A pack may support
`browser`, `server`, or both hosts. There is no `universal` sentinel and
individual plugins do not declare an environment. Each plugin manifest declares
only its schema version, exact host API version, id, and ES-module entry URL.
The runtime validates the complete pack and plugin graph before importing any
plugin module.

`plugins/browser-plugin-packs.json` and `plugins/server-plugin-packs.json`
declare the ordered packs for each product/host target. `npm run build:plugins`
builds their union, validates each pack against its target host, and emits
separate browser and server deployment roots. Browser products start from a
same-origin `loader.json`; the authoritative server starts from its explicitly
configured local `plugin-set.json` and requires every resolved document and
module entry to remain within that plugin-set root after symlink resolution.
`SOLITUDE_SERVER_PLUGIN_SET` may point authoritative multiplayer at a different
assembled local plugin-set document.

Assembled packs live directly under their target plugin root. For example, the
browser core pack is emitted at `dist/client/plugins/core-pack-v1`, and the
authoritative content pack is emitted at
`dist/server/plugins/solitude-content-pack-v1`. The generated
plugin-set documents reference these flat paths; there is no intermediate
`packs` directory.

The default assembled loader configuration allows only `self`. JSON plugin
documents are fetched without following redirects, and browser pages enforce a
`script-src 'self'` Content Security Policy. Allowing a trusted external plugin
host therefore requires two deliberate deployment changes:

1. Add its exact HTTP(S) origin to `loader.json`.
2. Add the same origin to the page's `script-src` CSP.

CORS permission from the external host is also required. These controls limit
which trusted code can load; they do not sandbox code after loading.

The module must export `createPlugin`. Factories are retained and instantiated
with the current runtime options and a frozen host-service context whenever the
host creates a plugin composition. The context exposes narrow facades rather
than host implementation objects.

Plugin API version 6 adds pre-runtime world-model hooks while retaining the
creation-time profiler facade and the separation between plugin metadata and
executable hooks. A plugin may publish capabilities, declare optional
requirements on the focused entity, and group host callbacks under `hooks`:

```ts
return {
  id: "example",
  requirements: {
    focusEntity: ["collisionSphere"],
  },
  hooks: {
    markers: markerPlugin,
    scene: scenePlugin,
    worldModel: worldModelPlugin,
  },
};
```

Focus requirements list only capabilities not already guaranteed by
`ExternalFocusContext`: `collisionSphere` and `gravityMass`. The runtime rejects
unknown top-level properties, hook names, and requirement values so misspelled
or obsolete plugin shapes fail during composition.

## Plugin API Subpaths

- `@solitude/plugin-api/module`: plugin identity, capabilities, grouped hooks,
  focused-entity requirements, factory, and loaded ES-module contracts.
- `@solitude/plugin-api/world-model`: pre-runtime entity and focus
  contributions with controlled access to the assembled capability registry.
- `@solitude/plugin-api/celestial-bodies`: the canonical celestial-body
  provider capability consumed by scenario and spawning plugins.
- `@solitude/plugin-api/controllable-entities`: the canonical generic
  controllable-entity provider capability, placement/configuration contracts,
  constructor, and guard.
- `@solitude/plugin-api/orbits`: portable circular-orbit placement used by
  plugins without importing host simulation code.
- `@solitude/plugin-api/input`: keyboard action maps, handlers, and
  provider-declared actions that remain available through input locks.
- `@solitude/plugin-api/profiling`: control contract for the host profiler
  facade supplied through the plugin creation context.
- `@solitude/plugin-api/assets`: bundled-safe OBJ parsing for pack-owned mesh
  assets.
- `@solitude/plugin-api/runtime`: raw runtime option contracts passed to plugin
  factories.
- `@solitude/plugin-api/capabilities`: generic capability provider and registry
  primitives only.
- `@solitude/plugin-api/entity-names`: canonical dependency-free entity-name
  capability and lookup policy re-exported from `@solitude/entity-names`.
- `@solitude/plugin-api/input`, `hud`, `presentation`, `multiplayer`, and
  `telemetry`: domain capability contracts, ids, constructors, and guards.
- `@solitude/plugin-api/render`, `scene`, and `views`: renderer-neutral scene,
  contribution, material, texture, and view contracts.
- `@solitude/plugin-api/localization`: supported locale type and runtime locale
  parsing.
- `@solitude/plugin-api/loop`: frame-policy hooks and controlled runtime focus
  changes for browser loop plugins.
- `@solitude/plugin-api/math`: bundled-safe vector, matrix, intersection, and
  mesh-volume helpers plus epsilon constants. Importing this subpath
  intentionally includes math runtime code.
- `@solitude/plugin-api/world`: entity, focus, and world contracts plus
  dominant-body and gravitational-parameter helpers. This subpath depends on
  the math runtime.
- `@solitude/plugin-api/manifest`: external loader, set, pack, and plugin
  manifest contracts used by the host runtime.

## Current Packs

- `core-pack-v1`: browser presentation and control plugins shared by standalone
  and remote rendering. It currently contains:
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

The core pack is the migration destination for browser plugins shared by both
browser products as the external API grows to support their required
contribution types.

- `solitude-content-pack-v1`: browser-and-server gameplay content activated by
  both browser products and authoritative multiplayer. It currently contains:
  - `polyFighter`: controllable-entity provider owning the fighter OBJ mesh,
    derived mass, and complete entity configuration used by standalone ships
    and authoritative multiplayer spawning.

- `multiplayer-pack-v1`: multiplayer-only presentation plugins. It contains:
  - `remoteIdentityHud`: localized live game and assigned-entity identity HUD,
    backed by the client-owned multiplayer-session capability.
  - `shipColorNames`: localized entity names derived from server-assigned ship
    render colors.

- `standalone-pack-v1`: standalone-only runtime behavior. It currently
  contains:
  - `ships`: default blue/red standalone spacecraft, their Earth-relative
    orbital placement, and the initial focus selection.
  - `memory`: opt-in browser heap telemetry, toggled alongside profiling with
    `O` and published through the shared HUD panel capability.
  - `profiling`: opt-in runtime profiling control and localized status HUD,
    backed by the host profiler service exposed at plugin creation time.
  - `operatorSwitch`: repeat-safe `Tab` focus switching between the default
    controllable ships, ordered after playback so a paused focus change still
    refreshes the scene and declaring its action as available through
    playback's generic input lock.
