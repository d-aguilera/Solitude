import { describe, expect, it } from "vitest";
import type {
  ShipInitialStateConfig,
  ShipPhysicsConfig,
  StarPhysicsConfig,
  WorldAndSceneConfig,
  WorldPhysicsConfig,
} from "../app/configPorts";
import { localFrame } from "../domain/localFrame";
import { mat3 } from "../domain/mat3";
import { vec3 } from "../domain/vec3";
import { createScene } from "./sceneSetup";
import { createWorld, type WorldConfigBase } from "./setup";

function createSun(): StarPhysicsConfig {
  const sunId = "planet:sun";
  return {
    angularSpeedRadPerSec: 0,
    centralBodyId: sunId,
    density: 1_000,
    id: sunId,
    kind: "star",
    luminosity: 1,
    obliquityRad: 0,
    orbit: {
      argPeriapsisRad: 0,
      eccentricity: 0,
      inclinationRad: 0,
      lonAscNodeRad: 0,
      meanAnomalyAtEpochRad: 0,
      semiMajorAxis: 0,
    },
    physicalRadius: 1_000_000,
  };
}

function createShipPhysics(id: string): ShipPhysicsConfig {
  return {
    density: 1,
    id,
    volume: 1,
  };
}

function createShipInitialState(id: string): ShipInitialStateConfig {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id,
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.create(0, 0, 2_000_000),
    velocity: vec3.create(0, 1_000, 0),
  };
}

function createConfig(physics: WorldPhysicsConfig): WorldConfigBase {
  return {
    mainShipId: "ship:main",
    physics,
  };
}

describe("createWorld", () => {
  it("fails clearly when no plugin contributed a main ship id", () => {
    const config: WorldConfigBase = {
      mainShipId: "",
      physics: {
        planets: [createSun()],
        shipInitialStates: [],
        ships: [],
      },
    };

    expect(() => createWorld(config)).toThrow("missing mainShipId");
  });

  it("fails clearly when the main ship physics config is missing", () => {
    const config = createConfig({
      planets: [createSun()],
      shipInitialStates: [createShipInitialState("ship:main")],
      ships: [],
    });

    expect(() => createWorld(config)).toThrow(
      "Main ship physics config not found: ship:main",
    );
  });

  it("fails clearly when a ship initial state is missing", () => {
    const config = createConfig({
      planets: [createSun()],
      shipInitialStates: [],
      ships: [createShipPhysics("ship:main")],
    });

    expect(() => createWorld(config)).toThrow(
      "Ship initial state not found: ship:main",
    );
  });

  it("fails clearly when ship mass inputs are invalid", () => {
    const config = createConfig({
      planets: [createSun()],
      shipInitialStates: [createShipInitialState("ship:main")],
      ships: [{ ...createShipPhysics("ship:main"), volume: 0 }],
    });

    expect(() => createWorld(config)).toThrow(
      "Ship physics config has invalid volume: ship:main",
    );
  });

  it("fails clearly when the configured main controlled entity is not controllable", () => {
    const config: WorldConfigBase = {
      ...createConfig({
        planets: [createSun()],
        shipInitialStates: [createShipInitialState("ship:main")],
        ships: [createShipPhysics("ship:main")],
      }),
      entities: [
        { id: "planet:sun", components: {} },
        {
          id: "ship:main",
          components: { controllable: { enabled: true } },
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
      entities: [],
      mainControlledEntityId: "ship:main",
      mainShipId: "ship:main",
      physics: {
        planets: [createSun()],
        shipInitialStates: [createShipInitialState("ship:main")],
        ships: [createShipPhysics("ship:main")],
      },
      render: {
        pilotCameraOffset: vec3.zero(),
        pilotLookState: { azimuth: 0, elevation: 0 },
        planets: [],
        ships: [],
      },
      thrustLevel: 1,
    };

    const { world } = createWorld(config);

    expect(() => createScene(world, config)).toThrow(
      "Ship render config not found: ship:main",
    );
  });
});
