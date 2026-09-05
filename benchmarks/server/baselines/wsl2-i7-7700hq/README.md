# WSL2 i7-7700HQ server reference baselines

`../../reference-baseline.json` selects one capture per measurement topology:

| Purpose    | Topology             | Capture                                                    | Coverage                                             |
| ---------- | -------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Regression | `same-host-loopback` | [f32841e](./f32841ef8411e6aa37dedca42e7130bf265e5516.json) | Eight canonical scenarios; capacity skipped          |
| Capacity   | `separate-host-lan`  | [e58dec4](./e58dec471b9ecb73e2e52deab937f25f376ac3a1.json) | Eight canonical scenarios and 1/2/4/8/16/20/24 games |

The older [c657f85](./c657f85e7e07b766a449a0f12dce132db6c68e9e.json)
capture is retained as historical evidence from before the load-generator
snapshot fast path. It is no longer the selected regression reference.

## Current same-host regression capture

The version-4 `f32841e` capture ran on 2026-09-05 from a clean worktree. The
production server and load generator ran as separate processes on Node
v22.23.1 under Linux 6.18.33.1 WSL2 x64 on an Intel i7-7700HQ. CPU affinity
was not pinned. Neither process ran in a container. Both identities record
four physical cores, eight logical cores, non-hybrid topology, Windows VBS
running, and HVCI disabled.

The production bundle was built once. Every workload used a 15-second warm-up,
60-second measurement, five deterministic repetitions, and a fresh server
process for every repetition. All 40 repetitions completed without errors,
dropped metrics samples, pending input acknowledgements, or generator
saturation. Two hundred loopback `/health` probes measured 2.65 ms p50 and
4.95 ms p99.

The server artifact hash is
`434574ad2405448025941b4a8998c14b1892e47e4be98df70509a6df33c9eeff`;
the plugin artifact hash is
`501d7efce2e1c8fb336e77be6ba5ef8fcb0962858588ff7c61f44e37efcee42c`.
Both match the historical local and selected LAN captures. The pack contains
API-v11 Newtonian gravity, solar system, autopilot, spacecraft operator, and
poly-fighter plugins. Differences from `c657f85` therefore include the changed
load-generator cost and run variability, not a changed server artifact.

CPU, throughput, cadence, and generator CPU below are p50 values from the
median-server-CPU repetition. Latencies are the worst p99 across successful
repetitions. CPU percentages are process CPU: 100% means one fully occupied core.

| Scenario     | Server CPU | Simulation ratio | Snapshot Hz | Worst server-loop p99 | Worst ack p99 | Generator CPU | Service saturated |
| ------------ | ---------: | ---------------: | ----------: | --------------------: | ------------: | ------------: | ----------------: |
| Idle         |      3.33% |         100.029% |        63.4 |              11.09 ms |       0.00 ms |         5.52% |               0/5 |
| Typical      |      4.43% |         100.033% |        63.8 |              11.22 ms |      26.11 ms |         6.67% |               0/5 |
| Full game    |      5.72% |         100.019% |        64.8 |              11.78 ms |      34.23 ms |         7.82% |               0/5 |
| Many games   |     25.53% |         100.018% |        60.2 |              11.53 ms |      32.72 ms |        18.69% |               0/5 |
| High fanout  |     19.50% |         100.006% |        60.8 |              12.35 ms |      33.69 ms |        18.87% |               0/5 |
| Input stress |      8.60% |         100.003% |        64.2 |              12.60 ms |      26.71 ms |         8.69% |               0/5 |
| Warp 10      |     11.21% |          99.996% |        66.4 |              12.83 ms |      20.27 ms |         7.45% |               0/5 |
| Warp 60      |     40.19% |          99.999% |        66.8 |              18.78 ms |      24.22 ms |         6.84% |               3/5 |

Seven scenarios have no service warning or saturation reason. Warp 60 has a
confirmed saturation verdict under the current policy: repetitions 1, 3, and 5
trigger `simulation-backlog-growing`. Their final-minus-initial backlog
increases are 31.45, 40.12, and 25.09 simulated milliseconds, respectively,
with positive full-window slopes. All five warp-60 runs retain healthy
throughput and cadence, and all five exceed the 16.67 ms event-loop warning.
No run triggers the heap-growth rule.

This finding remains unresolved. The backlog rule uses endpoint increase and
a positive regression slope; it does not require every sample to increase.
The data does not establish whether the verdict represents sustained overload
or sensitivity to fluctuating high-warp backlog. Keep the recorded verdict;
a targeted longer warp-60 capture is the next diagnostic if this matters to
the intended workload. Do not treat selecting a reference as accepting a
product performance budget.

This refresh intentionally used `--skip-capacity`. Its empty `capacitySweep`
and null `firstCapacitySaturation` mean capacity was not measured.

## Capacity and historical evidence

The selected LAN capture completed all 75 repetitions without failed runs or
dropped metrics samples. It sustained the canonical matrix and the sweep
through 24 eight-client games without confirmed service saturation. At 24
games, representative server CPU was 68.03% of one core and worst input-ack p99
was 46.41 ms. Four of five repetitions warned on server event-loop p99.
This establishes behavior through the tested range on that host and network
path, not the maximum server capacity. See `MEMORY_SERVER_PERFORMANCE.md` at
the repository root for the relay bandwidth limitation and capacity analysis.

In the historical `c657f85` same-host capture, all five 16-game repetitions
show generator event-loop starvation. At 32 games, three of five runs failed;
the two valid runs split one-to-one on service saturation. The corrected JSON
therefore records **inconclusive**, not confirmed saturation. The former claim
of confirmed saturation at 32 games counted failed runs as saturation votes.
Retain this capture to explain the harness limitation, not as a server CPU
ceiling or a reference for the optimized generator's capacity.

## Provisional thresholds and comparison

The current same-host capture records a 99% minimum simulation throughput
ratio, a 59.4 Hz snapshot floor, a 16.67 ms event-loop p99 warning, and
path-adjusted p99 warnings of 54.95 ms for input acknowledgement and 52.31 ms
for snapshot inter-arrival. Interaction latency and event-loop findings are
warning-only. Heap growth uses first-third and final-third medians, a positive
full-window slope, and an 8-MiB-or-5% minimum increase.

`npm run compare:server-baseline` selects the reference matching the candidate's
topology and produces a non-blocking Markdown or JSON report. To inspect the
refresh against its predecessor, supply `--reference` with the historical
`c657f85` file explicitly. Its six capacity workloads will appear as
reference-only coverage because this refresh did not repeat that sweep.
