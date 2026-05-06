import type { EntityConfig } from "@solitude/engine/app/configPorts";
import type {
  ControlledBody,
  EntityMotionState,
  World,
} from "@solitude/engine/domain/domainPorts";
import { localFrame } from "@solitude/engine/domain/localFrame";
import { mat3 } from "@solitude/engine/domain/mat3";
import { vec3 } from "@solitude/engine/domain/vec3";
import { describe, expect, it } from "vitest";
import {
  buildTrajectoryPlan,
  trajectoryIdForPlanet,
  trajectoryIdForShip,
} from "./trajectoryPlan";

function createShip(): ControlledBody {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id: "ship:test",
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.zero(),
    velocity: vec3.create(0, 1, 0),
  };
}

function createPlanet(): EntityMotionState {
  return {
    id: "planet:test",
    orientation: mat3.copy(mat3.identity, mat3.zero()),
    position: vec3.create(1, 0, 0),
    velocity: vec3.create(0, 10, 0),
  };
}

describe("buildTrajectoryPlan", () => {
  it("uses generic controllable bodies and entity states", () => {
    const ship = createShip();
    const planet = createPlanet();
    const world: World = {
      axialSpins: [],
      collisionSpheres: [],
      controllableBodies: [ship],
      entities: [{ id: ship.id }, { id: planet.id }],
      entityIndex: new Map(),
      entityStates: [ship, planet],
      gravityMasses: [],
      lightEmitters: [],
    };
    const planetConfig: EntityConfig = {
      id: planet.id,
      components: {
        state: {
          centralEntityId: "planet:sun",
          kind: "keplerian",
          orbit: {
            argPeriapsisRad: 0,
            eccentricity: 0,
            inclinationRad: 0,
            lonAscNodeRad: 0,
            meanAnomalyAtEpochRad: 0,
            semiMajorAxis: 100,
          },
        },
      },
    };

    const plan = buildTrajectoryPlan(world, [planetConfig]);

    expect(plan.map((entry) => entry.pathId)).toEqual([
      trajectoryIdForShip(ship.id),
      trajectoryIdForPlanet(planet.id),
    ]);
  });
});
