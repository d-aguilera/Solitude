import { describe, expect, it } from "vitest";
import type { EntityConfig } from "../../app/configPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import type { WorldConfigBase } from "../../setup/setup";
import { createHeadlessLoop } from "../headlessGameLoop";

function buildHeadlessConfig(): WorldConfigBase {
  const sunId = "planet:sun";
  const earthId = "planet:earth";
  const shipId = "ship:test";

  const sun: EntityConfig = {
    id: sunId,
    metadata: { legacyKind: "star" },
    components: {
      axialSpin: { angularSpeedRadPerSec: 0, obliquityRad: 0 },
      collisionSphere: { radius: 1_000_000 },
      gravityMass: { density: 1_000, physicalRadius: 1_000_000 },
      lightEmitter: { luminosity: 1 },
      state: {
        centralBodyId: sunId,
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
    metadata: { legacyKind: "planet" },
    components: {
      axialSpin: { angularSpeedRadPerSec: 0, obliquityRad: 0 },
      collisionSphere: { radius: 1_000_000 },
      gravityMass: { density: 5_000, physicalRadius: 1_000_000 },
      state: {
        centralBodyId: sunId,
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
  const ship: EntityConfig = {
    id: shipId,
    metadata: { legacyKind: "ship" },
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
    entities: [sun, earth, ship],
    mainControlledEntityId: shipId,
    mainShipId: shipId,
  };
}

describe("headlessGameLoop", () => {
  it("runs a step without any render config", () => {
    const loop = createHeadlessLoop(buildHeadlessConfig(), {
      thrustLevel: 5,
    });

    const output = loop.step(1000, { burnForward: true });

    expect(output.currentThrustLevel).toBeGreaterThan(0);
  });

  it("advances ship position over time", () => {
    const loop = createHeadlessLoop(buildHeadlessConfig());
    const before = vec3.clone(loop.worldAndScene.mainShip.position);

    loop.step(1000);

    const after = loop.worldAndScene.mainShip.position;
    const delta = vec3.subInto(vec3.zero(), after, before);
    expect(vec3.length(delta)).toBeGreaterThan(0);
  });
});
