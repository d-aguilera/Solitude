import { describe, expect, it } from "vitest";
import {
  createControlInput,
  type SimControlState,
} from "../../app/controlPorts";
import type { SimulationPlugin } from "../../app/pluginPorts";
import type { ControlledBody, World } from "../../domain/domainPorts";
import { localFrame } from "../../domain/localFrame";
import { mat3 } from "../../domain/mat3";
import { vec3 } from "../../domain/vec3";
import { createSpacecraftVehicleDynamicsPlugin } from "./core";

function createBody(id: string): ControlledBody {
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

function createWorld(focusedBody: ControlledBody): World {
  return {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: [focusedBody],
    entities: [{ id: focusedBody.id }],
    entityIndex: new Map([[focusedBody.id, { id: focusedBody.id }]]),
    entityStates: [focusedBody],
    gravityMasses: [],
    lightEmitters: [],
  };
}

function updateVehicleDynamics(
  plugin: SimulationPlugin,
  focusedBody: ControlledBody,
  legacyBody: ControlledBody,
): void {
  const controlInput = createControlInput();
  controlInput.burnForward = true;
  const controlState: SimControlState = {
    thrustLevel: 9,
  };
  plugin.updateVehicleDynamics?.({
    controlInput,
    controlState,
    dtMillis: 1000,
    dtMillisSim: 1000,
    mainFocus: {
      controlledBody: focusedBody,
      entityId: focusedBody.id,
    },
    mainControlledBody: legacyBody,
    output: {
      currentRcsLevel: 0,
      currentThrustLevel: 0,
    },
    world: createWorld(focusedBody),
  });
}

describe("spacecraft vehicle dynamics plugin", () => {
  it("applies vehicle dynamics to the focused body instead of the legacy main body", () => {
    const focusedBody = createBody("ship:focus");
    const legacyBody = createBody("ship:legacy");
    const plugin = createSpacecraftVehicleDynamicsPlugin([]);

    updateVehicleDynamics(plugin, focusedBody, legacyBody);

    expect(vec3.length(focusedBody.velocity)).toBeGreaterThan(0);
    expect(vec3.length(legacyBody.velocity)).toBe(0);
  });
});
