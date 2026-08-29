# WSL2 i7-7700HQ server reference baseline

The checked-in version-3 result captures commit
`a5854ff294d70286568b9f5b323ee155a60ceba2` with a clean worktree. The
production server and same-host load generator ran as separate processes on
Node v22.23.1 under Linux 6.18.33.1 WSL2 x64 on an Intel i7-7700HQ. CPU affinity
was not pinned. This is the named local reference environment, not a claim
about separate-host network capacity.

The capture ran natively in WSL2 rather than in a container. Both identities
record four physical cores, eight logical cores, a non-hybrid topology, and
Windows VBS running with HVCI disabled.

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
| Idle         |      3.76% |         100.005% |        63.8 |             12.24 ms |       0.00 ms |            0/5 |
| Typical      |      5.14% |          99.984% |        64.0 |             11.94 ms |      34.38 ms |            0/5 |
| Full game    |      6.68% |          99.995% |        65.0 |             13.40 ms |      35.46 ms |            0/5 |
| Many games   |     26.06% |          99.991% |        60.4 |             12.26 ms |      31.58 ms |            0/5 |
| High fanout  |     19.51% |         100.001% |        62.6 |             12.81 ms |      36.19 ms |            0/5 |
| Input stress |      9.70% |          99.978% |        64.6 |             12.84 ms |      34.86 ms |            0/5 |
| Warp 10      |     12.64% |         100.001% |        67.4 |             13.67 ms |      21.75 ms |            0/5 |
| Warp 60      |     43.66% |         100.000% |        67.0 |             29.57 ms |      27.33 ms |            0/5 |

All canonical workloads sustained requested simulation throughput and stable
snapshot cadence without an individually saturated repetition. Warp 60
exceeded the 16.67-millisecond event-loop warning in all five runs while
retaining throughput. No other canonical workload produced a provisional
warning or saturation reason.

## Capacity and first bottleneck

| Games | Clients | Median CPU | Simulation ratio | Snapshot Hz | Worst event-loop p99 | Worst ack p99 | Saturated runs |
| ----: | ------: | ---------: | ---------------: | ----------: | -------------------: | ------------: | -------------: |
|     1 |       8 |      5.20% |         100.006% |        64.0 |             12.03 ms |      34.26 ms |            0/5 |
|     2 |      16 |      8.77% |          99.981% |        64.4 |             12.10 ms |      33.98 ms |            0/5 |
|     4 |      32 |     15.32% |          99.980% |        64.8 |             12.45 ms |      32.63 ms |            0/5 |
|     8 |      64 |     26.20% |          99.963% |        61.2 |             13.55 ms |      33.80 ms |            0/5 |
|    16 |     128 |     38.32% |          99.965% |        62.2 |             17.97 ms |      35.03 ms |            0/5 |
|    32 |     256 |     62.87% |          99.773% |        61.0 |             13.93 ms |   13082.62 ms |            3/5 |

The last point without majority-confirmed saturation is 16 games. One of its
five repetitions crossed the event-loop warning with a 17.97-millisecond p99,
but acknowledgement latency remained below the provisional warning in every
run.

The first confirmed saturation point is 32 games. Two repetitions failed with
pending input acknowledgements and a third successful repetition missed the
59.4-Hz cadence floor, establishing the majority result. Across all five runs,
acknowledgement p99 reached 10.30–30.42 seconds and snapshot bursts were
separated by maxima of 6.71–13.85 seconds. Simulation throughput still retained
99.77–99.87% in every repetition.

The measured bottleneck is therefore HTTP/WebSocket availability and scheduling
under same-host server/load-generator contention, before authoritative
simulation throughput fails. The 32-game repetitions reported only
58.84–63.57% server CPU, so this result must not be interpreted as a pure
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

The 50-millisecond interaction warning is crossed dramatically by every
32-game repetition. This confirms it as a useful diagnostic signal but not an
agreed SLA or hard CI gate.

The repository-level `reference-baseline.json` points to this capture.
`npm run compare:server-baseline` produces non-blocking Markdown or versioned
JSON comparisons against it, including run spread and complete host identity
mismatches.
