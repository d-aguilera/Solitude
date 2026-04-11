import { describe, expect, it } from "vitest";
import type {
  PlanetPhysicsConfig,
  ShipPhysicsConfig,
  StarPhysicsConfig,
  WorldPhysicsConfig,
} from "../../app/configPorts";
import { vec3 } from "../../domain/vec3";
import type { WorldConfigBase } from "../../setup/setup";
import { createHeadlessLoop } from "../headlessGameLoop";

function buildHeadlessConfig(): WorldConfigBase {
  const sunId = "planet:sun";
  const earthId = "planet:earth";
  const shipId = "ship:test";

  const sun: StarPhysicsConfig = {
    id: sunId,
    kind: "star",
    orbit: {
      semiMajorAxis: 0,
      eccentricity: 0,
      inclinationRad: 0,
      lonAscNodeRad: 0,
      argPeriapsisRad: 0,
      meanAnomalyAtEpochRad: 0,
    },
    physicalRadius: 1_000_000,
    density: 1_000,
    centralBodyId: sunId,
    obliquityRad: 0,
    angularSpeedRadPerSec: 0,
    luminosity: 1,
  };

  const earth: PlanetPhysicsConfig = {
    id: earthId,
    kind: "planet",
    orbit: {
      semiMajorAxis: 10_000_000,
      eccentricity: 0,
      inclinationRad: 0,
      lonAscNodeRad: 0,
      argPeriapsisRad: 0,
      meanAnomalyAtEpochRad: 0,
    },
    physicalRadius: 1_000_000,
    density: 5_000,
    centralBodyId: sunId,
    obliquityRad: 0,
    angularSpeedRadPerSec: 0,
  };

  const ship: ShipPhysicsConfig = {
    id: shipId,
    homePlanetId: earthId,
    altitude: 1_000,
    density: 1,
    volume: 1,
  };

  const physics: WorldPhysicsConfig = {
    planets: [sun, earth],
    ships: [ship],
  };

  return {
    enemyShipId: shipId,
    mainShipId: shipId,
    physics,
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
