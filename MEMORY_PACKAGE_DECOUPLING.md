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

- Standalone product plugin implementations are fully extracted from
  `packages/solitude`. The remaining simulation implementations should leave
  `packages/sim/src/plugins/` one slice at a time.
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
  the current hook surfaces, including narrow control-state and
  before/after-vehicle-dynamics callbacks. API v9 server plugins may expose
  capabilities, control-state/attitude resolvers, and the authoritative
  pre-runtime `worldModel` hook; requirements and other runtime/browser hooks
  remain unsupported.
- External packages import only the rootless, focused Plugin API. Built module
  graphs must be self-contained and contain no bare imports.
- Browser and server builds assemble target-specific plugin sets. Production
  server startup discovers content from `dist/server/plugins/plugin-set.json`;
  it does not name the concrete controllable-entity provider.

## Extracted Deployment Units

- `core-pack-v1` (`browser`): thirteen presentation/control plugins shared by
  standalone and multiplayer, including the extracted `autopilotInput`.
- `standalone-pack-v1` (`browser`): `ships`, `playback`, `pause`, `timeScale`,
  `memory`, `profiling`, and `operatorSwitch`.
- `multiplayer-pack-v1` (`browser`): `remoteIdentityHud` and `shipColorNames`.
- `solitude-content-browser-pack-v1` (`browser`) and
  `solitude-content-server-pack-v1` (`server`): host-specific wrappers around
  the same ordered `solarSystem`, `autopilot`, and `polyFighter` implementations from
  host-neutral external packages.

The browser and server content modules are intentionally byte-identical;
separate packs express separate host activation and deployment.

## Remaining Static Plugin Frontier

No product plugin implementation remains under `packages/solitude/src/`.
Standalone still composes the generic browser HUD adapter and the static
simulation catalog through `packages/solitude/src/staticPluginCatalog.ts`.

`packages/sim/src/plugins/` still owns:

- `spacecraftOperator`

The browser-only `autopilotInput` implementation has moved to `core-pack-v1`.
The host-neutral `solarSystem` and `autopilot` implementations are bundled
into both Solitude content packs and participate in browser and authoritative
assembly through discovery. The static catalogs no longer contain either.

The standalone and remote catalogs also compose the mandatory browser-owned
`browserHudOverlay` host adapter through
`createBrowserHudOverlayAdapter`. It deliberately uses the internal
`GamePlugin` capability envelope to bridge HUD panel providers into the browser
overlay lifecycle; it is host infrastructure, not an extraction candidate.

The static `simPluginCatalog` is currently consumed by standalone, the remote
client, and authoritative multiplayer composition. Headless loop creation no
longer accepts plugin ids or runtime options; authoritative composition passes
one ordered collection of already-instantiated static and discovered plugins.
Removing the remaining catalog consumers is the deeper part of the work.

## Recommended Slicing

1. Audit the `@solitude/sim` plugins one at a time. Introduce only the narrow
   Plugin API surface required by the selected slice.
2. Use API v9 authoritative world-model and control phases for pre-runtime
   content and control/attitude resolution. Before moving server-used
   simulation behavior, design its explicit authoritative lifecycle rather
   than smuggling browser hooks into server modules.
3. When one implementation must run on multiple hosts, keep one host-neutral
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
- Run `npm run map:architecture` for every slice and inspect its diff. Include
  substantive slice-related map changes, but restore timestamp-only
  `generatedAt` updates.

## Open Design Pressure

- API v9's server control lifecycle runs the extracted `autopilot`. The server
  external contract still has no simulation or loop lifecycle; extracting the
  final static plugin, `spacecraftOperator`, requires that boundary to be
  designed.
- Browser API v9 also supplies a frozen host snapshot facade. External
  playback owns scenario metadata and scripts, while the engine remains the
  single implementation of runtime snapshot capture/apply policy.
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
