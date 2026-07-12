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
  assembly places plugin artifacts and an ordered `plugin-set.json` beside the
  browser products.
- External plugins are trusted code. They run in the host page and are not a
  security sandbox.

## Runtime Documents

The plugin-set document lists plugin manifest URLs in runtime order. Each
plugin manifest declares its schema version, exact host API version, target
environment, id, and ES-module entry URL. The runtime validates every manifest
before importing any plugin module.

The module must export `createPlugin`. Factories are retained and instantiated
with the current runtime options whenever the host creates a plugin
composition.

## Current Plugin

- `targeting-laser`: browser targeting beam, target lock, impact/miss markers,
  and keyboard toggle behavior shared by standalone and remote rendering.
