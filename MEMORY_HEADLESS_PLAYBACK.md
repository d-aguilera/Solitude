# Headless Playback Memory

## Purpose

- Track unresolved work for running recorded playback scenarios end-to-end in a headless runtime.
- This topic is intentionally deprioritized while package decoupling is the primary active effort. Keep it active, but do not treat it as the next roadmap slice unless explicitly resumed.
- Use this before changing `packages/engine/src/infra/headlessGameLoop.ts`, Solitude headless composition, playback plugin lifecycle code, or diagnostic playback tests.
- Goal: make scenarios such as `random-trip` runnable without the browser URL/runtime path, so recorded scenarios can become fast regression tests.

## Current State

- Browser playback works through DOM bootstrap/runtime options, e.g. `?mode=playback&scenario=random-trip`.
- `packages/engine/src/infra/headlessGameLoop.ts` is currently a thin generic simulation stepper intended for tests.
- Headless setup builds a world with `createHeadlessWorld` and advances physics through `step(dtMillis, controlInputOverrides)`.
- `packages/sim/src/headless.ts` provides the Solitude-owned wrapper: it loads the static headless simulation catalog, applies world-model hooks, and passes those plugins to the generic loop.
- Generic headless setup does not install `spacecraftOperator` by default. Callers pass plugins explicitly through `HeadlessLoopOptions.plugins`; the Solitude wrapper currently selects `solarSystem`, `spacecraftOperator`, and `autopilot`.
- Playback internals are unit-tested under `packages/solitude/src/__tests__/plugins/playback/`, but headless composition does not play a recorded scenario end-to-end.

## Current Gap

Neither `createHeadlessLoop` nor `createSolitudeHeadlessLoop` currently runs the playback plugin lifecycle:

- the Solitude wrapper accepts runtime options and loads simulation plugins, but playback is not in its headless catalog;
- no `LoopPlugin.updateLoopState` orchestration;
- no playback `FramePolicy` handling for fixed playback step/time scale;
- no `playback.applySceneSnapshot(world)` scene/world snapshot application;
- no playback pause/start handling;
- no `LoopPlugin.afterFrame` diagnostic logging path;
- no general browser-style loop/input/control lifecycle around the direct headless simulation stepper.

Result: recorded scenarios are testable at controller/unit level, but the headless bootstrap cannot yet run a URL-equivalent playback such as `mode=playback&scenario=random-trip`.

## Target Shape

Add a dedicated headless playback runner or extend headless runtime with plugin-loop orchestration.

Possible API:

```ts
createHeadlessPlaybackLoop(config, {
  runtimeOptions: { mode: "playback", scenario: "random-trip" },
});
```

Expected behavior:

- load the playback plugin with runtime options;
- apply the playback snapshot before stepping;
- drive playback `LoopPlugin.updateLoopState`;
- honor returned `FramePolicy.tickDtMillis` and `FramePolicy.simDtMillis`;
- run `tickInto` only when playback advances simulation;
- call `LoopPlugin.afterFrame` so diagnostic loggers work;
- expose enough status/output for tests to assert completion, sample counts, final state, or diagnostics.

## Design Notes

- Prefer a dedicated headless playback runner over making the existing simple `createHeadlessLoop` too DOM-runtime-shaped.
- Keep the existing `createHeadlessLoop` useful as a direct physics/test stepper.
- Compose Solitude plugins explicitly in a Solitude-owned runner; do not add playback or spacecraft defaults back into the generic headless loop.
- Keep this work independent from extracting the browser playback plugin into an external package. When this roadmap resumes, consume the then-current playback implementation through a deliberate headless composition seam.
- Reuse plugin ports rather than importing playback internals directly where possible.
- Avoid DOM assumptions: no canvas, no requestAnimationFrame, no keyboard handler dependency.
- Keep allocation/performance constraints in mind if this becomes part of regression suites.

## Candidate First Slice

- Add a headless loop-plugin harness that can:
  - load playback plugin with `{ mode: "playback", scenario: "random-trip" }`;
  - apply its scene snapshot to a headless world;
  - simulate pressing pause/start or directly call the playback controller path through plugin input/loop APIs;
  - step until playback reports done or a max-frame guard trips.
- Add a focused test that verifies playback advances the world using the script fixed step/time scale.

## Open Questions

- Should a Solitude-owned headless playback runner load the full default plugin list or only the minimal playback + spacecraft operator set?
- Should it parse URL-style query strings or accept `RuntimeOptions` directly?
- How should diagnostics be surfaced: returned report object, captured console output, or plugin logger injection?
- Should playback completion be exposed through a public plugin/controller status port before building a full runner?
