import { describe, expect, it } from "vitest";
import type { EntityConfig, WorldAndSceneConfig } from "../app/configPorts";
import { localFrame } from "../domain/localFrame";
import { mat3 } from "../domain/mat3";
import { vec3 } from "../domain/vec3";
import { createScene } from "./sceneSetup";
import { createWorld, type WorldConfigBase } from "./setup";

function createSun(): EntityConfig {
  const sunId = "planet:sun";
  return {
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
          argPeriapsisRad: 0,
          eccentricity: 0,
          inclinationRad: 0,
          lonAscNodeRad: 0,
          meanAnomalyAtEpochRad: 0,
          semiMajorAxis: 0,
        },
      },
    },
  };
}

function createShip(id: string): EntityConfig {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  return {
    id,
    metadata: { legacyKind: "ship" },
    components: {
      controllable: { enabled: true },
      gravityMass: { density: 1, volume: 1 },
      state: {
        angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
        frame,
        kind: "direct",
        orientation: localFrame.intoMat3(mat3.zero(), frame),
        position: vec3.create(0, 0, 2_000_000),
        velocity: vec3.create(0, 1_000, 0),
      },
    },
  };
}

function createConfig(entities: EntityConfig[]): WorldConfigBase {
  return {
    entities,
    mainControlledEntityId: "ship:main",
  };
}

describe("createWorld", () => {
  it("fails clearly when no plugin contributed a main controlled entity id", () => {
    const config: WorldConfigBase = {
      entities: [createSun(), createShip("ship:main")],
      mainControlledEntityId: "",
    };

    expect(() => createWorld(config)).toThrow("missing mainControlledEntityId");
  });

  it("fails clearly when the main controlled entity config is missing", () => {
    const config = createConfig([createSun(), createShip("ship:other")]);

    expect(() => createWorld(config)).toThrow(
      "Main controlled entity config not found: ship:main",
    );
  });

  it("fails clearly when a controlled entity state is missing", () => {
    const ship = createShip("ship:main");
    delete ship.components.state;
    const config = createConfig([createSun(), ship]);

    expect(() => createWorld(config)).toThrow(
      "Controlled entity is missing direct state: ship:main",
    );
  });

  it("fails clearly when controlled body mass inputs are invalid", () => {
    const ship = createShip("ship:main");
    ship.components.gravityMass = { density: 1, volume: 0 };
    const config = createConfig([createSun(), ship]);

    expect(() => createWorld(config)).toThrow(
      "Ship physics config has invalid volume: ship:main",
    );
  });

  it("fails clearly when the configured main controlled entity is not controllable", () => {
    const config: WorldConfigBase = {
      entities: [
        createSun(),
        {
          id: "ship:main",
          components: {},
        },
      ],
      mainControlledEntityId: "planet:sun",
    };

    expect(() => createWorld(config)).toThrow(
      "Main controlled entity is not controllable: planet:sun",
    );
  });

  it("fails clearly when rendered ship config is missing", () => {
    const config: WorldAndSceneConfig = {
      entities: [createSun(), createShip("ship:main")],
      mainControlledEntityId: "ship:main",
      render: {
        pilotCameraOffset: vec3.zero(),
        pilotLookState: { azimuth: 0, elevation: 0 },
      },
      thrustLevel: 1,
    };

    const { world } = createWorld(config);

    expect(() => createScene(world, config)).toThrow(
      "Controllable entity render config not found: ship:main",
    );
  });
});
