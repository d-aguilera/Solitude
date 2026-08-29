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
sweep. `result-schema.json` defines the stable required shape of version-1
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
defines their required version-1 shape. The named default environment is
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
  --server-url http://192.168.0.97:8080 \
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
  --server-url http://192.168.0.97:8080 \
  --server-metadata /path/to/solitude-server-metadata.json \
  --restart-command "ssh benchmark-server restart-solitude-server" \
  --restart-timeout 60
```

The restart command runs on the load-generator machine through its platform
shell. It receives `SOLITUDE_SERVER_URL`, `SOLITUDE_BASELINE_SCENARIO`, and
`SOLITUDE_BASELINE_REPETITION` environment variables. A nonzero exit or a
server that does not become healthy within the timeout aborts the baseline.

Remote results retain the server identity in the baseline's established
top-level fields and under `environment.serverEnvironment`. The Windows or
other load-generator identity is recorded separately under
`environment.loadGeneratorEnvironment`; `environment.topology` prevents LAN,
loopback, and public-internet results from appearing environment-compatible.
`server-metadata-schema.json` defines the captured metadata document. Capture
metadata again whenever the server bundle, plugin artifacts, runtime, or server
environment changes.

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

`reference-baseline.json` selects the default checked-in reference; use
`--reference` to compare against a different result. Add `--json` for the
versioned machine-readable shape defined by `comparison-schema.json`. The
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
