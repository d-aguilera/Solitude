import { describe, expect, it } from "vitest";
import type { PlanetPhysicsConfig } from "../../app/configPorts";
import type {
  EntityMotionState,
  ShipBody,
  World,
} from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import {
  buildTrajectoryPlan,
  trajectoryIdForPlanet,
  trajectoryIdForShip,
} from "./trajectoryPlan";

function createShip(): ShipBody {
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
    const planetConfig: PlanetPhysicsConfig = {
      angularSpeedRadPerSec: 0,
      centralBodyId: "planet:sun",
      density: 1,
      id: planet.id,
      kind: "planet",
      obliquityRad: 0,
      orbit: {
        argPeriapsisRad: 0,
        eccentricity: 0,
        inclinationRad: 0,
        lonAscNodeRad: 0,
        meanAnomalyAtEpochRad: 0,
        semiMajorAxis: 100,
      },
      physicalRadius: 1,
    };

    const plan = buildTrajectoryPlan(world, [planetConfig]);

    expect(plan.map((entry) => entry.pathId)).toEqual([
      trajectoryIdForShip(ship.id),
      trajectoryIdForPlanet(planet.id),
    ]);
  });
});
