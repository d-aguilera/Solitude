# Package Decoupling Memory

## Purpose

- This is the completed roadmap for physically decoupling Solitude plugins
  from host packages.
- Use it as historical context before changing external plugin manifests,
  discovery, pack assembly, `@solitude/plugin-api`, or
  `@solitude/plugin-runtime`.
- The goal is enforced independence: product plugins are independently built
  packages loaded through runtime discovery, not implementation modules that
  host packages can gradually import and couple to again.

## Completed State

- Product plugin implementations are fully extracted from host packages.
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
  the current hook surfaces. API v10 server plugins may expose capabilities,
  control-state/attitude resolvers, authoritative vehicle dynamics, and the
  pre-runtime `worldModel` hook; requirements and browser-only hooks remain
  unsupported.
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
  the same ordered `solarSystem`, `autopilot`, `spacecraftOperator`, and
  `polyFighter` implementations from external packages.

The host-neutral content modules are intentionally byte-identical.
`spacecraftOperator` uses thin host-specific entries around one shared
dynamics implementation because only the browser entry contributes input,
prediction, and its camera rig.

## Remaining Static Plugin Frontier

No product plugin implementation remains under the host packages. The
`solitude` package contains only the generic browser HUD host adapter, while
`@solitude/composition` contains the shared world-config and headless
composition helpers.

The browser-only `autopilotInput` implementation has moved to `core-pack-v1`.
The extracted `solarSystem`, `autopilot`, `spacecraftOperator`, and
`polyFighter` implementations are bundled into both Solitude content packs and
participate in browser and authoritative assembly through discovery.

The standalone and remote catalogs also compose the mandatory browser-owned
`browserHudOverlay` host adapter through
`createBrowserHudOverlayAdapter`. It deliberately uses the internal
`GamePlugin` capability envelope to bridge HUD panel providers into the browser
overlay lifecycle; it is host infrastructure, not an extraction candidate.

The former `simPluginCatalog` and its product consumers have been removed.
Headless loop creation accepts one ordered collection of already-instantiated
discovered plugins.

## Completed Slicing

- API v10 authoritative world-model, control, and vehicle-dynamics phases
  support server content and simulation behavior.
- Implementations that run on multiple hosts use one host-neutral source
  package and separate single-host deployment packs.
- `@solitude/composition` is the remaining thin product-composition package;
  it owns no plugin implementation or catalog.

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

- API v10's authoritative vehicle-dynamics contribution is intentionally
  narrower than the browser simulation surface: server plugins still cannot
  register before/after phases or browser lifecycle hooks.
- Browser API v10 also supplies a frozen host snapshot facade. External
  playback owns scenario metadata and scripts, while the engine remains the
  single implementation of runtime snapshot capture/apply policy.
- Host-specific packs duplicate deployment wrappers when one implementation
  runs in browser and server. That duplication is intentional; share source,
  not activation metadata.
- Loaded plugins are trusted same-realm code. Discovery controls trust roots
  but does not provide sandboxing, signatures, unloading, or dependency
  resolution.
- `dist/plugin-packs` and `dist/plugin-public` are intermediate build and
  assembly trees. Deployable products consume the assembled plugin trees under
  `dist/standalone/plugins`, `dist/client/plugins`, and
  `dist/server/plugins`.

## Historical Context

- `archive/MEMORY_PLUGIN_EXTRACTION.md` records the earlier conceptual
  extraction audit before plugins became independent packages.
- `archive/MEMORY_PACKAGE_SPLIT.md` records the completed engine/browser/app
  workspace split that established the package boundaries this effort now
  tightens.
