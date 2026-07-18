import { describe, expect, it } from "vitest";
import {
  applyRuntimeSnapshot,
  applyRuntimeSnapshotWithWorkspace,
  captureRuntimeSnapshot,
  captureRuntimeSnapshotInto,
  createRuntimeSnapshot,
  createRuntimeSnapshotApplyWorkspace,
  refreshRuntimeSnapshotApplyWorkspace,
} from "../../app/runtimeSnapshot";
import type {
  ControlledBody,
  EntityMotionState,
  World,
} from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";

function createWorld(): { world: World; ship: ControlledBody } {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  const ship: ControlledBody = {
    angularVelocity: { roll: 1, pitch: 2, yaw: 3 },
    frame,
    id: "ship:test",
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.create(1, 2, 3),
    velocity: vec3.create(4, 5, 6),
  };
  const planet: EntityMotionState = {
    id: "planet:test",
    orientation: mat3.copy(mat3.identity, mat3.zero()),
    position: vec3.create(10, 0, 0),
    velocity: vec3.create(0, 10, 0),
  };
  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [ship],
    entities: [{ id: ship.id }, { id: planet.id }],
    entityIndex: new Map([
      [ship.id, { id: ship.id }],
      [planet.id, { id: planet.id }],
    ]),
    entityStates: [ship, planet],
    gravityMasses: [],
    lightEmitters: [],
  };
  return { world, ship };
}

describe("runtime snapshots", () => {
  it("captures and applies generic entity state in place", () => {
    const { world, ship } = createWorld();
    const positionAlias = ship.position;
    const orientationAlias = ship.orientation;
    const snapshot = captureRuntimeSnapshot(world);

    ship.position.x = 99;
    ship.orientation[0][0] = 42;

    expect(applyRuntimeSnapshot(snapshot, world)).toBe(true);
    expect(ship.position).toBe(positionAlias);
    expect(ship.orientation).toBe(orientationAlias);
    expect(ship.position.x).toBe(1);
    expect(ship.orientation[0][0]).toBe(snapshot.entities[0].orientation[0][0]);
    expect(snapshot.entities.map((entity) => entity.id)).toEqual([
      "ship:test",
      "planet:test",
    ]);
  });

  it("captures controllable frame and angular velocity when present", () => {
    const { world, ship } = createWorld();
    const snapshot = captureRuntimeSnapshot(world);

    ship.frame.forward.x = 99;
    ship.angularVelocity.roll = 42;

    expect(snapshot.entities[0].frame).toBeDefined();
    expect(snapshot.entities[0].angularVelocity).toBeDefined();
    expect(applyRuntimeSnapshot(snapshot, world)).toBe(true);
    expect(ship.frame.forward.x).toBe(snapshot.entities[0].frame?.forward.x);
    expect(ship.angularVelocity.roll).toBe(1);
  });

  it("can capture repeatedly into reusable snapshot storage", () => {
    const { world, ship } = createWorld();
    const snapshot = createRuntimeSnapshot();
    captureRuntimeSnapshotInto(snapshot, world);
    const entityAlias = snapshot.entities[0];
    const positionAlias = entityAlias.position;
    const orientationAlias = entityAlias.orientation;
    const frameAlias = entityAlias.frame;
    const angularVelocityAlias = entityAlias.angularVelocity;

    ship.position.x = 99;
    ship.velocity.y = 42;
    ship.angularVelocity.roll = 7;
    captureRuntimeSnapshotInto(snapshot, world);

    expect(snapshot.entities[0]).toBe(entityAlias);
    expect(snapshot.entities[0].position).toBe(positionAlias);
    expect(snapshot.entities[0].orientation).toBe(orientationAlias);
    expect(snapshot.entities[0].frame).toBe(frameAlias);
    expect(snapshot.entities[0].angularVelocity).toBe(angularVelocityAlias);
    expect(snapshot.entities[0].position.x).toBe(99);
    expect(snapshot.entities[0].velocity.y).toBe(42);
    expect(snapshot.entities[0].angularVelocity?.roll).toBe(7);
  });

  it("can apply snapshots through a reusable entity-state index", () => {
    const { world, ship } = createWorld();
    const snapshot = captureRuntimeSnapshot(world);
    const workspace = createRuntimeSnapshotApplyWorkspace(world);
    const indexAlias = workspace.entityStatesById;

    ship.position.x = 99;

    expect(applyRuntimeSnapshotWithWorkspace(snapshot, workspace)).toBe(true);
    expect(workspace.entityStatesById).toBe(indexAlias);
    expect(ship.position.x).toBe(1);
  });

  it("can refresh the apply workspace when world entity membership changes", () => {
    const { world } = createWorld();
    const workspace = createRuntimeSnapshotApplyWorkspace(world);
    const indexAlias = workspace.entityStatesById;
    const added: EntityMotionState = {
      id: "body:added",
      orientation: mat3.copy(mat3.identity, mat3.zero()),
      position: vec3.create(20, 0, 0),
      velocity: vec3.zero(),
    };

    world.entityStates.push(added);
    refreshRuntimeSnapshotApplyWorkspace(workspace, world);

    expect(workspace.entityStatesById).toBe(indexAlias);
    expect(workspace.entityStatesById.get(added.id)).toBe(added);
  });
});
