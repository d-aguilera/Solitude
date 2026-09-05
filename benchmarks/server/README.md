# Server load benchmark

Build and start the production server before running a workload:

```sh
npm run build:server
npm run start:server
```

In a separate process, run a short local profile:

```sh
npm run load:server -- \
  --games 1 \
  --clients-per-game 8 \
  --input-hz 4 \
  --sim-rate 1 \
  --warmup 5 \
  --duration 20 \
  --repetitions 2 \
  --seed 1 \
  --quiet \
  --output /tmp/solitude-server-load.json
```

`scenarios.json` defines the canonical workload matrix and initial capacity
sweep. The checked-in sweep doubles because doubling is a _bracketing search_:
when the saturation point is unknown it reaches high game counts in a few
steps, and each step costs five repetitions of warm-up plus measurement. Powers
of two are not a constraint, and doubling stops being the right strategy once
saturation is known to lie above the last healthy point but below the next
double. `--capacity-games 16,20,24` runs an explicit list instead, with no
doubling past it, for refining a bracket rather than establishing one. `result-schema.json` defines the stable required shape of version-1
result files. The harness always collects client acknowledgement and snapshot
inter-arrival latency; `--latency` remains accepted for compatibility with old
commands.

Repetitions in one harness invocation reuse the same live games and server
process. This is suitable for local variance checks and avoids contaminating
later repetitions with abandoned games. Official reference runs must instead
restart the server and invoke the harness with `--repetitions 1` for each
repetition, as described in `MEMORY_SERVER_PERFORMANCE.md`.

The baseline orchestrator enforces that protocol and builds the production
bundle once before running the canonical matrix and capacity sweep:

```sh
npm run baseline:server
```

Reference defaults are a 15-second warm-up, 60-second measurement, and five
fresh-server repetitions. Results are written under
`benchmarks/server/baselines/<machine>/<commit>.json`; `baseline-schema.json`
defines their required version-4 shape. The named default environment is
`wsl2-i7-7700hq`. It is a same-host WSL2 reference, so its transport numbers
must not be presented as separate-host network capacity.

## Separate-host baselines

Remote mode runs the complete matrix and capacity orchestration from a load
generator on another machine. The server still must use the production bundle
and restart before every repetition. First capture the exact server identity on
the server machine, after creating the build that will be measured:

```sh
npm run baseline:server-metadata -- \
  --machine devcontainer-lan \
  --output /tmp/solitude-server-metadata.json

HOST=0.0.0.0 PORT=8080 npm run start:server
```

Copy the metadata file to the load-generator machine. Then run the remote
baseline there:

```sh
npm run baseline:server:remote -- \
  --server-url http://192.168.0.86:8080 \
  --server-metadata /path/to/solitude-server-metadata.json \
  --load-generator-machine windows-lan-client \
  --topology separate-host-lan
```

By default the orchestrator pauses before every repetition. Restart the server
process on the server machine and press Enter; the orchestrator waits for
`/health` before starting the workload. This includes the first repetition, so
the first run also starts from a fresh process. Manual restart requires an
interactive terminal.

For unattended operation, provide a command that restarts the server and exits
only after initiating the new process:

```sh
npm run baseline:server:remote -- \
  --server-url http://192.168.0.86:8080 \
  --server-metadata /path/to/solitude-server-metadata.json \
  --restart-command "ssh benchmark-server restart-solitude-server" \
  --restart-timeout 60
```

### Restarting a WSL2 server over SSH

The reference separate-host setup restarts `wsl2-i7-7700hq` this way. Its
Windows 10 build cannot run WSL mirrored networking, so each service is reached
through a `netsh portproxy` relay into the WSL NAT, with a matching inbound
firewall rule on the Private profile. Three ports are involved: 8080 for the
server, 22 for SSH, and 5201 for the optional `netcheck` link preflight. The
relay target is the WSL IP, which changes when WSL restarts, so the proxy is
re-asserted per WSL session:

```powershell
netsh interface portproxy add v4tov4 listenport=22 listenaddress=0.0.0.0 `
  connectport=22 connectaddress=<WSL_IP>
New-NetFirewallRule -DisplayName "ssh 22" -Direction Inbound `
  -Protocol TCP -LocalPort 22 -Profile Private -Action Allow
```

Authentication uses a dedicated key so it can be revoked independently, and the
load generator's SSH config sets `BatchMode yes` so a missing key fails fast
instead of hanging on a password prompt for an unattended run.

`scripts/restart-solitude-server.sh` is the reference implementation; copy it
to the server machine and point `--restart-command` at it over SSH. It must
exit 0 once a fresh process has been _initiated_, never blocking for readiness;
the orchestrator polls `/health` on its own. Three details matter, each learned
from a failure:

- **Invoke node by absolute path.** A non-interactive SSH session does not
  source `.bashrc`, so an nvm-managed `node` is not on `PATH`. Pinning the path
  also makes the measured runtime deterministic rather than dependent on shell
  initialisation.
- **Wait for the port to be released after killing the old process**, or the
  replacement can lose the bind race and fail in a way that looks like a server
  fault mid-run.
- **Verify the new process survived, and exit nonzero if not.** `nohup ... &`
  backgrounds unconditionally and reports success even when the command could
  not be found, which turns a missing prerequisite into a confusing `/health`
  timeout 30 seconds later.

Use `setsid`/`disown` so the server outlives the SSH session that started it,
and append rather than truncate the server log, so a failure that only appears
in a later repetition can still be diagnosed.

Capturing server metadata over that same SSH connection silently degrades it:
without `WSL_INTEROP` and the Windows directories on `PATH`, the Windows host
probe cannot run and `physicalCores`, `hybrid`, and `vbs` are recorded as
`null`. Export a live interop socket from `/run/WSL/` and prepend the Windows
system directories, or capture from an interactive WSL terminal instead.

The restart command runs on the load-generator machine through its platform
shell. It receives `SOLITUDE_SERVER_URL`, `SOLITUDE_BASELINE_SCENARIO`, and
`SOLITUDE_BASELINE_REPETITION` environment variables. A nonzero exit or a
server that does not become healthy within the timeout aborts the baseline.

Remote results retain the server identity in the baseline's established
top-level fields and under `environment.serverEnvironment`. The Windows or
other load-generator identity is recorded separately under
`environment.loadGeneratorEnvironment`; `environment.topology` prevents LAN,
loopback, and public-internet results from appearing environment-compatible.
`server-metadata-schema.json` defines the required version-3 metadata document.
Capture metadata again whenever the server bundle, plugin artifacts, runtime,
or server environment changes.

Both identities additionally record `cpuTopology` and `virtualization`, because
core layout and an active hypervisor change measured latency spread without
changing any field that previously identified an environment:

- `cpuTopology.hybrid` is true when the host reports fewer physical cores than
  a uniformly hyper-threaded part would need for its logical core count, which
  identifies performance/efficiency designs whose thread migration widens p95
  and p99 tails. It is `null` when host core counts are unavailable.
- `cpuTopology.visibleLogicalCores` is what the measuring process sees, while
  `logicalCores` is what the host reports. They differ when a guest is given a
  subset of the host's processors, such as a WSL2 `.wslconfig` limit.
- `virtualization.runtime` distinguishes `bare-metal`, `virtual-machine`,
  `wsl2`, and `windows-host` measurement contexts.
- `container` records whether the capture ran inside a container, which engine
  provided it, and whether it was a devcontainer. Containerized captures add a
  network hop and CPU contention on the transport path that the capacity sweep
  already stresses, so a containerized run and a native run on the same machine
  are not comparable even though every other identity field matches.
- `virtualization.vbs` records virtualization-based security, whose
  hypervisor-enforced code integrity (`hvci`) adds memory-access overhead to
  every workload measured on that host. It is `null` where the state cannot be
  resolved.

Before the first repetition, the orchestrator probes `/health` 200 times
against the live server and records the result as
`environment.pathLatencyMillis`. Client-observed thresholds are then offset by
what the transport itself costs, because a 50 ms acknowledgement budget
calibrated on loopback is not the right budget for a path carrying 10 ms of
baseline latency:

- `inputAckLatencyMillisP99Warning` is offset by the full path p99, since
  absolute latency adds directly to every acknowledgement.
- `snapshotInterArrivalMillisP99Warning` is offset by path jitter (p99 minus
  p50) only, because constant latency shifts arrivals without changing their
  spacing.
- Server-side thresholds are deliberately **not** adjusted. Event-loop delay,
  throughput, backlog, and cadence are measured inside the server process and
  cannot be affected by the network path, so they stay directly comparable
  across topologies.

The measured summary is stored in the baseline and the effective thresholds are
persisted in `provisionalThresholds`, so a capture always records the budget it
was actually judged against.

The load generator does not fully parse snapshot payloads. Snapshots are the
overwhelming majority of generator inbound work, but latency tracking needs only
three things from one: that it is a snapshot, its arrival time, and the
`lastProcessedInputSequences` map. Each is read with a byte-prefix check and a
bounded scan for the map, skipping the entity state entirely. Control messages
still take the full parse; a snapshot that reaches the full parse is a hard
error that aborts the run, because a serialization change silently reverting
the generator to per-snapshot parsing would change the harness's own cost
profile and make the capture incomparable without any visible signal. On
the development machine the fast path halved generator CPU at eight
eight-client games.
The `c657f85` reference showed why it matters: generator event-loop starvation
from 16 games and 6.3-6.5 second stalls at 32, while the server stayed at 62%
CPU with 99.8% throughput - the 32-game acknowledgement collapse was generator
GC pressure from parsing and discarding every entity in every snapshot.

A run that fails for transport or harness reasons is invalid, not saturated.
Saturation is voted only among repetitions that produced data; a workload whose
valid repetitions do not form a majority is recorded `inconclusive`. Metrics
polling is sampling, so a lost poll costs one observation, recorded per run as
`droppedMetricsSamples`, and fails the run only above a 10% loss ratio.
Boundary fetches that bound the measurement window are retried, but sampling
fetches never are, because a retry would perturb the cadence being measured.
`npm run reanalyze:server-baseline -- --baseline <file>` re-derives stored
verdicts after an analysis-policy change and leaves raw run data untouched;
`--check` reports what would change without writing.

Every run also records a `generator` block holding the load generator's own CPU
utilization, event-loop delay, and RSS, plus a `generatorSaturation` verdict.
This exists because input-acknowledgement latency is measured inside the
generator process: if its event loop is delayed, both input scheduling and
acknowledgement timestamping are delayed with it, so the generator's event-loop
p99 is effectively a floor on the acknowledgement latency it can resolve. A run
whose acknowledgement p99 collapses while the server reports healthy CPU,
throughput, backlog, and cadence should be checked against `generatorSaturation`
before it is read as server saturation. `generator.cpuUtilizationPercent` uses
the same process-time semantics as the server's: 100% means one fully occupied
core. The load generator's JavaScript work runs on one event-loop thread, so
its CPU warning is 85% of one core rather than a host-wide logical-core budget.
The event-loop verdict uses the worst sampled p99 so an episodic stall is not
hidden by otherwise healthy one-second windows.

Windows facts are read through a single best-effort `powershell.exe` probe on
Windows and directly interoperable WSL hosts. It is bounded by a timeout and
never fails a run; hosts where it cannot run record the portable subset instead.
Version-3 server metadata and baselines always contain both identity objects,
including explicit `null` values for facts that could not be resolved.

For a functional check of the orchestration without creating a checked-in
baseline, use the explicitly non-reference smoke profile:

```sh
npm run build:server
node scripts/run-server-baseline.mjs \
  --profile smoke \
  --scenario typical \
  --skip-capacity \
  --output /tmp/solitude-server-baseline-smoke.json
```

The orchestrator persists after every scenario so an interrupted long run
retains completed evidence. Capacity doubles beyond the checked-in initial
game counts and stops at the first majority-confirmed saturation point, or at
128 games if none is observed. `--max-capacity-games` can change that safety
ceiling. Each repetition retains aggregated latency/process/game summaries and
a compact trend series; the much larger raw `/metrics` responses remain load
harness artifacts rather than reference-baseline storage.

Saturation requires a majority of repetitions. Heap growth compares the
first-third and final-third steady-state medians and requires a positive
full-window slope, avoiding false positives from ending at the top of a stable
GC sawtooth. Interaction-latency thresholds are explicitly warning-only until
an SLA is agreed.

Compare any candidate baseline with the selected reference:

```sh
npm run compare:server-baseline -- \
  --candidate /path/to/candidate-baseline.json \
  --output /tmp/server-baseline-comparison.md
```

`reference-baseline.json` records one reference per measurement topology, and
the candidate's own `environment.topology` selects which one it is compared
against. A candidate whose topology has no recorded reference fails with the
available topologies listed, rather than silently comparing against a
differently-measured baseline. Use `--reference-topology` to force a specific
entry or `--reference` to compare against an arbitrary result file. Add
`--json` for the versioned machine-readable shape defined by
`comparison-schema.json`.

The two topologies answer different questions and are not interchangeable:

- `same-host-loopback` is the **regression** reference. The load generator
  shares the server's CPU and never crosses a network, which keeps it cheap and
  reproducible for commit-to-commit comparison. The selected `f32841e` capture
  uses the current snapshot fast path and covers the eight canonical scenarios
  only; its capacity sweep was intentionally skipped. It retains a confirmed
  warp-60 backlog-growth verdict (3/5 repetitions), documented in the reference
  machine README. The historical `c657f85` capacity sweep measures when the
  machine can no longer both generate and serve, so it is a co-resident limit
  rather than a server capacity claim.
- `separate-host-lan` is the **capacity** reference, and the only one that can
  support a deployment claim. It requires enough link headroom to stay out of
  the measurement: snapshot fanout is roughly `games x per-game wire bytes`,
  which reaches about 430 Mbit/s at 16 eight-client games and 830 Mbit/s at 32.
  Gigabit Ethernet is therefore marginal at the top of the current sweep, and
  ordinary Wi-Fi saturates well before the server does. The
  Markdown and JSON forms report absolute and percentage deltas, min/p50/p95/max
  spread across successful repetitions, scenario coverage, saturation changes,
  and machine/runtime/plugin/protocol/analysis mismatches.

Comparison findings are deliberately non-blocking: metric changes,
out-of-reference-range values, missing workloads, and environment mismatches
do not produce a failing exit code. Invalid inputs and I/O failures still exit
nonzero. Promote a metric to a gate only after repeated controlled captures
establish its variance and an explicit budget is agreed.

Run the in-process authoritative benchmark separately:

```sh
npm run bench:server-authoritative
```

That command rebuilds and discovers the production server plugin set. It
reports simulation plus runtime snapshot capture, compact snapshot encoding,
independent-game scaling, input-window workloads, and 1x/10x/60x fixed-step
cost without HTTP or WebSocket scheduling. Use `npm run bench:gravity` as the
narrower Newtonian-provider signal.

Non-quiet progress is written to stderr. The versioned result is written to
stdout and, when `--output` is supplied, to that path. A run exits nonzero when
game creation or joining fails, the metrics endpoint fails, a socket closes,
a game stops, a client receives no measured snapshots, or input
acknowledgements remain pending after the drain interval.
