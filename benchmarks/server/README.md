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
