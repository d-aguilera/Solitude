import { mat3, vec3 } from "@solitude/plugin-api/math";
import type {
  ExternalRuntimeSnapshotService,
  ExternalRuntimeWorldSnapshot,
} from "@solitude/plugin-api/snapshots";
import type {
  ExternalControlledBody,
  ExternalWorld,
} from "@solitude/plugin-api/world";
import { describe, expect, it, vi } from "vitest";
import {
  applyPlaybackSnapshot,
  capturePlaybackSnapshot,
} from "../../playback/snapshot";

function createWorld(): {
  world: ExternalWorld;
  ship: ExternalControlledBody;
} {
  const ship: ExternalControlledBody = {
    angularVelocity: { roll: 1, pitch: 2, yaw: 3 },
    frame: createFrame(),
    id: "ship:test",
    position: vec3.create(1, 2, 3),
    velocity: vec3.create(4, 5, 6),
  };
  const planet = {
    id: "planet:test",
    position: vec3.create(10, 0, 0),
    velocity: vec3.create(0, 10, 0),
  };

  const world: ExternalWorld = {
    collisionSpheres: [
      {
        id: "planet:test",
        radius: 1,
        state: planet,
      },
    ],
    controllableBodies: [ship],
    entityStates: [ship, planet],
    gravityMasses: [
      { id: ship.id, mass: 1, state: ship },
      { id: "planet:test", mass: 10, state: planet },
    ],
  };
  return { world, ship };
}

describe("playback snapshots", () => {
  it("adds playback metadata to the canonical runtime snapshot", () => {
    const { world, ship } = createWorld();
    const runtimeSnapshot = createRuntimeSnapshot();
    const snapshots: ExternalRuntimeSnapshotService = {
      apply: vi.fn(),
      capture: vi.fn(() => runtimeSnapshot),
    };
    const snapshot = capturePlaybackSnapshot(
      snapshots,
      world,
      ship,
      "moon-circle",
      123,
    );

    expect(snapshots.capture).toHaveBeenCalledWith(world);
    expect(snapshot.entities).toBe(runtimeSnapshot.entities);
    expect(snapshot.metadata.focusEntityId).toBe("ship:test");
    expect(snapshot.metadata.capturedSimTimeMillis).toBe(123);
    expect(snapshot.metadata.label).toBe("moon-circle");
  });

  it("delegates runtime snapshot application to the host", () => {
    const { world } = createWorld();
    const snapshots: ExternalRuntimeSnapshotService = {
      apply: vi.fn(() => true),
      capture: vi.fn(),
    };
    const snapshot = {
      metadata: {
        capturedSimTimeMillis: 123,
        dominantBodyId: "planet:test",
        focusEntityId: "ship:test",
        label: "moon-circle",
      },
      entities: createRuntimeSnapshot().entities,
    };

    expect(applyPlaybackSnapshot(snapshots, snapshot, world)).toBe(true);
    expect(snapshots.apply).toHaveBeenCalledWith(
      { entities: snapshot.entities },
      world,
    );
  });
});

function createRuntimeSnapshot(): ExternalRuntimeWorldSnapshot {
  return {
    entities: [
      {
        angularVelocity: { pitch: 2, roll: 1, yaw: 3 },
        frame: createFrame(),
        id: "ship:test",
        orientation: mat3.identity,
        position: vec3.create(1, 2, 3),
        velocity: vec3.create(4, 5, 6),
      },
      {
        id: "planet:test",
        orientation: mat3.identity,
        position: vec3.create(10, 0, 0),
        velocity: vec3.create(0, 10, 0),
      },
    ],
  };
}

function createFrame(): ExternalControlledBody["frame"] {
  return {
    forward: vec3.create(1, 0, 0),
    right: vec3.create(0, -1, 0),
    up: vec3.create(0, 0, 1),
  };
}
