import { describe, expect, it } from "vitest";
import type { EntityConfig } from "../../app/entityConfigPorts";
import type { GamePlugin, SimulationPlugin } from "../../app/pluginPorts";
import type { GravityEngine, GravityState } from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import {
  createHeadlessLoop,
  type HeadlessLoopOptions,
} from "../../infra/headlessGameLoop";
import { createNewtonianGravityPlugin } from "../../infra/NewtonianGravityEngine";
import type { WorldConfigBase } from "../../setup/setup";

function buildHeadlessConfig(): WorldConfigBase {
  const sunId = "body:primary";
  const earthId = "body:secondary";
  const controlledEntityId = "craft:test";

  const sun: EntityConfig = {
    id: sunId,
    components: {
      axialSpin: { angularSpeedRadPerSec: 0, obliquityRad: 0 },
      collisionSphere: { radius: 1_000_000 },
      gravityMass: { density: 1_000, physicalRadius: 1_000_000 },
      lightEmitter: { luminosity: 1 },
      state: {
        centralEntityId: sunId,
        kind: "keplerian",
        orbit: {
          semiMajorAxis: 0,
          eccentricity: 0,
          inclinationRad: 0,
          lonAscNodeRad: 0,
          argPeriapsisRad: 0,
          meanAnomalyAtEpochRad: 0,
        },
      },
    },
  };

  const earth: EntityConfig = {
    id: earthId,
    components: {
      axialSpin: { angularSpeedRadPerSec: 0, obliquityRad: 0 },
      collisionSphere: { radius: 1_000_000 },
      gravityMass: { density: 5_000, physicalRadius: 1_000_000 },
      state: {
        centralEntityId: sunId,
        kind: "keplerian",
        orbit: {
          semiMajorAxis: 10_000_000,
          eccentricity: 0,
          inclinationRad: 0,
          lonAscNodeRad: 0,
          argPeriapsisRad: 0,
          meanAnomalyAtEpochRad: 0,
        },
      },
    },
  };

  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  const controlledEntity: EntityConfig = {
    id: controlledEntityId,
    components: {
      controllable: { enabled: true },
      gravityMass: { density: 1, volume: 1 },
      state: {
        angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
        frame,
        kind: "direct",
        orientation: localFrame.intoMat3(mat3.zero(), frame),
        position: vec3.create(0, 0, 12_000_000),
        velocity: vec3.create(0, 1_000, 0),
      },
    },
  };

  return {
    entities: [sun, earth, controlledEntity],
    mainFocusEntityId: controlledEntityId,
  };
}

describe("headlessGameLoop", () => {
  it("runs simulation phase hooks around the existing physics order", () => {
    const events: string[] = [];
    const gravityEngine: GravityEngine = {
      step: (_dtSeconds: number, _state: GravityState) => {
        events.push("gravity");
      },
    };
    const simulationPlugin: SimulationPlugin = {
      beforeVehicleDynamics: () => events.push("beforeVehicleDynamics"),
      updateVehicleDynamics: () => events.push("vehicleDynamics"),
      afterVehicleDynamics: () => events.push("afterVehicleDynamics"),
      beforeGravity: () => events.push("beforeGravity"),
      afterGravity: () => events.push("afterGravity"),
      afterCollisions: () => events.push("afterCollisions"),
      afterSpin: () => events.push("afterSpin"),
    };
    const loop = createTestHeadlessLoop({
      plugins: [createGravityPlugin("test-gravity", gravityEngine)],
      simulationPlugins: [simulationPlugin],
    });

    loop.step(16);

    expect(events.slice(0, 4)).toEqual([
      "beforeVehicleDynamics",
      "vehicleDynamics",
      "afterVehicleDynamics",
      "beforeGravity",
    ]);
    expect(events.slice(4, -3).length).toBeGreaterThan(0);
    expect(events.slice(4, -3).every((event) => event === "gravity")).toBe(
      true,
    );
    expect(events.slice(-3)).toEqual([
      "afterGravity",
      "afterCollisions",
      "afterSpin",
    ]);
  });

  it("lets simulation vehicle-dynamics plugins run during headless steps", () => {
    let updateCount = 0;
    const simulationPlugin: SimulationPlugin = {
      updateVehicleDynamics: () => {
        updateCount += 1;
      },
    };
    const loop = createTestHeadlessLoop({
      simulationPlugins: [simulationPlugin],
    });

    loop.step(16);

    expect(updateCount).toBe(1);
  });

  it("reuses entity control input storage and clears stale actions", () => {
    const observedMaps: ReadonlyMap<string, Record<string, boolean>>[] = [];
    const observedInputs: Record<string, boolean>[] = [];
    const simulationPlugin: SimulationPlugin = {
      updateVehicleDynamics: ({ controlInputsByEntityId }) => {
        observedMaps.push(controlInputsByEntityId);
        const input = controlInputsByEntityId.get("craft:test");
        if (input) observedInputs.push(input);
      },
    };
    const loop = createTestHeadlessLoop({
      simulationPlugins: [simulationPlugin],
    });

    loop.stepWithEntityInputs(16, new Map([["craft:test", { thrust: true }]]));
    loop.stepWithEntityInputs(16, new Map([["craft:test", { yaw: true }]]));
    loop.stepWithEntityInputs(16, new Map());

    expect(observedMaps[1]).toBe(observedMaps[0]);
    expect(observedMaps[2]).toBe(observedMaps[0]);
    expect(observedInputs[1]).toBe(observedInputs[0]);
    expect(observedInputs[1]).toEqual({ thrust: false, yaw: true });
    expect(observedMaps[2].size).toBe(0);
  });

  it("runs a step without any render config or Solitude plugins", () => {
    const loop = createTestHeadlessLoop();
    const before = vec3.clone(
      loop.worldAndScene.mainFocus.controlledBody.position,
    );

    loop.step(1000);

    const after = loop.worldAndScene.mainFocus.controlledBody.position;
    expect(
      vec3.length(vec3.subInto(vec3.zero(), after, before)),
    ).toBeGreaterThan(0);
  });

  it("advances the focused body position over time", () => {
    const loop = createTestHeadlessLoop();
    const before = vec3.clone(
      loop.worldAndScene.mainFocus.controlledBody.position,
    );

    loop.step(1000);

    const after = loop.worldAndScene.mainFocus.controlledBody.position;
    const delta = vec3.subInto(vec3.zero(), after, before);
    expect(vec3.length(delta)).toBeGreaterThan(0);
  });

  it("preserves the main focus in headless runs", () => {
    const loop = createTestHeadlessLoop();

    expect(loop.worldAndScene.mainFocus.entityId).toBe("craft:test");
    expect(loop.worldAndScene.mainFocus.controlledBody.id).toBe("craft:test");
    expect(loop.worldAndScene.world.controllableBodies).toContain(
      loop.worldAndScene.mainFocus.controlledBody,
    );
  });
});

function createGravityPlugin(
  id: string,
  gravityEngine: GravityEngine,
): GamePlugin {
  return {
    id,
    gravity: { createGravityEngine: () => gravityEngine },
  };
}

function createTestHeadlessLoop(options: HeadlessLoopOptions = {}) {
  const plugins = options.plugins ?? [createNewtonianGravityPlugin()];
  return createHeadlessLoop(buildHeadlessConfig(), { ...options, plugins });
}
