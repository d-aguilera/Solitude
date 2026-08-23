# WSL2 i7-7700HQ server reference baseline

The checked-in version-1 result captures commit
`3e0245ae5cb67763ab5bb93528d0269bd35fa91d` with a clean worktree. The
production server and same-host load generator ran as separate processes on
Node v22.22.3 under Linux 6.18.33.1 WSL2 x64 on an Intel i7-7700HQ. CPU affinity
was not pinned. This is the named local reference environment, not a claim
about separate-host network capacity.

The production bundle was built once. Every workload used a 15-second warm-up,
a 60-second measurement, five deterministic repetitions, and a fresh server
process for every repetition. The deployed server plugin artifact hash was
`501d7efce2e1c8fb336e77be6ba5ef8fcb0962858588ff7c61f44e37efcee42c`;
the pack contained API-v11 Newtonian gravity, solar system, autopilot,
spacecraft operator, and poly-fighter plugins.

## Canonical matrix

CPU, throughput, and cadence are from the median-CPU repetition. Latencies are
the worst values across all five repetitions. Percentages are process CPU as
reported by the production server, not whole-machine utilization.

| Scenario     | Median CPU | Simulation ratio | Snapshot Hz | Worst event-loop p99 | Worst ack p99 | Saturated runs |
| ------------ | ---------: | ---------------: | ----------: | -------------------: | ------------: | -------------: |
| Idle         |      3.85% |          99.984% |        63.8 |             13.02 ms |       0.00 ms |            0/5 |
| Typical      |      5.09% |          99.989% |        64.4 |             11.76 ms |      34.25 ms |            0/5 |
| Full game    |      6.57% |          99.996% |        64.6 |             12.27 ms |      28.28 ms |            0/5 |
| Many games   |     26.78% |         100.003% |        60.4 |             11.79 ms |      34.17 ms |            0/5 |
| High fanout  |     20.28% |          99.975% |        63.0 |             16.71 ms |     100.43 ms |            0/5 |
| Input stress |      9.78% |          99.997% |        65.0 |             13.02 ms |      33.55 ms |            0/5 |
| Warp 10      |     12.70% |          99.998% |        66.6 |             13.84 ms |      21.65 ms |            0/5 |
| Warp 60      |     43.70% |         100.000% |        67.0 |             20.73 ms |      26.20 ms |            0/5 |

All canonical workloads sustained requested simulation throughput and stable
snapshot cadence. Warp 60 exceeded the 16.67-millisecond event-loop warning in
all five runs while retaining throughput and bounded backlog. High fanout
produced two acknowledgement-p99 warnings over 50 milliseconds, including one
100.43-millisecond outlier, and one event-loop warning. These remain warnings,
not interaction SLAs or hard gates.

## Capacity and first bottleneck

| Games | Clients | Median CPU | Simulation ratio | Snapshot Hz | Worst event-loop p99 | Worst ack p99 | Saturated runs |
| ----: | ------: | ---------: | ---------------: | ----------: | -------------------: | ------------: | -------------: |
|     1 |       8 |      5.10% |         100.002% |        64.0 |             12.26 ms |      23.98 ms |            0/5 |
|     2 |      16 |      8.57% |         100.012% |        64.6 |             12.25 ms |      33.90 ms |            0/5 |
|     4 |      32 |     15.36% |         100.000% |        64.6 |             16.24 ms |      33.68 ms |            0/5 |
|     8 |      64 |     26.95% |          99.959% |        60.2 |             13.91 ms |      33.78 ms |            0/5 |
|    16 |     128 |     39.88% |          99.973% |        62.4 |             14.55 ms |      34.50 ms |            0/5 |
|    32 |     256 |     65.81% |          99.902% |        58.6 |             39.03 ms |    1666.67 ms |            5/5 |

The last confirmed healthy point is 16 games. The first confirmed saturation
point is 32 games: every run missed the 59.4-Hz cadence floor, event-loop p99
rose to 28.33–39.03 milliseconds, and acknowledgement p99 rose to
0.90–1.67 seconds. Snapshot arrivals became bursty; the worst inter-arrival
p99 was 838.92 milliseconds. Simulation throughput nevertheless remained
99.90–99.95% and backlog did not grow.

The measured bottleneck is therefore scheduling/JSON WebSocket fanout under
same-host server/load-generator contention, before authoritative simulation
throughput fails. The server's own median CPU was only 65.46–66.51%, so this
result must not be interpreted as a pure server CPU ceiling. A separate-host
load generator and whole-machine CPU telemetry are the next steps for a
serious deployment capacity claim.

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

The 50-millisecond interaction warnings sit above the 34.50-millisecond worst
ack p99 and 32.61-millisecond worst inter-arrival p99 through the last healthy
capacity point. High fanout demonstrates that these metrics still have
outliers, so no baseline metric is a hard CI gate yet.
