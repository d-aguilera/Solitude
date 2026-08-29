# WSL2 i7-7700HQ server reference baseline

The checked-in version-2 result captures commit
`ab1493636198e2d18787a8747c09ff2966fd9468` with a clean worktree. The
production server and same-host load generator ran as separate processes on
Node v22.22.3 under Linux 6.18.33.1 WSL2 x64 on an Intel i7-7700HQ. CPU affinity
was not pinned. This is the named local reference environment, not a claim
about separate-host network capacity.

Both identities saw eight logical cores. The devcontainer could identify the
WSL2 hypervisor but could not directly query Windows host topology or VBS, so
`physicalCores`, `hybrid`, and `vbs` are explicitly `null`.

The production bundle was built once. Every workload used a 15-second warm-up,
a 60-second measurement, five deterministic repetitions, and a fresh server
process for every repetition. The deployed server plugin artifact hash was
`501d7efce2e1c8fb336e77be6ba5ef8fcb0962858588ff7c61f44e37efcee42c`;
the pack contained API-v11 Newtonian gravity, solar system, autopilot,
spacecraft operator, and poly-fighter plugins.

## Canonical matrix

CPU, throughput, and cadence are from the median-CPU repetition. Latencies are
the worst values across all successful repetitions. Percentages are process CPU
as reported by the production server, not whole-machine utilization.

| Scenario     | Median CPU | Simulation ratio | Snapshot Hz | Worst event-loop p99 | Worst ack p99 | Saturated runs |
| ------------ | ---------: | ---------------: | ----------: | -------------------: | ------------: | -------------: |
| Idle         |      3.86% |          99.966% |        65.2 |             11.93 ms |       0.00 ms |            0/5 |
| Typical      |      5.25% |          99.972% |        64.2 |             12.07 ms |      34.25 ms |            0/5 |
| Full game    |      6.80% |          99.994% |        65.2 |             12.54 ms |      33.14 ms |            0/5 |
| Many games   |     25.81% |          99.990% |        60.2 |             12.69 ms |      30.65 ms |            0/5 |
| High fanout  |     19.73% |          99.948% |        62.6 |             12.84 ms |      36.76 ms |            0/5 |
| Input stress |      9.81% |         100.003% |        65.2 |             12.87 ms |      35.37 ms |            0/5 |
| Warp 10      |     12.84% |         100.000% |        66.6 |             14.53 ms |      22.07 ms |            0/5 |
| Warp 60      |     43.57% |         100.000% |        67.0 |             29.88 ms |      27.33 ms |            1/5 |

All canonical workloads sustained requested simulation throughput and stable
snapshot cadence. Warp 60 exceeded the 16.67-millisecond event-loop warning in
all five runs while retaining throughput; one repetition was individually
classified as saturated because its measured backlog grew, which did not meet
the majority-confirmation rule. No other canonical workload produced a
provisional warning or saturation reason.

## Capacity and first bottleneck

| Games | Clients | Median CPU | Simulation ratio | Snapshot Hz | Worst event-loop p99 | Worst ack p99 | Saturated runs |
| ----: | ------: | ---------: | ---------------: | ----------: | -------------------: | ------------: | -------------: |
|     1 |       8 |      5.21% |          99.991% |        64.0 |             11.99 ms |      34.26 ms |            0/5 |
|     2 |      16 |      8.96% |          99.972% |        64.6 |             11.95 ms |      34.24 ms |            0/5 |
|     4 |      32 |     15.16% |          99.977% |        65.0 |             12.07 ms |      31.90 ms |            0/5 |
|     8 |      64 |     25.95% |          99.974% |        60.4 |             14.97 ms |      34.41 ms |            0/5 |
|    16 |     128 |     37.79% |          99.923% |        62.4 |             33.62 ms |     520.21 ms |            0/5 |
|    32 |     256 |     62.76% |          99.824% |        59.6 |             13.21 ms |    9658.52 ms |            4/5 |

The last point without majority-confirmed saturation is 16 games. One of its
five repetitions produced a 33.62-millisecond event-loop p99 and a
520.21-millisecond acknowledgement p99, so service-quality tail warnings appear
before the formal saturation boundary.

The first confirmed saturation point is 32 games. Three repetitions failed
because the metrics request could not complete after workload creation. Of the
two successful repetitions, one missed the 59.4-Hz cadence floor; both had
8.71–9.66-second acknowledgement p99 and snapshot bursts separated by maxima
over 6.5 seconds. These four saturated or failed repetitions establish the
majority result. Their successful measurements still retained 99.82–99.90%
simulation throughput.

The measured bottleneck is therefore HTTP/WebSocket availability and scheduling
under same-host server/load-generator contention, before authoritative
simulation throughput fails. The two successful 32-game repetitions reported
only 62.76–62.94% server CPU, so this result must not be interpreted as a pure
server CPU ceiling. Separate-host results remain a distinct environment and are
required for a deployment capacity claim.

## Provisional warnings

The checked-in result records these non-blocking thresholds:

- simulation throughput below 99% or snapshot cadence below 59.4 Hz is a
  saturation signal;
- event-loop p99 above 16.67 milliseconds is an early warning;
- input-acknowledgement or snapshot-inter-arrival p99 above 50 milliseconds is
  a diagnostic warning, not an agreed interaction budget;
- heap growth requires the final-third median to exceed the first-third median
  by both a positive trend and at least 8 MiB or 5%. Majority confirmation
  prevents a normal GC sawtooth endpoint from becoming a saturation point.

The 50-millisecond interaction warning is crossed by one 16-game repetition and
dramatically at 32 games. This confirms it as a useful diagnostic signal but
not an agreed SLA or hard CI gate.

The repository-level `reference-baseline.json` points to this capture.
`npm run compare:server-baseline` produces non-blocking Markdown or versioned
JSON comparisons against it, including run spread and complete host identity
mismatches.
