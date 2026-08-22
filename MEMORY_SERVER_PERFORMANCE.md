# Server Performance Baseline

## Purpose

- Establish a reproducible performance baseline for the production
  authoritative Solitude server before further architectural or product
  changes.
- Make server capacity, CPU headroom, latency, memory behavior, garbage
  collection pressure, and saturation visible rather than inferred from
  implementation structure.
- Preserve performance as a first-class architectural constraint while keeping
  runtime plugin composition and package decoupling intact.
- Use this document as the roadmap and handoff point for server performance
  instrumentation, benchmarks, baseline capture, and later regression gates.

## Scope

The effort covers three complementary measurement layers:

1. **Gravity microbenchmark**: isolates the external Newtonian provider and
   detects force-loop or data-layout regressions.
2. **In-process authoritative benchmark**: steps real multiplayer games without
   HTTP or WebSockets and isolates simulation, input processing, snapshot
   capture, and compact snapshot encoding.
3. **End-to-end server load benchmark**: runs the production server bundle with
   discovered server plugins and exercises real HTTP, WebSocket input,
   serialization, broadcast, and fanout.

The initial effort is server-focused. Browser rendering and texture loading are
out of scope. The multiplayer texture-reload fix is client-side and should not
affect steady-state server measurements; load clients must remain headless
WebSocket clients rather than browser pages.

## Current State

- `npm run bench:gravity` runs the checked-in Vitest benchmark for the external
  typed-array Newtonian provider. It compares the production implementation
  with the retained object-vector implementation at 10, 32, and 128 bodies and
  includes a bounded high-warp interval.
- The gravity provider owns exact all-pairs `O(N^2)` leapfrog integration over
  reusable `Float64Array` workspaces. It copies canonical world state into and
  out of that workspace once per requested interval and grows capacity
  geometrically.
- Gravity advancement is bounded to 10 simulated seconds per provider substep
  by default. The authoritative ticker normally advances through fixed
  16.67-millisecond simulation intervals, so increased simulation rate mainly
  raises the number of fixed steps required per wall-clock second.
- `scripts/run-server-load.mjs` creates one authoritative game, connects up to
  the current 16-client game limit, sends deterministic pulse-like input, polls
  `/metrics`, and can report input-acknowledgement and snapshot-inter-arrival
  latency.
- `packages/server/src/metrics.ts` currently reports rolling per-game entity
  count, snapshot step and serialization average/p95, snapshot cadence,
  payload/wire bytes, sockets, heap used, and RSS.
- Current duration measurements use `Date.now()`. Healthy sub-millisecond work
  can therefore appear as zero and current percentiles are not a sufficiently
  precise official baseline.
- The load harness supports only one game and prints periodic reports. It does
  not yet provide warm-up phases, repetitions, structured result files,
  deterministic scenario definitions, or capacity sweeps.
- The server does not yet expose achieved simulation throughput, simulation
  backlog, event-loop delay, process CPU utilization, detailed heap/external
  memory, or GC counts/pause time.
- The first authoritative input-allocation fix is complete: the headless loop
  reuses its entity-input map and mutable per-entity input records.

## Questions the Baseline Must Answer

For every canonical workload:

- Can the server sustain the requested simulation rate?
- How much CPU headroom remains?
- What are p50, p95, p99, and maximum simulation, serialization, event-loop,
  and input-acknowledgement latencies?
- Does simulation backlog remain bounded or grow during the measurement?
- Does heap stabilize after warm-up, and what GC pressure is observed?
- How do costs scale with players per game, concurrent games, simulation rate,
  and input-event rate?
- At what workload does the first service threshold fail?
- If performance changes, is the regression in gravity, authoritative
  simulation/snapshot work, or transport/fanout?

Treat one authoritative game as the primary capacity unit. Gravity, dynamics,
collisions, and snapshot capture scale per game and entity; serialization and
WebSocket fanout additionally scale with subscribed clients.

## Canonical Workload Matrix

Start with this small fixed matrix:

| Scenario     | Games | Clients per game | Input Hz per client | Simulation rate |
| ------------ | ----: | ---------------: | ------------------: | --------------: |
| Idle         |     1 |                1 |                   0 |              1x |
| Typical      |     1 |                8 |                   4 |              1x |
| Full game    |     1 |               16 |                   4 |              1x |
| Many games   |     8 |                8 |                   4 |              1x |
| High fanout  |     4 |               16 |                   4 |              1x |
| Input stress |     1 |               16 |                  30 |              1x |
| Warp 10      |     1 |               16 |                   4 |             10x |
| Warp 60      |     1 |               16 |                   4 |             60x |

Also provide a capacity sweep over 1, 2, 4, 8, 16, and then increasing
concurrent games, initially with eight clients per game. Stop after the first
well-confirmed saturation point rather than spending time far beyond usable
capacity.

High-warp cost should initially rise approximately with required fixed-step
throughput. The benchmark must distinguish requested simulation time from
simulation time actually advanced and expose accumulating catch-up work.

## Required Measurements

### Simulation and scheduling

- Simulation step duration p50/p95/p99/max.
- Simulation steps completed per wall-clock second.
- Simulation milliseconds advanced per wall-clock second.
- Requested simulation milliseconds per wall-clock second.
- Simulation backlog in milliseconds.
- Broadcast-loop duration p50/p95/p99/max.
- Achieved snapshot rate.
- Event-loop delay p50/p95/p99/max.

`simulationBacklogMillis` is critical. Step duration alone can look healthy
while the ticker accumulates more simulation work than it completes.

### Process and memory

- Process CPU user and system time over each reporting window.
- Process CPU utilization over each reporting window.
- Heap used and heap total.
- RSS.
- External and array-buffer memory, especially because gravity uses typed
  arrays.
- GC count and total/max pause duration by GC type for diagnostic benchmark
  runs.
- Heap trend after warm-up.

### Transport and interaction

- Snapshot serialization duration p50/p95/p99/max.
- Snapshot payload bytes and aggregate wire bytes per second.
- Connected sockets and clients per game.
- Input acknowledgement latency p50/p95/p99/max.
- Snapshot inter-arrival duration p50/p95/p99/max.
- Pending input acknowledgements at the end of a run.

## Instrumentation Constraints

- Use a monotonic high-resolution clock such as `performance.now()` or
  `process.hrtime.bigint()` for durations. Continue using wall-clock time only
  where protocol semantics require timestamps.
- Avoid retaining one allocated object per sample. Prefer counters,
  accumulators, maxima, and fixed-size reusable histogram buckets.
- Keep cheap production metrics always available. More intrusive GC or
  diagnostic observation may be opt-in if measurement shows material overhead.
- Use Node's event-loop delay monitor and performance observer where suitable,
  but measure their overhead before enabling them by default.
- The measurement system must not introduce a new hot-path allocator or hide
  saturation through unbounded metric storage.
- Preserve generic server and engine ports; performance instrumentation belongs
  in the appropriate server/infra adapter rather than product or domain code.

## Harness Target Shape

Extend `scripts/run-server-load.mjs`, or factor it into reusable modules, to
support:

- `--games`
- `--clients-per-game`
- `--input-hz`
- `--sim-rate`
- `--warmup`
- `--duration`
- `--repetitions`
- `--seed`
- `--output`
- a quiet machine-readable mode

Each game must have its own creation lifecycle and participants. Many clients
in one game are not equivalent to many independently simulated games.

Emit a versioned structured result containing at least:

```json
{
  "schemaVersion": 1,
  "commit": "git commit",
  "nodeVersion": "runtime version",
  "platform": "OS and architecture",
  "cpu": "processor identity",
  "serverBuild": "production",
  "scenario": {},
  "warmupSeconds": 15,
  "measurementSeconds": 60,
  "samples": {},
  "summary": {}
}
```

Check in scenario definitions, the runner, the result schema, and one named
reference-machine baseline. Do not accumulate arbitrary developer-machine
results in version control. A candidate location is
`benchmarks/server/baselines/<machine>/<commit>.json`.

## Reproducible Run Protocol

For the official baseline:

1. Build server plugins and the production server bundle once.
2. Run `dist/server/main.js`, not the development server.
3. Run the load generator in a separate process; use a separate machine for
   serious network/capacity measurements when available.
4. Pin the server to a known CPU set when practical and record the effective
   hardware/environment.
5. Avoid unrelated workloads, power-saving throttling, and debug inspectors.
6. Warm up for 15 seconds.
7. Measure for at least 60 seconds.
8. Repeat each scenario five times, restarting the server between repetitions.
9. Report the median run and the worst relevant p95/p99 latency.
10. Record commit, dirty state, Node version, OS, architecture, CPU model,
    runtime options, scenario parameters, and plugin API/pack identity.

A shorter local regression profile may use a 5-second warm-up, a 20-second
measurement, and fewer repetitions, but must be labeled as non-reference.

## Saturation and Initial Acceptance Policy

Do not choose final numerical budgets before recording current behavior on the
reference machine. Define saturation immediately as any of:

- Achieved simulation rate falls below 99% of requested rate.
- Simulation backlog grows throughout the steady-state measurement window.
- Snapshot cadence materially misses its configured target.
- Input acknowledgement latency exceeds the agreed interaction budget.
- Event-loop delay p99 exceeds one broadcast interval; at 60 Hz this is roughly
  16.67 milliseconds and is an early warning rather than a final product SLA.
- Heap continues to grow after warm-up without reaching a stable band.
- CPU remains saturated while latency or backlog grows.

Initially report regressions without failing CI. Promote low-variance metrics
to hard gates only after repeated runs establish normal machine and runtime
variance. Functional CI should retain small deterministic benchmarks; official
capacity runs should use the controlled reference environment.

## Implementation Roadmap

### Slice 1: precise, allocation-conscious metrics

- Replace duration measurement based on `Date.now()` with a monotonic
  high-resolution clock.
- Replace per-sample timed-object windows on hot paths with bounded reusable
  aggregation suitable for percentiles.
- Add p50/p99/max alongside existing average/p95 values.
- Add process CPU, complete memory categories, and event-loop delay.
- Add tests using injected clocks and deterministic samples.
- Measure instrumentation overhead before and after the change.

### Slice 2: achieved throughput and backlog

- Instrument requested simulation advancement, completed steps, completed
  simulation milliseconds, broadcast-loop duration, and remaining accumulated
  simulation time.
- Expose achieved/requested ratios and `simulationBacklogMillis` per game.
- Ensure ticker behavior remains unchanged; this slice observes rather than
  changes catch-up policy.
- Add deterministic ticker tests covering normal load, delayed callbacks,
  high simulation rates, and growing backlog.

### Slice 3: multi-game structured load harness

- Add multiple games and clients-per-game support.
- Separate warm-up and measured phases.
- Add repetitions, deterministic input seeds, simulation-rate configuration,
  quiet operation, and versioned JSON output.
- Aggregate server metrics and client-observed acknowledgement/inter-arrival
  latency without printing every poll.
- Detect incomplete joins, dropped sockets, pending acknowledgements, and
  premature server failure as failed runs.

### Slice 4: in-process authoritative benchmark

- Benchmark real multiplayer composition and discovered server plugins without
  HTTP/WebSocket scheduling noise.
- Cover representative entity counts, concurrent independent games, input
  rates, and simulation rates.
- Report simulation plus snapshot-capture/encoding cost separately where
  feasible without changing runtime behavior.
- Keep `npm run bench:gravity` as the narrower provider-specific signal.

### Slice 5: capture the reference baseline

- Select and name the reference machine/environment.
- Run the canonical matrix and capacity sweep against the production bundle.
- Check in the scenario definitions and one versioned reference result.
- Document the first observed bottleneck and saturation point using measured
  evidence.
- Set provisional warning thresholds based on observed variance and headroom.

### Slice 6: regression reporting and gates

- Add comparison against the selected baseline.
- Report absolute values, percentage deltas, environment mismatches, and
  statistical spread.
- Begin with non-blocking reports.
- Promote stable, representative metrics to blocking thresholds only after
  enough repeated data exists.

## Diagnostic Interpretation

- Gravity benchmark regresses while higher layers regress: investigate the
  provider force loop, canonical state copying, substep policy, or typed-array
  capacity behavior.
- In-process authoritative benchmark regresses while gravity is stable:
  investigate vehicle dynamics, collisions, input-window processing, runtime
  snapshots, or compact encoding.
- End-to-end benchmark regresses while in-process results are stable:
  investigate ticker scheduling, JSON serialization, WebSocket fanout,
  metrics, GC, or event-loop contention.
- High simulation-rate scenarios alone regress: inspect fixed-step catch-up,
  requested/achieved throughput, and backlog before changing gravity accuracy
  policy.
- High fanout alone regresses: inspect snapshot serialization reuse, socket
  buffering, and aggregate wire work rather than simulation.

## Candidate First Slice

Implement precise, allocation-conscious metrics and backlog observability
together only if they can remain a small coherent change. Otherwise begin with
high-resolution bounded aggregation, then add ticker throughput/backlog in the
next commit. Do not establish numerical performance claims or CI gates until
the revised instrumentation itself has been measured for overhead.

## Open Questions

- Which physical or virtual machine will be the named reference environment?
- Should official end-to-end runs place the load generator on a separate host
  from the server, while retaining same-host runs for development convenience?
- Which input-acknowledgement latency constitutes the initial interaction
  budget?
- Should GC diagnostics be enabled by a server environment flag or only by a
  benchmark launcher option?
- What bounded histogram precision is sufficient for sub-millisecond step and
  serialization durations?
- Should reference results live in the repository or in CI artifacts with only
  a curated baseline checked in?
- Which capacity scenario should become the first blocking regression gate
  after variance is known?

## Handoff Notes

- Read `MEMORY.md`, this document, and `archive/MEMORY_GRAVITY_PLUGIN.md` before
  implementing the first slice.
- Inspect the current ticker, metrics, sessions, HTTP broadcast, multiplayer
  runtime, gravity benchmark, and load harness; they may have changed since
  this roadmap was written.
- Preserve production plugin discovery in end-to-end measurements. Do not
  replace the external gravity provider with a static test-only implementation
  when recording the official baseline.
- Treat benchmark and metric overhead as part of the performance work. A more
  detailed metric is not an improvement if it materially increases CPU,
  allocation, or GC pressure.
