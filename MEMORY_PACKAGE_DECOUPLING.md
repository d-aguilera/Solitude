# Package Decoupling Memory

## Purpose

- This is the primary active roadmap for physically decoupling Solitude plugins
  from host packages.
- Use it before changing external plugin manifests, discovery, pack assembly,
  `@solitude/plugin-api`, `@solitude/plugin-runtime`, or choosing the next
  in-tree plugin to extract.
- The goal is enforced independence: product plugins are independently built
  packages loaded through runtime discovery, not implementation modules that
  host packages can gradually import and couple to again.

## Completion Direction

- Product plugin implementations should leave
  `packages/solitude/src/plugins/` and `packages/sim/src/plugins/` one slice at
  a time.
- Browser and authoritative products should select behavior through deployed
  plugin sets and single-host packs.
- Host packages should retain only generic runtime/composition adapters and the
  controlled API needed to run plugins.
- External plugin source may depend only on focused
  `@solitude/plugin-api/*` subpaths. Shared runtime code belongs in small,
  dependency-light packages such as `@solitude/geometry` when it is genuinely
  portable.
- No compatibility layer is required for superseded manifest or plugin API
  shapes.

## Runtime Foundation In Place

- Browser and authoritative server plugin-set discovery are implemented.
- Packs are atomic activation/deployment units. Pack schema v3 declares exactly
  one `host`; unpacked and multi-host plugins are unsupported.
- A pack may contain multiple ordered plugins. Plugin schema v2 declares an
  exact API version, id, and module entry, with no environment/host property.
- Browser discovery starts from same-origin `plugins/loader.json`, validates an
  explicit origin allowlist, rejects JSON redirects, and is reinforced by page
  CSP. Server discovery starts from an explicit local plugin set and enforces
  lexical and real-path containment.
- Browser plugins may expose capabilities, focused-entity requirements, and
  the current hook surfaces. Server plugins are capability-only until an
  authoritative external lifecycle is deliberately designed.
- External packages import only the rootless, focused Plugin API. Built module
  graphs must be self-contained and contain no bare imports.
- Browser and server builds assemble target-specific plugin sets. Production
  server startup discovers content from `dist/server/plugins/plugin-set.json`;
  it does not name the concrete controllable-entity provider.

## Extracted Deployment Units

- `core-pack-v1` (`browser`): twelve presentation/control plugins shared by
  standalone and multiplayer.
- `standalone-pack-v1` (`browser`): `ships`, `pause`, `timeScale`, `memory`,
  `profiling`, and `operatorSwitch`.
- `multiplayer-pack-v1` (`browser`): `remoteIdentityHud` and `shipColorNames`.
- `solitude-content-browser-pack-v1` (`browser`) and
  `solitude-content-server-pack-v1` (`server`): host-specific wrappers around
  the same `polyFighter` implementation from the host-neutral
  `@solitude-plugins/poly-fighter` package.

The browser and server Poly Fighter modules are intentionally byte-identical;
separate packs express separate host activation and deployment.

## Remaining Static Plugin Frontier

`packages/solitude/src/plugins/` still owns:

- `playback`

`packages/sim/src/plugins/` still owns:

- `autopilot`
- `autopilotInput`
- `solarSystem`
- `spacecraftOperator`

The standalone and remote catalogs also compose the generic browser-owned
`hud` overlay adapter. Treat that as a host adapter unless an extraction shows
that product behavior still remains in it.

The static `simPluginCatalog` is currently consumed by standalone, the remote
client, Solitude headless composition, and authoritative multiplayer
composition. Removing it is the deeper part of the remaining work.

## Recommended Slicing

1. Extract `playback`, the final static standalone product plugin,
   independently from the dormant headless playback runner
   work; preserve its browser behavior and tests without making the headless
   backlog a prerequisite.
2. Audit the `@solitude/sim` plugins one at a time. Introduce only the narrow
   Plugin API surface required by the selected slice.
3. Before moving server-used simulation behavior, design an explicit
   authoritative lifecycle for server plugins. Do not smuggle browser hooks
   through capability-only server modules.
4. When one implementation must run on multiple hosts, keep one host-neutral
   implementation package and build separate single-host deployment packs, as
   with Poly Fighter.

The order is a recommendation, not a commitment. Reinspect current
dependencies before every extraction.

## Extraction Guardrails

- Preserve plugin order; later loop/frame-policy plugins can override earlier
  plugins, and input handlers are consulted in reverse order.
- Do not add product concepts to engine/browser merely to make an extraction
  easy. Extend the controlled API with generic contracts.
- External plugins must not import host packages or peer implementation
  modules. Use capability protocols for collaboration.
- Keep math, geometry, localization, input, HUD, and entity-name policy in
  their dependency-light shared packages when those packages already own the
  abstraction.
- A pack's single `host` is both a deployment declaration and a runtime plugin
  shape constraint.
- Keep startup fail-closed for invalid manifests, unsupported hook shapes,
  duplicate ids, collisions, disallowed origins, and path escapes.
- Run `npm run check:boundaries`, typechecks, tests, and the relevant plugin and
  product builds for every extraction slice.

## Open Design Pressure

- The server external contract has no world-model, controls, simulation, or
  loop lifecycle. Extracting `solarSystem`, `spacecraftOperator`, or
  `autopilot` from the static authoritative composition will require this
  boundary to be designed.
- Host-specific packs duplicate deployment wrappers when one implementation
  runs in browser and server. That duplication is intentional; share source,
  not activation metadata.
- Loaded plugins are trusted same-realm code. Discovery controls trust roots
  but does not provide sandboxing, signatures, unloading, or dependency
  resolution.
- `dist/plugin-packages` and `dist/plugin-public` are intermediate build and
  assembly trees. Deployable products consume the assembled plugin trees under
  `dist/standalone/plugins`, `dist/client/plugins`, and
  `dist/server/plugins`.

## Historical Context

- `archive/MEMORY_PLUGIN_EXTRACTION.md` records the earlier conceptual
  extraction audit before plugins became independent packages.
- `archive/MEMORY_PACKAGE_SPLIT.md` records the completed engine/browser/app
  workspace split that established the package boundaries this effort now
  tightens.
