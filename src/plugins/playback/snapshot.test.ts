import { describe, expect, it } from "vitest";
import type { ShipBody, World } from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import { applyPlaybackSnapshot, capturePlaybackSnapshot } from "./snapshot";

function createWorld(): { world: World; ship: ShipBody } {
  const ship: ShipBody = {
    id: "ship:test",
    position: vec3.create(1, 2, 3),
    velocity: vec3.create(4, 5, 6),
    frame: localFrame.fromUp(vec3.create(0, 0, 1)),
    orientation: mat3.zero(),
    angularVelocity: { roll: 1, pitch: 2, yaw: 3 },
  };
  localFrame.intoMat3(ship.orientation, ship.frame);

  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [ship],
    entities: [{ id: ship.id }, { id: "planet:test" }],
    entityIndex: new Map(),
    entityStates: [],
    gravityMasses: [],
    lightEmitters: [],
    ships: [ship],
    shipPhysics: [{ id: ship.id, density: 1, mass: 1 }],
    planets: [
      {
        id: "planet:test",
        position: vec3.create(10, 0, 0),
        velocity: vec3.create(0, 10, 0),
        orientation: mat3.zero(),
        rotationAxis: vec3.create(0, 0, 1),
        angularSpeedRadPerSec: 0,
      },
    ],
    planetPhysics: [
      {
        id: "planet:test",
        density: 1,
        mass: 10,
        physicalRadius: 1,
      },
    ],
    stars: [],
    starPhysics: [],
  };
  world.entityIndex.set(ship.id, world.entities[0]);
  world.entityIndex.set("planet:test", world.entities[1]);
  world.entityStates.push(ship, world.planets[0]);
  world.gravityMasses.push(
    { id: ship.id, density: 1, mass: 1, state: ship },
    { id: "planet:test", density: 1, mass: 10, state: world.planets[0] },
  );
  world.collisionSpheres.push({
    id: "planet:test",
    radius: 1,
    state: world.planets[0],
  });
  mat3.copy(mat3.identity, world.planets[0].orientation);
  return { world, ship };
}

describe("playback snapshots", () => {
  it("applies snapshots in place", () => {
    const { world, ship } = createWorld();
    const positionAlias = ship.position;
    const orientationAlias = ship.orientation;
    const snapshot = capturePlaybackSnapshot(world, ship, "moon-circle", 123);

    ship.position.x = 99;
    ship.orientation[0][0] = 42;

    expect(applyPlaybackSnapshot(snapshot, world)).toBe(true);
    expect(ship.position).toBe(positionAlias);
    expect(ship.orientation).toBe(orientationAlias);
    expect(ship.position.x).toBe(1);
    expect(ship.orientation[0][0]).toBe(snapshot.ships[0].orientation[0][0]);
    expect(snapshot.entities?.map((entity) => entity.id)).toEqual([
      "ship:test",
      "planet:test",
    ]);
  });

  it("captures and applies generic entity snapshots without legacy buckets", () => {
    const ship: ShipBody = {
      id: "ship:generic",
      position: vec3.create(10, 0, 0),
      velocity: vec3.create(0, 10, 0),
      frame: localFrame.fromUp(vec3.create(0, 0, 1)),
      orientation: mat3.zero(),
      angularVelocity: { roll: 0, pitch: 0, yaw: 0 },
    };
    localFrame.intoMat3(ship.orientation, ship.frame);
    const world: World = {
      axialSpins: [],
      collisionSpheres: [],
      controllableBodies: [ship],
      entities: [{ id: ship.id }],
      entityIndex: new Map([[ship.id, { id: ship.id }]]),
      entityStates: [ship],
      gravityMasses: [{ id: ship.id, density: 1, mass: 1, state: ship }],
      lightEmitters: [],
      ships: [],
      shipPhysics: [],
      planets: [],
      planetPhysics: [],
      stars: [],
      starPhysics: [],
    };
    const snapshot = capturePlaybackSnapshot(world, ship, "moon-circle", 123);

    ship.position.x = 99;
    ship.velocity.y = 42;

    expect(snapshot.ships).toEqual([]);
    expect(snapshot.entities?.[0].frame).toBeDefined();
    expect(applyPlaybackSnapshot(snapshot, world)).toBe(true);
    expect(ship.position.x).toBe(10);
    expect(ship.velocity.y).toBe(10);
  });
});
