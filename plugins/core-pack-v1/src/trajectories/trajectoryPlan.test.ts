import { vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalControlledBody,
  ExternalEntityConfig,
  ExternalEntityMotionState,
  ExternalWorld,
} from "@solitude/plugin-api/plugin";
import { describe, expect, it } from "vitest";
import {
  buildTrajectoryPlan,
  trajectoryIdForPlanet,
  trajectoryIdForShip,
} from "./trajectoryPlan";

describe("buildTrajectoryPlan", () => {
  it("uses generic controllable bodies and entity states", () => {
    const ship = createShip();
    const planet: ExternalEntityMotionState = {
      id: "planet:test",
      position: vec3.create(1, 0, 0),
      velocity: vec3.create(0, 10, 0),
    };
    const world: ExternalWorld = {
      collisionSpheres: [],
      controllableBodies: [ship],
      entityStates: [ship, planet],
      gravityMasses: [],
    };
    const planetConfig: ExternalEntityConfig = {
      id: planet.id,
      components: {
        state: {
          centralEntityId: "planet:sun",
          kind: "keplerian",
          orbit: {
            eccentricity: 0,
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
    expect(
      plan.find((entry) => entry.pathId === trajectoryIdForShip(ship.id)),
    ).toMatchObject({
      capacity: 720,
      intervalMillis: 2 * 60 * 1000,
    });
  });
});

function createShip(): ExternalControlledBody {
  return {
    frame: {
      forward: vec3.create(0, 1, 0),
      right: vec3.create(1, 0, 0),
      up: vec3.create(0, 0, 1),
    },
    id: "ship:test",
    position: vec3.zero(),
    velocity: vec3.create(0, 1, 0),
  };
}
