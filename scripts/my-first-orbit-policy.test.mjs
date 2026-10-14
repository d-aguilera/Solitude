import { buildViewDefinitions } from "@solitude/engine/render";
import {
  createConfiguredGamePipeline,
  createHeadlessLoop,
} from "@solitude/engine/runtime";
import { applyWorldModelPlugins } from "@solitude/engine/world";
import {
  collectKeyboardInputProviders,
  createKeyboardHandlerDispatcher,
} from "@solitude/input/keyboard";
import { SOLITUDE_PLUGIN_API_VERSION } from "@solitude/plugin-api/manifest";
import {
  adventureObjectiveCapability,
  standaloneModeOption,
  standaloneSessionCapability,
} from "@solitude/plugin-api/standalone-session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildWorldAndSceneConfig } from "../packages/composition/src/worldAndSceneConfig.ts";
import { loadExternalPluginSet } from "../packages/plugin-runtime/src/index.ts";
import { createPlugin as autopilot } from "../plugins/autopilot/src/index.ts";
import { createPlugin as autopilotInput } from "../plugins/core-pack-v1/src/autopilot-input/index.ts";
import { createPlugin as orbitTelemetry } from "../plugins/core-pack-v1/src/orbit-telemetry/index.ts";
import { createPlugin as gravity } from "../plugins/newtonian-gravity/src/index.ts";
import { createPlugin as polyFighter } from "../plugins/poly-fighter/src/index.ts";
import { createPlugin as solarSystem } from "../plugins/solar-system/src/index.ts";
import { createPlugin as spacecraftOperator } from "../plugins/spacecraft-operator/src/index.ts";
import { createPlugin as adventureFinalPolicy } from "../plugins/standalone-pack-v1/src/adventure/final.ts";
import { createPlugin as standaloneSession } from "../plugins/standalone-pack-v1/src/adventure/index.ts";
import { createPlugin as ships } from "../plugins/standalone-pack-v1/src/ships/index.ts";

// Use production discovery/adaptation and physics, including factory-produced hooks.
const factories = {
  newtonianGravity: gravity,
  solarSystem,
  autopilot,
  spacecraftOperator,
  polyFighter,
  autopilotInput,
  orbitTelemetry,
  ships,
  standaloneSession,
  adventureFinalPolicy,
};
const origin = "https://policy.test/";
const documents = new Map([
  [origin + "set.json", { schemaVersion: 1, packs: ["pack.json"] }],
  [
    origin + "pack.json",
    {
      schemaVersion: 3,
      id: "policyTest",
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
const live = [];
beforeEach(() => {
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), {
      visibilityState: "visible",
      hasFocus: () => true,
    }),
  );
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => {
  for (const pipeline of live.splice(0)) pipeline.dispose();
  vi.unstubAllGlobals();
});
function plugins(mode = "my-first-orbit") {
  return loaded.ids.map((id) =>
    loaded.catalog[id]({ locale: "en", [standaloneModeOption]: mode }),
  );
}
function configure(list) {
  const config = buildWorldAndSceneConfig();
  applyWorldModelPlugins(config, list);
  return config;
}
function pipeline(list, input = {}) {
  const config = configure(list);
  const result = createConfiguredGamePipeline({
    config,
    controlInput: input,
    plugins: list,
    viewDefinitions: buildViewDefinitions(config, list),
  });
  live.push(result);
  return result;
}
function insertBeforeFinal(list, contributor) {
  list.splice(
    list.findIndex((p) => p.id === "adventureFinalPolicy"),
    0,
    contributor,
  );
  return list;
}
function sessionOf(p) {
  return p.capabilityRegistry.getAll(standaloneSessionCapability)[0];
}
function fly(p) {
  for (let i = 0; i <= 32; i++) {
    p.beginFrame(i * 16, 16);
    p.endFrame();
  }
  sessionOf(p).command("begin");
  expect(sessionOf(p).phase).toBe("flying");
  expect(p.beginFrame(528, 16).framePolicy.advanceSim).toBe(false);
  p.endFrame();
}

describe("My First Orbit validated policy precedence", () => {
  it("blocks X/C without clearing Z/V and preserves pause, resume and suspension", () => {
    const list = plugins();
    const keyboard = createKeyboardHandlerDispatcher(
      collectKeyboardInputProviders(list.flatMap((p) => p.capabilities ?? [])),
    );
    const p = pipeline(list, keyboard.controlInput);
    sessionOf(p).attachInputReset(keyboard.clear);
    keyboard.handleKey("KeyZ", true, false);
    expect(keyboard.controlInput.orbit).toBe(false);
    fly(p);
    keyboard.handleKey("KeyZ", true, false);
    expect(keyboard.controlInput.orbit).toBe(true);
    for (const code of ["KeyX", "KeyC"]) keyboard.handleKey(code, true, false);
    expect(keyboard.controlInput.orbit).toBe(true);
    expect(keyboard.controlInput.circleNow).toBe(false);
    keyboard.handleKey("KeyV", true, false);
    expect(keyboard.controlInput.alignToVelocity).toBe(true);
    keyboard.handleKey("KeyP", true, false);
    expect(sessionOf(p).phase).toBe("paused");
    expect(p.beginFrame(544, 16).framePolicy.advanceSim).toBe(false);
    p.endFrame();
    keyboard.handleKey("KeyP", true, false);
    expect(p.beginFrame(560, 16).framePolicy.advanceSim).toBe(false);
    p.endFrame();
    expect(p.beginFrame(576, 16).framePolicy.advanceSim).toBe(true);
    p.endFrame();
    expect(p.beginFrame(1000, 424).framePolicy.advanceSim).toBe(false);
    expect(sessionOf(p).phase).toBe("suspended");
  });

  it("sanitizes later direct-input writers and overrides earlier frame/propulsion policies", () => {
    const input = {};
    const injection = {
      id: "conflicting",
      capabilities: [
        {
          id: "spacecraft.propulsionResolver.v1",
          value: {
            resolvePropulsionCommand: () => ({
              main: { forward: 1 },
              rcs: { right: 1 },
            }),
          },
        },
      ],
      loop: {
        updateLoopState: ({ controlInput }) => {
          Object.assign(controlInput, {
            circleNow: true,
            thrust9: true,
            burnRight: true,
          });
          return {
            framePolicy: {
              advanceSim: true,
              advanceScene: true,
              tickDtMillis: 1000,
              simDtMillis: 1000,
            },
          };
        },
      },
      simulation: () => ({
        beforeVehicleDynamics: ({ controlInput, controlInputsByEntityId }) => {
          for (const value of [
            controlInput,
            ...controlInputsByEntityId.values(),
          ])
            Object.assign(value, {
              circleNow: true,
              thrust9: true,
              burnRight: true,
            });
        },
      }),
    };
    const list = insertBeforeFinal(plugins(), injection);
    const p = pipeline(list, input);
    expect(p.beginFrame(0, 16).framePolicy.advanceSim).toBe(false);
    p.endFrame();
    fly(p);
    input.burnForward = true;
    const frame = p.beginFrame(544, 16);
    p.endFrame();
    expect(frame.framePolicy).toMatchObject({
      advanceSim: true,
      simDtMillis: 16,
    });
    expect(frame.framePolicy.tickDtMillis).toBeUndefined();
    for (const action of ["circleNow", "thrust9", "burnRight"])
      expect(input[action]).toBe(false);
    const sample = p.capabilityRegistry.getAll(adventureObjectiveCapability)[0]
      .latestSample;
    expect(sample.propulsionActive).toBe(true);
    const resolver = p.capabilityRegistry
      .getAll("spacecraft.propulsionResolver.v1")
      .at(-1);
    expect(
      resolver.resolvePropulsionCommand({
        controlInput: input,
        controlledBody: { id: "ship:first-orbit" },
        maxThrustAcceleration: 2000,
      }),
    ).toEqual({ main: { forward: 0.005 }, rcs: { right: 0 } });
    input.burnForward = false;
    input.burnBackwards = true;
    p.beginFrame(560, 16);
    p.endFrame();
    expect(
      resolver.resolvePropulsionCommand({
        controlInput: input,
        controlledBody: { id: "ship:first-orbit" },
        maxThrustAcceleration: 2000,
      }).main.forward,
    ).toBe(-0.005);
  });

  it.each([
    [
      "keyboard",
      {
        capabilities: [
          {
            id: "solitude.keyboardInput.v1",
            value: {
              keyMap: { KeyX: "circleNow" },
              createKeyHandler: () => ({
                handleKeyDown: () => true,
                handleKeyUp: () => true,
              }),
            },
          },
        ],
      },
      "keyboard guard",
    ],
    [
      "frame",
      {
        loop: {
          updateLoopState: () => ({ framePolicy: { advanceSim: true } }),
        },
      },
      "loop.updateLoopState",
    ],
    [
      "input",
      { simulation: () => ({ beforeVehicleDynamics: () => {} }) },
      "simulation.beforeVehicleDynamics",
    ],
    ["sampling", { loop: { afterFrame: () => {} } }, "loop.afterFrame"],
    [
      "propulsion",
      {
        capabilities: [
          {
            id: "spacecraft.propulsionResolver.v1",
            value: {
              resolvePropulsionCommand: () => ({
                main: { forward: 1 },
                rcs: { right: 1 },
              }),
            },
          },
        ],
      },
      "propulsion resolver",
    ],
  ])(
    "rejects a later %s contributor before loop initialization",
    (_name, extra, message) => {
      const init = vi.fn();
      const list = [
        ...plugins(),
        {
          id: "tooLate",
          ...extra,
          ...(extra.loop ? { loop: { ...extra.loop, initLoop: init } } : {}),
        },
      ];
      expect(() => pipeline(list)).toThrow(message);
      expect(init).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "early loop",
      { loop: { updateLoopState: () => null } },
      'standaloneSession" must be first',
    ],
    [
      "early sampling",
      { loop: { afterFrame: () => {} } },
      'standaloneSession" must be first',
    ],
  ])(
    "rejects %s before session eligibility processing",
    (_name, extra, message) => {
      expect(() =>
        pipeline([{ id: "tooEarly", ...extra }, ...plugins()]),
      ).toThrow(message);
    },
  );

  it.each([
    [
      "factory dynamics",
      { simulation: () => ({ updateVehicleDynamics: () => {} }) },
      "only spacecraftOperator",
    ],
    [
      "controls",
      { controls: { updateControlState: () => {} } },
      "Unsupported adventure control",
    ],
    [
      "post dynamics",
      { simulation: () => ({ afterVehicleDynamics: () => {} }) },
      "Unsupported adventure simulation",
    ],
    [
      "initial clock",
      { loop: { getInitialSimTimeMillis: () => 1000 } },
      "initial clock",
    ],
    [
      "remapped key",
      {
        capabilities: [
          {
            id: "solitude.keyboardInput.v1",
            value: { keyMap: { KeyX: "burnForward" } },
          },
        ],
      },
      "Keyboard binding KeyX",
    ],
  ])(
    "rejects unsupported %s even before the final policy",
    (_name, extra, message) => {
      expect(() =>
        pipeline(insertBeforeFinal(plugins(), { id: "unsupported", ...extra })),
      ).toThrow(message);
    },
  );

  it("rejects reordered policy plugins but accepts a harmless later presentation contributor", () => {
    const list = plugins();
    const final = list.pop();
    list.splice(
      list.findIndex((p) => p.id === "standaloneSession"),
      0,
      final,
    );
    expect(() => pipeline(list)).toThrow('standaloneSession" must be first');
    expect(() =>
      pipeline([
        ...plugins(),
        { id: "presentation", labels: { appendLabels: () => {} } },
      ]),
    ).not.toThrow();
  });

  it("validates headless materialized and additional contributors too", () => {
    const list = plugins();
    const config = configure(list);
    expect(() => createHeadlessLoop(config, { plugins: list })).not.toThrow();
    expect(() =>
      createHeadlessLoop(config, {
        plugins: list,
        simulationPlugins: [{ beforeVehicleDynamics: () => {} }],
      }),
    ).toThrow("beforeVehicleDynamics");
    expect(() =>
      createHeadlessLoop(config, {
        plugins: list,
        controlPlugins: [{ getAttitudeCommand: () => null }],
      }),
    ).toThrow("$additional");
  });

  it("rejects a missing final policy even though its own validator is absent", () => {
    expect(() =>
      pipeline(plugins().filter((p) => p.id !== "adventureFinalPolicy")),
    ).toThrow("requires one active adventureFinalPolicy");
  });

  it("sanitizes entity-addressed input after ordinary pre-dynamics hooks", () => {
    let inputs;
    const writer = {
      id: "entityWriter",
      simulation: () => ({
        beforeVehicleDynamics: ({ controlInputsByEntityId }) => {
          inputs = controlInputsByEntityId;
          for (const input of inputs.values())
            Object.assign(input, {
              circleNow: true,
              burnRight: true,
              thrust9: true,
            });
        },
      }),
    };
    const list = insertBeforeFinal(plugins(), writer);
    const p = pipeline(list);
    fly(p);
    const headless = createHeadlessLoop(configure(list), { plugins: list });
    headless.stepWithEntityInputs(
      16,
      new Map([
        ["ship:first-orbit", { orbit: true, burnForward: true }],
        ["uncontrolled", { burnForward: true }],
      ]),
    );
    expect(inputs.get("ship:first-orbit")).toMatchObject({
      orbit: true,
      burnForward: true,
      circleNow: false,
      burnRight: false,
      thrust9: false,
    });
    expect(inputs.get("uncontrolled").burnForward).toBe(false);
  });

  it("keeps Free Flight assembly permissive", () => {
    const list = [
      ...plugins("free-flight"),
      {
        id: "sandboxExtra",
        simulation: () => ({ beforeVehicleDynamics: () => {} }),
        loop: { updateLoopState: () => ({ framePolicy: { simDtMillis: 64 } }) },
      },
    ];
    const p = pipeline(list);
    expect(p.beginFrame(0, 16).simTimeMillis).toBe(64);
  });
});
