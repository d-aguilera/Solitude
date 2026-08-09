# Gravity Plugin Roadmap

## Purpose

- Extract the concrete Newtonian gravity implementation from
  `@solitude/engine` into an independently built external plugin.
- Keep the engine responsible for generic gravitational state, simulation
  ordering, and the contract required to advance that state.
- Make gravity an explicit, required product-composition choice shared by
  standalone and authoritative headless runtimes.
- Improve high-time-scale accuracy by bounding the integration timestep
  independently of presentation cadence and time scale.
- Preserve performance as the primary constraint: minimize CPU work, memory
  traffic, allocations, and synchronization before considering a different
  execution backend.
- Keep GPU gravity out of the active roadmap. A provider boundary may permit it
  later, but the current body counts and deployment model favor CPU execution.

## High-Level Plan

1. **Required gravity-provider contract.**
   - Keep `GravityEngine` and `GravityState` as generic engine-owned domain
     contracts.
   - Add a typed gravity contribution to internal and focused external plugin
     surfaces.
   - Treat gravity as a required singleton service: composition must fail when
     no provider or more than one provider is present.
   - Resolve a fresh gravity engine per game/runtime before constructing the
     tick handler. Never share mutable integrator workspace between sessions.
   - Support the contribution in both browser and server plugin hosts without
     exposing general server simulation-phase hooks.

2. **Extract the Newtonian provider.**
   - Create a host-neutral external Newtonian gravity plugin used by the
     Solitude browser and server content packs.
   - Move the leapfrog integrator, acceleration workspace, gravitational
     constant, and softening configuration out of `@solitude/engine`.
   - Remove browser and headless construction of `NewtonianGravityEngine` and
     remove the engine-owned default/fallback provider.
   - Keep gravity-state construction/refresh, phase ordering, collision
     ordering, and generic world gravity-mass capabilities in the engine.

3. **Bound integration error at high time scales.**
   - Replace the fixed five-substep policy with a configured maximum simulated
     timestep per integration step.
   - Let the Newtonian provider subdivide a requested interval according to
     its numerical-stability policy; core should request advancement without
     encoding integrator-specific substep counts.
   - Use a maximum timestep grounded in the fastest supported orbital and
     close-approach dynamics, with regression scenarios that expose energy and
     trajectory degradation.
   - Make extreme time warp compute-budgeted: simulation may advance more
     slowly in wall-clock time rather than silently taking unstable steps.

4. **Measure and optimize the CPU implementation.**
   - Benchmark force evaluation and integration separately across relevant
     body counts, time scales, and concurrent authoritative sessions.
   - Confirm that force calculation is the bottleneck before changing data
     layout.
   - If measurements justify it, evaluate reusable structure-of-arrays
     `Float64Array` storage for positions, velocities, masses, and
     accelerations while preserving the generic world boundary.
   - Consider worker threads, WebAssembly, SIMD, and multi-session batching
     only after the single-threaded allocation-free path is characterized.

5. **Close the extraction boundary.**
   - Remove obsolete engine exports and implementation-specific parameters.
   - Preserve deterministic-enough authoritative behavior and document any
     floating-point portability constraints.
   - Cover missing, duplicate, incompatible, browser, server, headless, and
     per-session provider composition with tests.
   - Update architecture maps and the root memory snapshot to reflect final
     ownership.

## Current State

- `GravityEngine` is already an engine-owned domain port with a synchronous
  `step(dtSeconds, gravityState)` operation.
- `GravityState` aliases entity mass, velocity, and position state and is built
  and refreshed by engine application code.
- `createTickHandler` receives a concrete gravity engine and invokes gravity
  between vehicle-dynamics hooks and collision resolution.
- `plugins/newtonian-gravity` owns the concrete all-pairs Newtonian
  calculation, leapfrog kick-drift-kick integration, softening configuration,
  gravitational constant used by the integrator, and reusable vector
  workspace.
- Internal and external plugin contracts expose a typed gravity-provider
  contribution. External API v11 supports it in browser and server plugins
  without widening general server simulation hooks.
- Runtime composition requires exactly one gravity provider, rejects missing
  or duplicate providers, validates the returned engine, and creates a fresh
  engine for every game/runtime.
- Both host-specific Solitude content packs discover the host-neutral
  `newtonianGravity` provider before other content plugins. Browser and
  headless hosts have no concrete gravity imports or implicit fallback.
- Engine application code requests one gravity advancement for each simulated
  interval. The Newtonian provider subdivides it into allocation-free steps no
  larger than 10 simulated seconds by default, independent of presentation
  cadence and time scale. `maxGravityStepSeconds` can override the positive
  finite bound through runtime options.
- The synchronous provider always completes every required bounded substep.
  Extreme time warp therefore consumes more wall-clock time and may reduce
  presentation cadence; it does not silently enlarge integration steps. The
  authoritative ticker additionally accumulates simulation time and advances
  it through fixed simulation intervals.
- The force calculation is exact all-pairs `O(N^2)` over reusable
  structure-of-arrays `Float64Array` storage. Canonical object-vector world
  state is copied into the workspace once per requested interval and copied
  back after every bounded substep completes; capacity grows geometrically and
  remains allocation-free at stable body counts.
- `npm run bench:gravity` compares the retained pre-optimization object-vector
  loop with the production typed-array loop. Representative local results show
  about 13.6x throughput at 10 bodies, 17.7x at 32 bodies, and 19.5x at 128
  bodies. A 10-body, 100-simulated-second interval containing ten bounded steps
  runs at roughly 60,000 requested intervals per second on the development
  environment. Benchmark values are environment-dependent; the checked-in
  harness is the source of reproducible evidence.
- Simulation, collisions, snapshots, and plugin hooks currently consume
  immediately available CPU world state. The active direction remains a
  synchronous CPU provider.

## Next Slice

Close and verify the gravity extraction boundary.

- Audit engine, browser, composition, multiplayer, external API, and deployment
  code for obsolete concrete-gravity imports, defaults, parameters, and names.
- Confirm missing/duplicate/invalid provider errors remain hard setup failures
  in browser and headless composition.
- Confirm browser/server plugin artifacts are self-contained and both deployed
  content packs contain `newtonianGravity` with API v11 manifests.
- Run full typecheck, boundary checks, tests, plugin builds, deployable builds,
  formatting, and architecture-map generation.
- Keep substantive architecture-map changes and remove timestamp-only churn.
- Reduce this document and `MEMORY.md` to the final current-state picture, move
  the roadmap to the archived set, and leave any future physics work as
  explicitly scoped follow-ups.

The plan is complete when no extraction work remains, the required provider is
present in every product composition, all verification passes, and the memory
router marks this roadmap complete.
