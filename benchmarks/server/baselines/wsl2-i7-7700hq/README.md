# WSL2 i7-7700HQ server reference baseline

The checked-in version-4 result captures commit
`c657f85e7e07b766a449a0f12dce132db6c68e9e` with a clean worktree. The
production server and same-host load generator ran as separate processes on
Node v22.23.1 under Linux 6.18.33.1 WSL2 x64 on an Intel i7-7700HQ. CPU affinity
was not pinned. This is the named local reference environment, not a claim
about separate-host network capacity.

The capture ran natively in WSL2 rather than in a container. Both identities
record four physical cores, eight logical cores, a non-hybrid topology, and
Windows VBS running with HVCI disabled. Two hundred loopback `/health` probes
measured 2.62-millisecond p50 and 4.28-millisecond p99 path latency.

The production bundle was built once. Every workload used a 15-second warm-up,
a 60-second measurement, five deterministic repetitions, and a fresh server
process for every repetition. The deployed server plugin artifact hash was
`501d7efce2e1c8fb336e77be6ba5ef8fcb0962858588ff7c61f44e37efcee42c`;
the pack contained API-v11 Newtonian gravity, solar system, autopilot,
spacecraft operator, and poly-fighter plugins.

## Canonical matrix

CPU, throughput, cadence, and generator values are from the median-server-CPU
repetition. Latencies are the worst values across all successful repetitions.
Percentages are process CPU, where 100% means one fully occupied core.

| Scenario     | Server CPU | Simulation ratio | Snapshot Hz | Worst server-loop p99 | Worst ack p99 | Generator CPU | Generator saturated | Service saturated |
| ------------ | ---------: | ---------------: | ----------: | --------------------: | ------------: | ------------: | ------------------: | ----------------: |
| Idle         |      3.77% |          99.991% |        64.0 |              11.60 ms |       0.00 ms |         6.68% |                 0/5 |               0/5 |
| Typical      |      5.17% |          99.956% |        64.0 |              11.53 ms |      34.09 ms |        10.71% |                 0/5 |               0/5 |
| Full game    |      6.62% |          99.998% |        64.8 |              12.30 ms |      26.55 ms |        18.18% |                 0/5 |               0/5 |
| Many games   |     25.66% |          99.971% |        60.4 |              12.02 ms |      30.90 ms |        42.85% |                 0/5 |               0/5 |
| High fanout  |     19.52% |          99.976% |        61.8 |              13.64 ms |      35.98 ms |        53.87% |                 2/5 |               0/5 |
| Input stress |      9.58% |         100.002% |        64.8 |              12.65 ms |      33.58 ms |        18.91% |                 0/5 |               0/5 |
| Warp 10      |     12.61% |         100.000% |        67.0 |              13.06 ms |      22.30 ms |        18.39% |                 0/5 |               0/5 |
| Warp 60      |     43.33% |         100.000% |        67.4 |              27.28 ms |      26.56 ms |        17.87% |                 0/5 |               0/5 |

All canonical workloads sustained requested simulation throughput and stable
snapshot cadence without an individually saturated repetition. Warp 60
exceeded the 16.67-millisecond event-loop warning in all five runs while
retaining throughput. No other canonical workload produced a provisional
service warning or saturation reason. Two high-fanout runs produced isolated
generator event-loop warnings, below majority confirmation.

## Capacity and first bottleneck

| Games | Clients | Server CPU | Simulation ratio | Snapshot Hz | Worst server-loop p99 | Worst ack p99 | Generator CPU | Generator saturated | Service saturated |
| ----: | ------: | ---------: | ---------------: | ----------: | --------------------: | ------------: | ------------: | ------------------: | ----------------: |
|     1 |       8 |      5.15% |          99.994% |        64.0 |              11.56 ms |      32.64 ms |        10.76% |                 0/5 |               0/5 |
|     2 |      16 |      8.48% |          99.979% |        64.2 |              11.68 ms |      33.99 ms |        15.52% |                 0/5 |               0/5 |
|     4 |      32 |     14.91% |          99.986% |        64.8 |              12.32 ms |      33.49 ms |        25.22% |                 0/5 |               0/5 |
|     8 |      64 |     25.71% |          99.951% |        60.0 |              11.81 ms |      32.43 ms |        42.66% |                 1/5 |               0/5 |
|    16 |     128 |     38.32% |          99.973% |        62.2 |              21.59 ms |     137.13 ms |        69.37% |                 5/5 |               0/5 |
|    32 |     256 |     62.21% |          99.765% |        59.0 |              12.73 ms |    8891.53 ms |       102.50% |                 3/5 |               4/5 |

The last point without majority-confirmed service saturation is 16 games, but
the generator is already compromised there: all five repetitions exceeded its
event-loop threshold, with generator event-loop p99 from 28.07 to 346.29
milliseconds. Generator CPU p50 remained 68.30–69.66%, server simulation and
cadence stayed healthy, and no run failed. Eight games is the last capacity
point without a majority generator warning.

The first confirmed service saturation point is 32 games. Two repetitions
failed their metrics request, one ended with 98 pending acknowledgements, and a
fourth missed the 59.4-Hz cadence floor. Every run whose generator monitor
started used about 103% generator CPU and reported a 6.29–6.52-second generator
event-loop p99. Acknowledgement p99 reached 8.17–10.12 seconds, while server
simulation throughput retained 99.76–99.87%.

The measured bottleneck is therefore the same-host load generator's JavaScript
event loop, now observed directly rather than inferred from healthy server
metrics. It saturates before authoritative simulation throughput fails, so the
32-game point must not be interpreted as a server CPU ceiling. Separate-host
results remain a distinct environment and are required for a deployment
capacity claim.

## Provisional warnings

The checked-in result records these non-blocking thresholds:

- simulation throughput below 99% or snapshot cadence below 59.4 Hz is a
  saturation signal;
- event-loop p99 above 16.67 milliseconds is an early warning;
- the measured loopback path offsets input-acknowledgement p99 to 54.28
  milliseconds and snapshot-inter-arrival p99 to 51.66 milliseconds; these are
  diagnostic warnings, not agreed interaction budgets;
- heap growth requires the final-third median to exceed the first-third median
  by both a positive trend and at least 8 MiB or 5%. Majority confirmation
  prevents a normal GC sawtooth endpoint from becoming a saturation point.

The path-adjusted acknowledgement warning is crossed at 16 games and
dramatically at 32. This confirms it as a useful diagnostic signal but not an
agreed SLA or hard CI gate.

The repository-level `reference-baseline.json` points to this capture.
`npm run compare:server-baseline` produces non-blocking Markdown or versioned
JSON comparisons against it, including run spread and complete host identity
mismatches.
