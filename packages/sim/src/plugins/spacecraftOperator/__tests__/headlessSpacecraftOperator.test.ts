import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import { createHeadlessLoop } from "@solitude/engine/runtime";
import type { EntityConfig, WorldConfigBase } from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import { createSpacecraftOperatorPlugin } from "../index";

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

describe("headless spacecraft operator composition", () => {
  it("lets callers compose Solitude spacecraft dynamics explicitly", () => {
    const loop = createHeadlessLoop(buildHeadlessConfig(), {
      plugins: [createSpacecraftOperatorPlugin()],
    });
    const before = vec3.clone(
      loop.worldAndScene.mainFocus.controlledBody.velocity,
    );

    loop.step(1000, { burnForward: true, thrust5: true });

    const after = loop.worldAndScene.mainFocus.controlledBody.velocity;
    expect(
      vec3.length(vec3.subInto(vec3.zero(), after, before)),
    ).toBeGreaterThan(0);
  });
});
