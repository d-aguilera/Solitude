import { describe, expect, it } from "vitest";
import type { ControlledBody, World } from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import type { GamePlugin } from "../pluginPorts";
import { validatePluginRequirements } from "../pluginRequirements";
import type { FocusContext } from "../runtimePorts";

function createControlledBody(id: string): ControlledBody {
  const frame = localFrame.fromUp(vec3.create(0, 0, 1));
  return {
    angularVelocity: { pitch: 0, roll: 0, yaw: 0 },
    frame,
    id,
    orientation: localFrame.intoMat3(mat3.zero(), frame),
    position: vec3.zero(),
    velocity: vec3.zero(),
  };
}

function createWorldAndFocus(): { mainFocus: FocusContext; world: World } {
  const controlledBody = createControlledBody("ship:test");
  const world: World = {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [controlledBody],
    entities: [{ id: controlledBody.id }],
    entityIndex: new Map([[controlledBody.id, { id: controlledBody.id }]]),
    entityStates: [controlledBody],
    gravityMasses: [],
    lightEmitters: [],
  };
  return {
    mainFocus: {
      controlledBody,
      entityId: controlledBody.id,
    },
    world,
  };
}

describe("validatePluginRequirements", () => {
  it("accepts satisfied focused body requirements", () => {
    const { mainFocus, world } = createWorldAndFocus();
    const plugin: GamePlugin = {
      id: "spacecraft",
      requirements: {
        mainFocus: [
          "controlledBody",
          "motionState",
          "localFrame",
          "angularVelocity",
        ],
      },
    };

    expect(() =>
      validatePluginRequirements({ mainFocus, plugins: [plugin], world }),
    ).not.toThrow();
  });

  it("fails clearly when a focused capability is missing", () => {
    const { mainFocus, world } = createWorldAndFocus();
    const plugin: GamePlugin = {
      id: "light-demo",
      requirements: {
        mainFocus: ["lightEmitter"],
      },
    };

    expect(() =>
      validatePluginRequirements({ mainFocus, plugins: [plugin], world }),
    ).toThrow(
      'Plugin "light-demo" requires main focus capability "lightEmitter" on entity "ship:test"',
    );
  });
});
