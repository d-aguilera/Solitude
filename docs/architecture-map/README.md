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

Dragging selected packages is constrained in the browser. The viewer blocks moves
that introduce or worsen upward dependency edges, dependency edges crossing
package boxes plus a margin, or package-box overlap plus a margin. Packages
involved in any remaining violation are marked with a red border.
When the cursor moves into forbidden space, the dragged packages project to a
nearby legal position so they can slide along constraint boundaries.
Use `Rules On` / `Rules Off` to temporarily disable these constraints while
untangling a generated layout.
