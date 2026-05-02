# Headless Playback Memory

## Purpose

- Track planned work for running recorded playback scenarios end-to-end in a headless runtime.
- Use this before changing `src/infra/headlessGameLoop.ts`, playback plugin lifecycle code, or diagnostic playback tests.
- Goal: make scenarios such as `random-trip` runnable without the browser URL/runtime path, so recorded scenarios can become fast regression tests.

## Current State

- Browser playback works through DOM bootstrap/runtime options, e.g. `?mode=playback&scenario=random-trip`.
- `src/infra/headlessGameLoop.ts` is currently a thin simulation stepper intended for tests.
- Headless setup builds a world with `createHeadlessWorld`, installs `spacecraftOperator` simulation by default, and advances physics through `step(dtMillis, controlInputOverrides)`.
- Playback internals are unit-tested (`src/plugins/playback/core.test.ts`, snapshot tests, logger tests), but headless bootstrap does not play a recorded scenario end-to-end.

## Current Gap

`createHeadlessLoop` does not currently run the playback plugin lifecycle:

- no runtime-options parsing or plugin loading;
- no `LoopPlugin.updateLoopState` orchestration;
- no playback `FramePolicy` handling for fixed playback step/time scale;
- no `playback.applySceneSnapshot(world)` scene/world snapshot application;
- no playback pause/start handling;
- no `LoopPlugin.afterFrame` diagnostic logging path;
- no plugin input/control lifecycle beyond manually supplied control/simulation plugins.

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

- Should headless playback load the full default plugin list or only the minimal playback + spacecraft operator set?
- Should it parse URL-style query strings or accept `RuntimeOptions` directly?
- How should diagnostics be surfaced: returned report object, captured console output, or plugin logger injection?
- Should playback completion be exposed through a public plugin/controller status port before building a full runner?
