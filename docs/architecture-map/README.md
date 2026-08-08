# Architecture Map

Generate the map:

```bash
npm run map:architecture
```

View it over HTTP so the browser can load `architecture.json`:

```bash
npx serve docs/architecture-map
```

The generated model contains workspace package nodes and package dependency
edges from package manifests.

The viewer lays out packages with ELK, persists dragged node positions in browser
storage, and invalidates saved positions automatically when the generated graph
shape changes. Use the `Layout` button to recompute placement.
