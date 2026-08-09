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

1. **Establish a required gravity-provider contract.**
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
- `packages/engine/src/infra/NewtonianGravityEngine.ts` owns the concrete
  all-pairs Newtonian calculation, leapfrog kick-drift-kick integration, and
  reusable vector workspace.
- `packages/engine/src/global/parameters.ts` owns the gravitational constant and
  softening length used by that implementation.
- Browser bootstrap constructs the Newtonian engine directly. The generic
  headless loop accepts an optional override but otherwise constructs the same
  implementation directly.
- Plugin assembly does not currently expose or resolve a gravity provider.
  Generic capabilities are fan-out collections of unknown values and do not by
  themselves enforce required-singleton semantics.
- External browser and server plugin contracts do not currently contain a
  gravity contribution. Server plugins intentionally expose only their narrow
  authoritative hooks.
- `applyGravity` divides every simulated interval into exactly five substeps.
  The effective integration timestep therefore grows without bound as time
  scale grows, allowing orbital instability and degradation at high time
  scales.
- The force calculation is exact all-pairs `O(N^2)`. For the current small
  worlds, temporal substep demand is expected to become limiting before the
  number of pair interactions does, but this requires measurement.
- Simulation, collisions, snapshots, and plugin hooks currently consume
  immediately available CPU world state. The active direction remains a
  synchronous CPU provider.

## Next Slice

Establish the gravity-provider composition seam without physically moving the
Newtonian implementation yet.

- Add a typed internal gravity contribution and a focused external plugin API
  surface for creating a gravity engine.
- Extend browser/server external plugin validation and adaptation for that
  contribution, including any required plugin API version change.
- Add one shared resolver that requires exactly one gravity provider and emits
  clear missing/duplicate-provider setup errors.
- Resolve a fresh provider instance per standalone or headless game before tick
  construction.
- Route browser and headless runtime creation through the resolver while using
  the existing Newtonian implementation through a temporary composition
  provider.
- Add focused tests for valid, missing, duplicate, browser, server, and
  per-runtime provider resolution.
- Do not change integration mathematics, fixed substep behavior, or physical
  package ownership in this slice.

The slice is complete when gravity selection is entirely plugin-driven at the
runtime composition boundary and the remaining physical extraction is a move
of the concrete provider rather than another host-wiring redesign.
