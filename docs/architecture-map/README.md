# Architecture Map

Generate the map:

```bash
npm run map:architecture
```

View it over HTTP so the browser can load `architecture.json`:

```bash
npx serve docs/architecture-map
```

The generated model combines package manifest dependencies, package-exported
modules, exported-module import edges, and public symbol references reachable
through package `exports`. Source files are read for TypeScript analysis, but
physical folders and files are not emitted into the graph.
