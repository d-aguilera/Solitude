import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import {
  captureRuntimeSnapshot,
  type RuntimeWorldSnapshot,
} from "@solitude/engine/runtime";
import type { EntityConfig, WorldConfigBase } from "@solitude/engine/world";
import { createWorld } from "@solitude/engine/world";
import { describe, expect, it } from "vitest";
import { createRemoteWorldMirror } from "./remoteWorldMirror";

function buildConfig(): WorldConfigBase {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  const craft: EntityConfig = {
    id: "craft:test",
    components: {
      controllable: { enabled: true },
      gravityMass: { density: 1, volume: 1 },
      state: {
        angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
        frame,
        kind: "direct",
        orientation: localFrame.intoMat3(mat3.zero(), frame),
        position: vec3.create(0, 0, 0),
        velocity: vec3.zero(),
      },
    },
  };

  return {
    entities: [craft],
    mainFocusEntityId: craft.id,
  };
}

function createAuthoritativeSnapshot(config: WorldConfigBase) {
  const authoritative = createWorld(config);
  const controlledBody = authoritative.mainFocus.controlledBody;
  controlledBody.position.x = 100;
  controlledBody.velocity.y = 20;
  controlledBody.angularVelocity.roll = 3;
  return captureRuntimeSnapshot(authoritative.world);
}

describe("remote world mirror", () => {
  it("applies authoritative snapshots into local world state", () => {
    const config = buildConfig();
    const mirror = createRemoteWorldMirror(config);
    const controlledBody = mirror.worldSetup.mainFocus.controlledBody;
    const positionAlias = controlledBody.position;
    const orientationAlias = controlledBody.orientation;

    expect(mirror.applySnapshot(createAuthoritativeSnapshot(config))).toBe(
      true,
    );

    expect(controlledBody.position).toBe(positionAlias);
    expect(controlledBody.orientation).toBe(orientationAlias);
    expect(controlledBody.position.x).toBe(100);
    expect(controlledBody.velocity.y).toBe(20);
    expect(controlledBody.angularVelocity.roll).toBe(3);
  });

  it("reuses its apply workspace across snapshots", () => {
    const config = buildConfig();
    const mirror = createRemoteWorldMirror(config);
    const workspace = mirror.applyWorkspace;
    const index = workspace.entityStatesById;
    const snapshot: RuntimeWorldSnapshot = createAuthoritativeSnapshot(config);

    mirror.applySnapshot(snapshot);
    mirror.applySnapshot(snapshot);

    expect(mirror.applyWorkspace).toBe(workspace);
    expect(mirror.applyWorkspace.entityStatesById).toBe(index);
  });
});
