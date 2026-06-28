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

The viewer projects hidden edge endpoints to their nearest visible ancestor, so
collapsed packages can still show edges to expanded modules or symbols. It
chooses the most specific available dependency edges automatically: public symbol
references first, module imports as fallback, then package dependencies.
Automatic layout runs once at startup through ELK when available, with a
deterministic grid fallback. Expanding and collapsing nodes does not run layout;
use the `Layout` button to recompute placement. Layout positions are persisted in
browser storage and invalidated automatically when the generated graph shape
changes.
