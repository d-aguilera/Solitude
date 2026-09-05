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
- `scripts/run-server-load.mjs` creates independent authoritative games and
  participant sets, applies seeded input and simulation rate, separates warm-up
  and measurement, repeats phases, polls `/metrics`, and always records
  input-acknowledgement and snapshot-inter-arrival latency. It emits one
  versioned environment/scenario/result document to stdout and optionally a
  file; quiet mode suppresses stderr progress.
- `packages/server/src/metrics.ts` reports rolling per-game entity count,
  snapshot cadence, payload/wire bytes, and snapshot step/serialization
  average, p50, p95, p99, and maximum durations. Hot-path samples use fixed
  rotating typed-array aggregates rather than allocating one timed object per
  observation; sub-5-millisecond histogram buckets have 0.01-millisecond
  resolution.
- Server duration measurements use monotonic `performance.now()` clocks.
  Authoritative input receipt and ticker input windows share the same monotonic
  clock origin; protocol wall-clock semantics are unchanged.
- `/metrics` reports process CPU user/system/total time and utilization over
  the interval since the previous report; heap used/total, RSS, external, and
  array-buffer memory; and event-loop delay average/p50/p95/p99/max. The
  event-loop monitor uses Node's 10-millisecond sampling resolution and is
  closed with the HTTP runtime.
- The authoritative ticker records requested simulation milliseconds,
  completed fixed steps and simulation milliseconds, full broadcast-loop
  duration (including snapshot serialization/fanout), and observable backlog
  after each callback. Per-game reports expose requested and achieved
  simulation milliseconds per wall-clock second, steps per second, the
  achieved/requested throughput ratio, and current backlog.
- `benchmarks/server/scenarios.json` defines the canonical matrix and initial
  game-count capacity sweep. `benchmarks/server/result-schema.json` defines the
  stable required version-1 result shape, and the sibling README documents
  local and official run protocols.
- `npm run bench:server-authoritative` builds and discovers the production
  server plugin set, then benchmarks real in-process multiplayer composition.
  It separates simulation plus runtime snapshot capture from compact snapshot
  encoding and covers 1/8/16 controlled entities, 1/4/8 independent
  eight-player games, typical/input-stress event rates, and 1x/10x/60x
  fixed-step workloads.
- `npm run baseline:server` builds the production server once, restarts it for
  every repetition, runs the canonical matrix and doubling capacity sweep, and
  persists a compact versioned baseline after every scenario. Reference
  defaults enforce the 15-second warm-up, 60-second measurement, and five-run
  protocol; the smoke profile remains explicitly non-reference.
- The current `wsl2-i7-7700hq` same-host regression reference is the version-4
  `f32841e` capture, recorded on 2026-09-05 with the current snapshot fast path.
  It covers all eight canonical scenarios, with capacity intentionally skipped.
  All 40 fresh-server repetitions completed with no failed run, dropped metrics
  sample, or generator saturation. The loopback path measured 2.65 ms p50 and
  4.95 ms p99. Server and plugin artifact hashes match both earlier references;
  this refresh measures the updated harness, not a new server implementation.
  Seven scenarios have no saturation or service warnings. Warp 60 retains
  healthy throughput and cadence but is classified as saturated in three of
  five repetitions solely by `simulation-backlog-growing`; all five also warn
  on event-loop p99 (worst 18.78 ms). The flagged backlog endpoint increases
  are 25.09-40.12 simulated milliseconds with positive full-window slopes.
  Preserve that verdict as an unresolved diagnostic finding rather than
  treating this capture as an all-clear. The capture contains no capacity
  evidence; the separate-host `e58dec4` reference remains selected for capacity.
- The historical `wsl2-i7-7700hq` result is retained under
  `benchmarks/server/baselines/`. It records both complete host identities, the
  exact production plugin and server artifact identities, stable trend
  evidence, median-CPU repetition, worst p95/p99 latencies, and
  majority-confirmed saturation analysis. The version-4 `c657f85` capture ran
  natively in WSL2 with no container present, measured the loopback path at
  2.62 ms p50 and 4.28 ms p99, and sustained every canonical workload. Its
  generator telemetry shows repeatable generator event-loop starvation from 16
  games and full generator CPU saturation at 32. No capacity point reaches
  confirmed service saturation: 32 games is inconclusive, with only two valid
  repetitions of five and those split one-to-one. The earlier "confirmed
  saturation at 32 games" counted three failed metrics requests as saturation
  votes.
- The separate-host `e58dec4` capacity reference is checked in beside the
  same-host one. It ran the load generator on a wired-gigabit Windows 11 host
  against the WSL2 server behind a portproxy relay, measured that path at
  6.04 ms p50 and 9.90 ms p99, and completed all 75 repetitions with no failed
  run and no dropped metrics sample. Every canonical workload and the whole
  1-to-24-game sweep sustained requested throughput with no confirmed
  saturation, so `firstCapacitySaturation` is null.
- Measured capacity scaling is close to linear and reproduces across
  independent captures. Server CPU p50 runs 24% at 8 games, 43% at 16, 55% at
  20 and 68% at 24; snapshot cadence declines 62.7, 62.2, 61.8, 60.2 Hz over
  the same points; worst acknowledgement p99 rises 39.2 to 46.4 ms against a
  59.9 ms path-adjusted budget, and the generator reaches 51% of one core. A
  separate two-point probe measured 69% CPU, 60.2 Hz and 46.0 ms at 24 games,
  within noise of the reference.
- 24 games is the honest end of this path, and the reason is that three limits
  converge. Extrapolating the reference's own slopes, cadence crosses its
  59.4 Hz floor near 27 games, aggregate fanout of 26.0 Mbit/s per game reaches
  the relay's roughly 753 Mbit/s near 29 games, and server CPU would not
  saturate until about 34. The first service threshold and the link ceiling sit
  within two games of each other, so a capture past 24 could not attribute a
  breach to the server rather than the network. Establishing true server
  capacity needs more link headroom, not a longer sweep.
- Event-loop p99 warnings become persistent before anything saturates: all five
  warp-60 repetitions, one of five at 16 games, and four of five at 24.
- The separate-host restart mechanism is SSH into the server's WSL, running a
  script that spawns a fresh server process and exits immediately. It is
  deliberately outside the measured artifact: an HTTP restart endpoint would
  change `dist/server/main.js` and its recorded SHA, and a process cannot
  restart itself cleanly anyway, so an external supervisor is required either
  way. `benchmarks/server/README.md` documents the portproxy and firewall
  setup, the script's three failure modes, and the fact that capturing server
  metadata over that SSH connection silently degrades host facts to `null`
  unless `WSL_INTEROP` and the Windows directories are exported.
- The capacity sweep doubles only because doubling brackets an unknown
  saturation point cheaply. `--capacity-games` runs an explicit list instead,
  for refining a bracket once one end is known. On the separate-host path the
  useful range above 16 games is 20 and 24: measured per-game fanout is
  26.7 Mbit/s, so 24 games is about 85% of the relay's 753 Mbit/s and 28 games
  is already at 99%.
- `benchmarks/server/reference-baseline.json` is a version-2 pointer holding one
  reference per measurement topology. `same-host-loopback` is the regression
  reference and `separate-host-lan` is the capacity reference; a candidate is
  matched to its own `environment.topology` and never silently falls back to a
  differently-measured baseline. Aggregate snapshot fanout is roughly
  `games x per-game wire bytes`, about 430 Mbit/s at 16 eight-client games and
  830 Mbit/s at 32, so a LAN capacity capture needs wired gigabit at minimum
  and ordinary Wi-Fi saturates before the server does.
- `npm run compare:server-baseline` compares a candidate with the selected
  reference pointer and emits Markdown or versioned JSON. It reports absolute
  and percentage deltas, min/p50/p95/max repetition spread, workload coverage,
  saturation changes, and machine/runtime/plugin/protocol/analysis identity
  mismatches without enforcing performance gates.
- `npm run baseline:server:remote` runs the same matrix and capacity protocol
  against an explicit HTTP(S) server URL. It supports a manual restart
  checkpoint or an unattended restart command before every repetition, waits
  for `/health`, and records server and load-generator identities separately.
- `npm run baseline:server-metadata` captures the production server bundle and
  plugin artifact identity plus the server machine/runtime metadata consumed by
  remote baseline runs. Orchestration lives in `scripts/run-server-baseline.mjs`
  with `scripts/capture-server-baseline-metadata.mjs`,
  `scripts/server-baseline-environment.mjs` (shared host identity capture), and
  `scripts/compare-server-baselines.mjs`; the in-process benchmark is
  `packages/multiplayer/src/__benchmarks__/authoritative.bench.ts`.
- Load-generator and server identities additionally record `cpuTopology` and
  `virtualization`, because core layout and an active hypervisor change latency
  spread without changing any previously captured identity field. Hybrid
  performance/efficiency layout is derived from host physical versus logical
  core counts, guest-visible cores are retained separately from host cores, and
  virtualization-based security including hypervisor-enforced code integrity is
  read through one bounded best-effort Windows probe that never fails a run.
  Version-3 server metadata and version-4 baseline documents also require
  `container`, which records container presence, engine, and devcontainer
  status. All three fields are required and preserve explicit `null` values
  where host-only facts cannot be resolved. A containerized capture cannot
  reach Windows host facts at all, so devcontainer runs record null
  topology/VBS by construction.
- Every load run records a `generator` block with the load generator's own CPU
  utilization, event-loop delay, and RSS, plus a `generatorSaturation` verdict
  at 85% of one fully occupied core or a worst sampled 16.67-millisecond
  event-loop p99. The load generator's JavaScript work runs on one event-loop
  thread, so multiplying its CPU ceiling by host logical cores would hide the
  exact starvation this verdict needs to expose. Acknowledgement latency is
  measured inside the generator process, so its event-loop delay bounds the
  latency it can resolve. This disambiguates a saturated server from a starved
  generator, which same-host capacity runs could not previously distinguish.
- Baseline runs probe `/health` 200 times against the live server before the
  first repetition and record `environment.pathLatencyMillis`. Client-observed
  warnings are offset by it: acknowledgement latency by the full path p99, and
  snapshot inter-arrival by path jitter only, since constant latency shifts
  arrivals without changing spacing. Server-side thresholds are never adjusted
  because event-loop delay, throughput, backlog, and cadence are measured inside
  the server process and stay comparable across topologies. The effective
  thresholds are persisted per capture.
- The separate-host path to `wsl2-i7-7700hq` is measured, not assumed. Its
  Windows 10 build 19045 cannot run WSL mirrored networking, so the server sits
  behind a `netsh portproxy` relay into WSL NAT. Measured on wired gigabit:
  913 Mbit/s direct by SMB versus 753 Mbit/s through the relay, an 18% cost;
  round-trip p50 rises from a 2 ms host-to-host ICMP floor to 7.7 ms idle and
  9.7 ms under load, with p99 near 13 ms loaded. Aggregate fanout therefore
  caps the usable sweep at 16 eight-client games on that path.
- The load generator fast-paths snapshots: a byte-prefix check identifies the
  wire-shaped snapshot envelope and a bounded scan extracts only the
  `lastProcessedInputSequences` map. Control messages take the full parse; a
  snapshot reaching the full parse hard-aborts the run rather than silently
  reverting the harness to its old cost profile. This removed the dominant
  generator cost (parsing
  and discarding every entity in every snapshot across all sockets) that the
  `c657f85` reference measured as generator starvation from 16 games.
- The server does not yet expose GC counts/pause time.
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

Status: complete in `Server performance baseline 2`.

- Replace duration measurement based on `Date.now()` with a monotonic
  high-resolution clock.
- Replace per-sample timed-object windows on hot paths with bounded reusable
  aggregation suitable for percentiles.
- Add p50/p99/max alongside existing average/p95 values.
- Add process CPU, complete memory categories, and event-loop delay.
- Add tests using injected clocks and deterministic samples.
- Measure instrumentation overhead before and after the change.

### Slice 2: achieved throughput and backlog

Status: complete in `Server performance baseline 3`.

- Instrument requested simulation advancement, completed steps, completed
  simulation milliseconds, broadcast-loop duration, and remaining accumulated
  simulation time.
- Expose achieved/requested ratios and `simulationBacklogMillis` per game.
- Ensure ticker behavior remains unchanged; this slice observes rather than
  changes catch-up policy.
- Add deterministic ticker tests covering normal load, delayed callbacks,
  high simulation rates, and growing backlog.

### Slice 3: multi-game structured load harness

Status: complete in `Server performance baseline 4`.

- Add multiple games and clients-per-game support.
- Separate warm-up and measured phases.
- Add repetitions, deterministic input seeds, simulation-rate configuration,
  quiet operation, and versioned JSON output.
- Aggregate server metrics and client-observed acknowledgement/inter-arrival
  latency without printing every poll.
- Detect incomplete joins, dropped sockets, pending acknowledgements, and
  premature server failure as failed runs.

### Slice 4: in-process authoritative benchmark

Status: complete in `Server performance baseline 5`.

- Benchmark real multiplayer composition and discovered server plugins without
  HTTP/WebSocket scheduling noise.
- Cover representative entity counts, concurrent independent games, input
  rates, and simulation rates.
- Report simulation plus snapshot-capture/encoding cost separately where
  feasible without changing runtime behavior.
- Keep `npm run bench:gravity` as the narrower provider-specific signal.

### Slice 5: capture the reference baseline

Status: complete in `Server performance baseline 7`.

- Select and name the reference machine/environment.
- Run the canonical matrix and capacity sweep against the production bundle.
- Check in the scenario definitions and one versioned reference result.
- Document the first observed bottleneck and saturation point using measured
  evidence.
- Set provisional warning thresholds based on observed variance and headroom.

### Slice 6: regression reporting and gates

Status: complete in `Server performance baseline 8`; reporting is implemented
and gate promotion remains intentionally deferred pending repeated controlled
captures and agreed budgets.

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

## Completed Slice Notes

- Slice 1 replaced `Date.now()` duration timing and unbounded timed-object
  arrays with monotonic clocks and fixed rotating typed-array windows. Duration
  percentiles are calculated from reusable bounded histograms only when a
  report is requested.
- `npm run bench:server-metrics` retains the former timed-object recorder as a
  benchmark comparison. On the development environment, the production
  recorder handled the representative combined step/broadcast recording path
  about 22x faster; benchmark values are environment-dependent.
- Event-loop delay monitoring is enabled for production metrics at Node's
  10-millisecond resolution. GC observation remains deferred because it is
  more diagnostic and its overhead still needs explicit evaluation.
- Slice 2 observes ticker throughput and saturation without changing its
  synchronous catch-up policy. Backlog includes both the fixed-step remainder
  and simulation time requested by wall time consumed inside the current
  broadcast callback, so overload is visible even though each callback drains
  all work accumulated at its start.
- Deterministic ticker tests cover delayed callbacks, 60x simulation rate, and
  a synthetic overload whose backlog grows across callbacks. The expanded
  `npm run bench:server-metrics` recorder path remained about 32x faster than
  equivalent timed-object windows on the development environment.
- Slice 3 supports `--games`, `--clients-per-game`, `--input-hz`, `--sim-rate`,
  `--warmup`, `--duration`, `--repetitions`, `--seed`, `--output`, and `--quiet`.
  The legacy `--clients` and `--latency` options remain accepted; latency is now
  always collected.
- Each result records commit/dirty state, Node, platform, CPU, server-build
  label, scenario, raw server samples, per-game/server/client summaries, and
  run errors. Missing joins/games/snapshots, stopped games, closed sockets,
  metrics failures, and pending acknowledgements cause nonzero completion.
- A production-bundle smoke run with two games, two clients per game, seeded
  input, and two repetitions completed with zero pending acknowledgements and
  no run errors. This is functional evidence only, not a reference performance
  result.
- Slice 4 uses the same local plugin-set discovery as the production server;
  there is no static benchmark-only gravity or content implementation. Direct
  game cases isolate simulation plus reusable runtime snapshot capture, compact
  encoding cases isolate the allocation-producing protocol representation,
  and session cases include input processing plus both layers.
- Representative development-machine results scaled eight independent
  eight-player games to about 8.1x the cost of one. The sixteen-player 10x and
  60x session workloads cost about 9.5x and 63.7x the 1x workload. Values are
  environment-dependent and establish harness behavior, not a reference
  baseline or performance budget.
- Slice 5 names `wsl2-i7-7700hq` as the same-host local reference environment.
  Its version-4 capture at `c657f85` used Node v22.23.1, a
  15-second warm-up, 60-second measurement, five fresh-server repetitions, and
  the deployed API-v11 content pack for every workload. It ran natively in WSL2
  with no container present; both identities record four physical cores, eight
  logical cores, VBS running, and HVCI disabled. The 200-probe loopback path
  measured 2.62 ms p50 and 4.28 ms p99.
- All canonical workloads sustained requested simulation throughput. Warp 60
  exceeded the provisional 16.67-millisecond event-loop warning in all five
  runs, but no canonical repetition saturated. No other canonical service
  workload warned; two high-fanout repetitions had isolated generator warnings
  below majority confirmation.
- The capacity sweep's last point without majority-confirmed saturation was 16
  eight-client games. All five 16-game runs showed generator event-loop
  starvation despite healthy service thresholds, so 8 games is the last point
  without a generator warning. At 32 games two repetitions failed their metrics
  request, one ended with pending acknowledgements, and another missed the
  cadence floor. Every measured generator run used about 103% CPU and stalled
  for 6.29–6.52 seconds while server simulation throughput remained
  99.76–99.87%. The first bottleneck is now directly measured as same-host load
  generator starvation, not authoritative simulation throughput; separate-host
  validation is required for a deployment capacity claim.
- A run that fails for transport or harness reasons is invalid, not saturated.
  Saturation is voted only among repetitions that produced data, and a workload
  whose valid repetitions do not form a majority is recorded `inconclusive`
  rather than healthy or saturated. Counting failures as saturation votes
  previously manufactured findings at both same-host 32 games and separate-host
  1 game. `scripts/reanalyze-server-baseline.mjs` re-derives stored verdicts
  when analysis policy changes, leaving raw run data untouched.
- Metrics polling is sampling, so a lost poll costs one observation rather than
  the whole repetition. Boundary fetches bounding the measurement window are
  retried; sampling fetches are never retried, because a retry would perturb
  the cadence being measured. Losses are recorded per run as
  `droppedMetricsSamples`, and a run fails only above a 10% loss ratio. The
  separate-host path drops roughly 0.1% of metrics requests under load
  (`UND_ERR_SOCKET` through the portproxy relay), which previously voided about
  18% of repetitions because one lost poll aborted a 60-second run.
- Base non-blocking warnings are 16.67 milliseconds for event-loop p99 and 50
  milliseconds for input-ack or snapshot-inter-arrival p99. Measured path cost
  adjusts the client thresholds; this capture records 54.28 milliseconds for
  acknowledgement p99 and 51.66 for snapshot inter-arrival p99. Heap growth
  compares first-third and final-third medians with a positive full-window
  slope and an 8-MiB-or-5% minimum; majority confirmation rejects normal GC
  sawtooth endpoint variance. No hard CI gates were introduced.
- Slice 6 adds a stable reference pointer plus a comparison CLI with Markdown
  and JSON output. Nineteen representative process, simulation, memory,
  transport, and latency metrics per compatible workload include absolute and
  percentage deltas and min/p50/p95/max spread across successful repetitions.
- Comparisons expose missing or scenario-incompatible workloads, first-capacity
  saturation changes, dirty state, and machine, runtime, plugin artifact,
  protocol, and analysis-policy mismatches. Metric and environment findings are
  non-blocking; only invalid input or I/O failure exits nonzero.
- All six planned server-performance baseline slices are complete. Hard gate
  promotion is not a remaining implementation slice: it requires additional
  controlled captures to establish variance and explicit product budgets.
- The post-roadmap separate-host extension adds remote baseline orchestration.
  Remote runs require captured server metadata, default to an interactive
  fresh-server checkpoint before every repetition, and may instead execute an
  explicit restart command for unattended LAN or hosted-machine measurements.

## Roadmap Status

All planned slices and the separate-host orchestration extension are complete.
Future performance work should collect controlled local and separate-host
candidate captures, use the non-blocking comparator to establish normal
variance, and only then propose explicit blocking gates.

## Open Questions

- Which input-acknowledgement latency constitutes the initial interaction
  budget?
- Should GC diagnostics be enabled by a server environment flag or only by a
  benchmark launcher option?
- What bounded histogram precision is sufficient for sub-millisecond step and
  serialization durations?
- Which capacity scenario should become the first blocking regression gate
  after variance is known?

## Handoff Notes

- Read `MEMORY.md`, this document, and `archive/MEMORY_GRAVITY_PLUGIN.md` before
  implementing the first slice.
- Inspect the current ticker, metrics, sessions, HTTP broadcast, multiplayer
  runtime, metrics/gravity benchmarks, and load harness; they may have changed
  since this roadmap was written.
- Preserve production plugin discovery in end-to-end measurements. Do not
  replace the external gravity provider with a static test-only implementation
  when recording the official baseline.
- Treat benchmark and metric overhead as part of the performance work. A more
  detailed metric is not an improvement if it materially increases CPU,
  allocation, or GC pressure.
