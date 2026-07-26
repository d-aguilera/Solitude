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
is an atomic deployment and activation unit: pack schema version 3 declares one
`host` and owns an ordered list of one or more plugin manifests. Packs cannot
span execution hosts, there is no `universal` sentinel, and individual plugins
do not declare an environment. Unpacked plugins are not supported; a
single-plugin deployment is represented by a pack containing one plugin
manifest. Each plugin manifest declares only its schema version, exact host API
version, id, and ES-module entry URL. The runtime validates the complete pack
and plugin graph before importing any plugin module.

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
`dist/server/plugins/solitude-content-server-pack-v1`. The generated
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

The pack host is also a plugin-shape contract. Browser plugins may publish
capabilities, focused-entity requirements, and the current hook surfaces.
Server plugins may publish capabilities, authoritative control-state/attitude
resolvers, and the pre-runtime `worldModel` hook. The runtime captures the
loading host in each retained factory and rejects properties unsupported by
that host when the factory is instantiated. `ExternalBrowserPlugin`,
`ExternalServerPlugin`, and `ExternalHostNeutralPlugin` expose the corresponding
compile-time contracts.

Plugin API version 9 adds the authoritative control lifecycle while retaining
the server pre-runtime world-model phase, browser vehicle-dynamics/loop hooks,
controlled-body angular velocity, and the canonical runtime snapshot service.
Server requirements and simulation, loop, scene, view, and presentation hooks
remain unsupported. A browser plugin may publish capabilities, declare optional
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

- `@solitude/plugin-api/module`: common and host-specific plugin identities,
  capabilities, grouped browser hooks, focused-entity requirements, factories,
  and loaded ES-module contracts.
- `@solitude/plugin-api/world-model`: pre-runtime entity and focus
  contributions with controlled access to the assembled capability registry.
- `@solitude/plugin-api/celestial-bodies`: the canonical celestial-body
  provider capability consumed by scenario and spawning plugins.
- `@solitude/plugin-api/controllable-entities`: the canonical generic
  controllable-entity provider capability, placement/configuration contracts,
  constructor, and guard.
- `@solitude/plugin-api/controls`: mutable control-state updates and
  attitude-command resolution for browser and authoritative plugins.
- `@solitude/plugin-api/spacecraft`: canonical autonomous-control and
  propulsion-resolver capabilities shared with the spacecraft operator.
- `@solitude/plugin-api/orbits`: portable circular-orbit placement used by
  plugins plus bundled-safe Keplerian setup and configuration types.
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
  contribution, material, texture, mesh, unit-icosphere, and view contracts.
- `@solitude/plugin-api/localization`: supported locale type and runtime locale
  parsing.
- `@solitude/plugin-api/loop`: frame-policy hooks and controlled runtime focus
  changes plus initial simulation-time selection for browser loop plugins.
- `@solitude/plugin-api/simulation`: narrow before/after vehicle-dynamics
  callbacks with controlled temporary focus changes.
- `@solitude/plugin-api/snapshots`: canonical runtime entity snapshot
  contracts and the frozen host capture/apply service supplied through the
  plugin creation context.
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
  - `autopilotInput`: shared `C`/`V`/`Z`/`X` autopilot mode-toggle keyboard
    behavior.
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

- `solitude-content-browser-pack-v1`: browser gameplay content activated by
  both browser products. It currently contains:
  - `solarSystem`: solar-system world entities, celestial-body lookup, and
    localized entity names.
  - `autopilot`: headless attitude and propulsion control behavior.
  - `polyFighter`: controllable-entity provider owning the fighter OBJ mesh,
    derived mass, and complete entity configuration used by standalone ships.

- `solitude-content-server-pack-v1`: authoritative gameplay content using the
  capability and pre-runtime world-model surfaces. It contains the same
  `solarSystem`, `autopilot`, and `polyFighter` modules used by the browser
  content pack.

Both content packs use the shared `@solitude-plugins/solitude-content-pack`
build configuration and bundle the implementations owned by
`@solitude-plugins/solar-system`, `@solitude-plugins/autopilot`, and
`@solitude-plugins/poly-fighter`. Their emitted plugin modules are identical;
only the deployment pack id and host contract differ.

- `multiplayer-pack-v1`: multiplayer-only presentation plugins. It contains:
  - `remoteIdentityHud`: localized live game and assigned-entity identity HUD,
    backed by the client-owned multiplayer-session capability.
  - `shipColorNames`: localized entity names derived from server-assigned ship
    render colors.

- `standalone-pack-v1`: standalone-only runtime behavior. It currently
  contains:
  - `ships`: default blue/red standalone spacecraft, their Earth-relative
    orbital placement, and the initial focus selection.
  - `playback`: diagnostic control capture and fixed-step playback, scene
    snapshots through the canonical host snapshot service, optional circle-now
    logs, localized status HUD, and generic input locking.
  - `pause`: `P` and page-visibility pause behavior plus the localized paused
    HUD status. It yields to an earlier fixed-tick diagnostic loop and is
    ordered before profiling so profiling observes the paused frame policy.
  - `timeScale`: `[`/`]` power-of-two simulation-time multiplier and localized
    status HUD. It yields to an earlier fixed-tick diagnostic loop so runtime
    discovery does not reverse playback's frame-policy precedence.
  - `memory`: opt-in browser heap telemetry, toggled alongside profiling with
    `O` and published through the shared HUD panel capability.
  - `profiling`: opt-in runtime profiling control and localized status HUD,
    backed by the host profiler service exposed at plugin creation time.
  - `operatorSwitch`: repeat-safe `Tab` focus switching between the default
    controllable ships, ordered after playback so a paused focus change still
    refreshes the scene and declaring its action as available through
    playback's generic input lock.

## Diagnostic Playback

The standalone playback plugin is enabled by raw runtime options:

- `?mode=capture&scenario=<id>`: press `L` to capture the current world and
  begin recording playback-owned controls; press `L` again to dump a
  paste-ready script module to the console.
- `?mode=playback&scenario=<registered-id>`: apply the saved snapshot, start
  paused, and use `P` to start, pause, resume, and finally release normal
  control after playback completes.
- Add `&log=circle-now` to emit the optional circle-now diagnostic report at
  playback end.
- Add `&autopilot=v1` through `&autopilot=v5` to select the diagnostic
  autopilot algorithm; the current default is `v5`.

Playback records semantic control state rather than keyboard events. Capture
stores the effective time scale at recording start; a later time-scale change
produces a warning because scripts have one top-level scale. Playback scenarios
must be registered in `standalone-pack-v1/src/playback/scripts/index.ts`;
unknown ids fail closed.
