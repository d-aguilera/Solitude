import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import {
  adventureGuidanceCapability,
  adventureObjectiveCapability,
  standaloneGenerationOption,
  standaloneModeOption,
  standaloneSessionCapability,
} from "@solitude/plugin-api/standalone-session";
import { performance } from "node:perf_hooks";
import { env } from "node:process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSolitudeHeadlessLoop } from "../packages/composition/src/headless.ts";
import { loadExternalPluginSet } from "../packages/plugin-runtime/src/index.ts";
import { createPlugin as autopilot } from "../plugins/autopilot/src/index.ts";
import { createPlugin as orbitTelemetry } from "../plugins/core-pack-v1/src/orbit-telemetry/index.ts";
import { createPlugin as gravity } from "../plugins/newtonian-gravity/src/index.ts";
import { createPlugin as polyFighter } from "../plugins/poly-fighter/src/index.ts";
import { createPlugin as solarSystem } from "../plugins/solar-system/src/index.ts";
import { createPlugin as spacecraftOperator } from "../plugins/spacecraft-operator/src/index.ts";
import { createPlugin as adventureFinalPolicy } from "../plugins/standalone-pack-v1/src/adventure/final.ts";
import { createPlugin as standaloneSession } from "../plugins/standalone-pack-v1/src/adventure/index.ts";

// Exercise the production adapter and gameplay plugins without DOM presentation.
const factories = {
  newtonianGravity: gravity,
  solarSystem,
  autopilot,
  spacecraftOperator,
  polyFighter,
  orbitTelemetry,
  standaloneSession,
  adventureFinalPolicy,
};
const origin = "https://first-orbit.test/";
const documents = new Map([
  [origin + "set.json", { schemaVersion: 1, packs: ["pack.json"] }],
  [
    origin + "pack.json",
    {
      schemaVersion: 3,
      id: "firstOrbitTest",
      host: "browser",
      plugins: Object.keys(factories).map((id) => `${id}/plugin.json`),
    },
  ],
  ...Object.keys(factories).map((id) => [
    origin + `${id}/plugin.json`,
    {
      schemaVersion: 2,
      apiVersion: SOLITUDE_PLUGIN_API_VERSION,
      id,
      entry: "index.js",
    },
  ]),
]);
const loaded = await loadExternalPluginSet({
  pluginSetUrl: origin + "set.json",
  host: "browser",
  assertUrl: () => {},
  fetchJson: async (url) => documents.get(url),
  importModule: async (url) => ({
    createPlugin: factories[new URL(url).pathname.split("/")[1]],
  }),
});

function createRun(hz, generation = 1) {
  const options = {
    locale: "en",
    orbitalSpeedMultiplier: "1",
    [standaloneModeOption]: "my-first-orbit",
    [standaloneGenerationOption]: String(generation),
  };
  const plugins = loaded.ids.map((id) => loaded.catalog[id](options));
  const { config, loop } = createSolitudeHeadlessLoop({ plugins });
  for (const plugin of plugins)
    plugin.scene?.initScene?.({ config, ...loop.worldAndScene });
  const capability = (id) =>
    plugins.flatMap((p) => p.capabilities ?? []).find((p) => p.id === id).value;
  const session = capability(standaloneSessionCapability);
  const objective = capability(adventureObjectiveCapability);
  const guidance = capability(adventureGuidanceCapability).guidance;
  const params = {
    controlInput: {},
    dtMillis: 1000 / hz,
    nowMs: 0,
    simTimeMillis: 0,
    state: { framePolicy: {} },
    focusEntity: () => {
      throw new Error("Unexpected focus switch");
    },
    ...loop.worldAndScene,
  };
  let frameCount = 0;
  let guidanceCostMs = 0;
  let simulationCostMs = 0;
  let measuredFrames = 0;
  const measure = env.FIRST_ORBIT_MEASURE === "1";
  const frame = (input = {}) => {
    params.nowMs = (++frameCount * 1000) / hz;
    params.controlInput = { ...input };
    Object.assign(params.state.framePolicy, {
      advanceSim: true,
      advanceScene: true,
      advancePresentation: true,
      simDtMillis: params.dtMillis,
    });
    const start = measure ? performance.now() : 0;
    for (const plugin of plugins) {
      const result = plugin.loop?.updateLoopState?.(params);
      Object.assign(params.state.framePolicy, result?.framePolicy);
    }
    const tickStart = measure ? performance.now() : 0;
    if (params.state.framePolicy.advanceSim) {
      loop.step(params.state.framePolicy.simDtMillis, params.controlInput);
      params.simTimeMillis += params.state.framePolicy.simDtMillis;
    }
    const tickEnd = measure ? performance.now() : 0;
    for (const plugin of plugins) plugin.loop?.afterFrame?.(params);
    if (measure && frameCount > 1000) {
      guidanceCostMs += tickStart - start + performance.now() - tickEnd;
      simulationCostMs += tickEnd - tickStart;
      measuredFrames++;
    }
  };
  while (session.getPresentation().actions[0].disabled) frame();
  session.command("begin");
  frame(); // Begin rebases without advancing physics.
  return {
    session,
    objective,
    guidance,
    params,
    frame,
    reportCost: () => ({
      hz,
      measuredFrames,
      guidanceMicrosecondsPerFrame: (guidanceCostMs * 1000) / measuredFrames,
      simulationMicrosecondsPerFrame:
        (simulationCostMs * 1000) / measuredFrames,
    }),
  };
}

function recover(run, input, maxSeconds = 120) {
  let burnMillis = 0;
  while (run.session.phase === "flying" && !run.objective.safeOrbit) {
    run.frame(input);
    burnMillis += run.params.dtMillis;
    if (burnMillis > maxSeconds * 1000) break;
  }
  expect(run.session.phase).toBe("flying");
  expect(run.objective.safeOrbit).toBe(true);
  expect(run.objective.latestSample.propulsionActive).toBe(true);
  expect(run.guidance.cue).toBe("release");
  const coastInput = { alignToVelocity: !!input.alignToVelocity };
  run.frame(coastInput);
  expect(run.objective.coastMillis).toBe(0);
  expect(run.guidance.cue).toBe("coast");
  const coastStart = run.params.nowMs;
  while (run.session.phase === "flying" && run.params.nowMs - coastStart < 6000)
    run.frame(coastInput);
  expect(run.session.phase).toBe("completed");
  expect(run.params.nowMs - coastStart).toBeGreaterThanOrEqual(5000 - 1e-6);
  expect(run.params.nowMs - coastStart).toBeLessThan(
    5000 + 2 * run.params.dtMillis,
  );
  expect(run.objective.safeOrbitConfirmed).toBe(1);
  expect(run.guidance.visible).toBe(false);
  const terminalTime = run.params.simTimeMillis;
  run.frame({ burnForward: true });
  expect(run.params.simTimeMillis).toBe(terminalTime);
  return burnMillis;
}

beforeEach(() =>
  vi.stubGlobal("document", {
    visibilityState: "visible",
    hasFocus: () => true,
  }),
);
afterEach(() => vi.unstubAllGlobals());

describe("My First Orbit with production physics", () => {
  it.each([30, 60, 120])(
    "recovers and confirms five seconds of coast at %i Hz",
    (hz) => {
      const run = createRun(hz);
      run.frame();
      expect(run.objective.latestSample.periapsisAltitudeMeters).toBeCloseTo(
        -50000,
        -1,
      );
      expect(run.guidance.cue).toBe("orientOrbit");
      const burnMillis = recover(run, { burnForward: true });
      expect(burnMillis).toBeGreaterThan(6000);
      expect(burnMillis).toBeLessThan(6200);
    },
  );

  it("uses Z to roll Earth above and align the nose without propulsion, then recovers manually", () => {
    const run = createRun(60);
    run.frame();
    expect(run.objective.latestSample.earthUpAlignmentCosine).toBeCloseTo(0, 5);
    expect(run.guidance.cue).toBe("orientOrbit");
    for (let i = 0; i < 600; i++) {
      run.frame({ orbit: true });
      expect(run.objective.latestSample.propulsionActive).toBe(false);
    }
    expect(run.params.controlInput.orbit).toBe(true);
    expect(run.objective.latestSample.earthUpAlignmentCosine).toBeGreaterThan(
      Math.cos((8 * Math.PI) / 180),
    );
    expect(run.objective.latestSample.progradeAlignmentCosine).toBeGreaterThan(
      Math.cos((8 * Math.PI) / 180),
    );
    expect(run.guidance.cue).toBe("recover");
    recover(run, { orbit: true, burnForward: true });
    expect(run.session.phase).toBe("completed");
  });

  it("fails at the actual Earth boundary with no thrust and blocks the next tick", () => {
    const run = createRun(60);
    while (run.session.phase === "flying" && run.params.simTimeMillis < 1800000)
      run.frame();
    expect(run.session.phase).toBe("failed");
    expect(run.params.simTimeMillis / 1000).toBeCloseTo(1709.417, 1);
    expect(run.objective.latestSample.earthAltitudeMeters).toBeLessThanOrEqual(
      80000,
    );
    expect(run.objective.safeOrbitConfirmed).toBe(0);
    expect(run.guidance.visible).toBe(false);
    const terminalTime = run.params.simTimeMillis;
    run.frame({ burnForward: true });
    expect(run.params.simTimeMillis).toBe(terminalTime);
    if (env.FIRST_ORBIT_MEASURE === "1")
      console.log(
        "First Orbit retained policy/observation/director cost",
        run.reportCost(),
      );
  }, 15000);

  it.each([180, 600])(
    "recovers after a %i-second delay using Earth-relative V assistance",
    (delay) => {
      const run = createRun(60);
      while (run.params.simTimeMillis < delay * 1000) run.frame();
      expect(run.session.phase).toBe("flying");
      for (let i = 0; i < 10 * 60; i++) run.frame({ alignToVelocity: true });
      const burnMillis = recover(run, {
        burnForward: true,
        alignToVelocity: true,
      });
      expect(burnMillis).toBeLessThan(90000);
      if (env.FIRST_ORBIT_MEASURE === "1")
        console.log("Delayed recovery", {
          delay,
          burnSeconds: burnMillis / 1000,
        });
    },
    15000,
  );

  it("warns when a late prograde burn raises periapsis but exceeds the apoapsis target", () => {
    const run = createRun(60);
    while (run.params.simTimeMillis < 1200000) run.frame();
    for (let i = 0; i < 10 * 60; i++) run.frame({ alignToVelocity: true });
    const burnStart = run.params.simTimeMillis;
    while (
      run.objective.latestSample.periapsisAltitudeMeters < 150000 &&
      run.params.simTimeMillis - burnStart < 120000 &&
      run.session.phase === "flying"
    )
      run.frame({ alignToVelocity: true, burnForward: true });
    expect(
      run.objective.latestSample.periapsisAltitudeMeters,
    ).toBeGreaterThanOrEqual(150000);
    expect(run.objective.latestSample.apoapsisAltitudeMeters).toBeGreaterThan(
      600000,
    );
    expect(run.objective.safeOrbit).toBe(false);
    expect(run.guidance.cue).toBe("highApoapsis");
    expect(run.session.phase).toBe("flying");
    expect(run.objective.safeOrbitConfirmed).toBe(0);
  }, 15000);

  it("fails safely when velocity-aligned recovery starts too close to the boundary", () => {
    const run = createRun(60);
    while (run.params.simTimeMillis < 1680000) run.frame();
    for (let i = 0; i < 10 * 60; i++) run.frame({ alignToVelocity: true });
    while (run.session.phase === "flying" && run.params.simTimeMillis < 1800000)
      run.frame({ alignToVelocity: true, burnForward: true });
    expect(run.session.phase).toBe("failed");
    expect(run.objective.latestSample.earthAltitudeMeters).toBeLessThanOrEqual(
      80000,
    );
    expect(run.objective.safeOrbitConfirmed).toBe(0);
    expect(run.guidance.visible).toBe(false);
  }, 15000);

  it("constructs a fresh retry generation after production-physics completion", () => {
    const original = createRun(60);
    recover(original, { burnForward: true });
    const oldSample = original.objective.latestSample;
    original.session.command("retry");
    expect(original.session.lifecycleRequest).toBe("retry");
    const retry = createRun(60, 2);
    expect(retry.objective.latestSequence).toBe(0);
    expect(retry.objective.safeOrbitConfirmed).toBe(0);
    expect(retry.params.simTimeMillis).toBe(0);
    retry.frame();
    expect(retry.objective.latestSample).not.toBe(oldSample);
    expect(retry.objective.latestSample.generation).toBe(2);
    expect(retry.objective.latestSample.periapsisAltitudeMeters).toBeCloseTo(
      -50000,
      -1,
    );
    expect(retry.objective.latestSample.propulsionActive).toBe(false);
    expect(retry.guidance.cue).toBe("orientOrbit");
  });

  it("recovers an overshoot with manual reverse thrust", () => {
    const run = createRun(60);
    for (let i = 0; i < 20 * 60; i++) run.frame({ burnForward: true });
    expect(run.objective.latestSample.apoapsisAltitudeMeters).toBeGreaterThan(
      600000,
    );
    expect(run.objective.safeOrbit).toBe(false);
    expect(run.guidance.cue).toBe("highApoapsis");
    recover(run, { burnBackwards: true });
  });
});
