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
    components: {
      axialSpin: { angularSpeedRadPerSec: 0, obliquityRad: 0 },
      collisionSphere: { radius: 1_000_000 },
      gravityMass: { density: 1_000, physicalRadius: 1_000_000 },
      lightEmitter: { luminosity: 1 },
      state: {
        centralEntityId: sunId,
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

function createControlledEntity(id: string): EntityConfig {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  return {
    id,
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
    mainFocusEntityId: "ship:main",
  };
}

describe("createWorld", () => {
  it("exposes a generic main focus alias for the configured controlled entity", () => {
    const config = createConfig([
      createSun(),
      createControlledEntity("ship:main"),
    ]);

    const setup = createWorld(config);

    expect(setup.mainFocus.entityId).toBe("ship:main");
    expect(setup.mainFocus.controlledBody.id).toBe("ship:main");
    expect(setup.world.controllableBodies).toContain(
      setup.mainFocus.controlledBody,
    );
    expect(setup.world.lightEmitters.map((light) => light.id)).toEqual([
      "planet:sun",
    ]);
    expect(setup.world.entities).toContainEqual({ id: "ship:main" });
    expect(setup.world.entities).toContainEqual({ id: "planet:sun" });
  });

  it("fails clearly when no plugin contributed a main focus entity id", () => {
    const config = {
      entities: [createSun(), createControlledEntity("ship:main")],
      mainFocusEntityId: "",
    } satisfies WorldConfigBase;

    expect(() => createWorld(config)).toThrow("missing mainFocusEntityId");
  });

  it("fails clearly when the main focus entity config is missing", () => {
    const config = createConfig([
      createSun(),
      createControlledEntity("ship:other"),
    ]);

    expect(() => createWorld(config)).toThrow(
      "Main focus entity config not found: ship:main",
    );
  });

  it("fails clearly when a controlled entity state is missing", () => {
    const controlledEntity = createControlledEntity("ship:main");
    delete controlledEntity.components.state;
    const config = createConfig([createSun(), controlledEntity]);

    expect(() => createWorld(config)).toThrow(
      "Controlled entity is missing direct state: ship:main",
    );
  });

  it("fails clearly when controlled body mass inputs are invalid", () => {
    const controlledEntity = createControlledEntity("ship:main");
    controlledEntity.components.gravityMass = { density: 1, volume: 0 };
    const config = createConfig([createSun(), controlledEntity]);

    expect(() => createWorld(config)).toThrow(
      "Controlled body physics config has invalid volume: ship:main",
    );
  });

  it("fails clearly when the configured main focus entity is not controllable", () => {
    const config: WorldConfigBase = {
      entities: [
        createSun(),
        {
          id: "ship:main",
          components: {},
        },
      ],
      mainFocusEntityId: "planet:sun",
    };

    expect(() => createWorld(config)).toThrow(
      "Main focus entity is not controllable: planet:sun",
    );
  });

  it("fails clearly when rendered controllable entity config is missing", () => {
    const config: WorldAndSceneConfig = {
      entities: [createSun(), createControlledEntity("ship:main")],
      mainFocusEntityId: "ship:main",
      render: {
        mainViewCameraOffset: vec3.zero(),
        mainViewLookState: { azimuth: 0, elevation: 0 },
      },
    };

    const { world } = createWorld(config);

    expect(() => createScene(world, config)).toThrow(
      "Controllable entity render config not found: ship:main",
    );
  });
});
