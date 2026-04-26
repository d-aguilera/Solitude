import { describe, expect, it } from "vitest";
import { resolveCollisions } from "../collisions";
import type { ShipBody, World } from "../domainPorts";
import { localFrame } from "../localFrame";
import { mat3 } from "../mat3";
import { vec3 } from "../vec3";

function createShip(id: string): ShipBody {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id,
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.create(5, 0, 0),
    velocity: vec3.create(-1, 0, 0),
  };
}

describe("resolveCollisions", () => {
  it("resolves controllable bodies against generic collision spheres", () => {
    const ship = createShip("ship:test");
    const sphereState = {
      id: "body:sphere",
      orientation: mat3.copy(mat3.identity, mat3.zero()),
      position: vec3.zero(),
      velocity: vec3.zero(),
    };
    const world: World = {
      axialSpins: [],
      collisionSpheres: [
        {
          id: sphereState.id,
          radius: 10,
          state: sphereState,
        },
      ],
      controllableBodies: [ship],
      entities: [{ id: ship.id }, { id: sphereState.id }],
      entityIndex: new Map([
        [ship.id, { id: ship.id }],
        [sphereState.id, { id: sphereState.id }],
      ]),
      entityStates: [ship, sphereState],
      gravityMasses: [],
      lightEmitters: [],
      ships: [],
      shipPhysics: [],
      planets: [],
      planetPhysics: [],
      stars: [],
      starPhysics: [],
    };

    resolveCollisions(world);

    expect(ship.position.x).toBe(10);
    expect(ship.velocity.x).toBeGreaterThan(0);
  });
});
