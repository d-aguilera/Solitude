import { createControlInput } from "@solitude/engine/app/controlPorts";
import { createPluginCapabilityRegistry } from "@solitude/engine/app/pluginCapabilities";
import type { SimulationPlugin } from "@solitude/engine/app/pluginPorts";
import type {
  ControlledBody,
  World,
} from "@solitude/engine/domain/domainPorts";
import { localFrame } from "@solitude/engine/domain/localFrame";
import { mat3 } from "@solitude/engine/domain/mat3";
import { vec3 } from "@solitude/engine/domain/vec3";
import { describe, expect, it } from "vitest";
import { createSpacecraftVehicleDynamicsPlugin } from "./core";
import { createSpacecraftOperatorTelemetry } from "./telemetry";

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

function createWorld(...bodies: ControlledBody[]): World {
  return {
    axialSpins: [],
    collisionSpheres: [],
    controllableBodies: bodies,
    entities: bodies.map((body) => ({ id: body.id })),
    entityIndex: new Map(bodies.map((body) => [body.id, { id: body.id }])),
    entityStates: bodies,
    gravityMasses: [],
    lightEmitters: [],
  };
}

function updateVehicleDynamics(
  plugin: SimulationPlugin,
  focusedBody: ControlledBody,
  controlInput = createControlInput(),
  world = createWorld(focusedBody),
): void {
  controlInput.burnForward = true;
  plugin.updateVehicleDynamics?.({
    controlInput,
    dtMillis: 1000,
    dtMillisSim: 1000,
    mainFocus: {
      controlledBody: focusedBody,
      entityId: focusedBody.id,
    },
    world,
  });
}

describe("spacecraft vehicle dynamics plugin", () => {
  it("applies vehicle dynamics to the focused body instead of the legacy main body", () => {
    const focusedBody = createBody("ship:focus");
    const legacyBody = createBody("ship:legacy");
    const plugin = createSpacecraftVehicleDynamicsPlugin(
      [],
      createPluginCapabilityRegistry(),
    );

    updateVehicleDynamics(plugin, focusedBody);

    expect(vec3.length(focusedBody.velocity)).toBeGreaterThan(0);
    expect(vec3.length(legacyBody.velocity)).toBe(0);
  });

  it("writes spacecraft readout levels into plugin telemetry", () => {
    const focusedBody = createBody("ship:focus");
    const telemetry = createSpacecraftOperatorTelemetry();
    const plugin = createSpacecraftVehicleDynamicsPlugin(
      [],
      createPluginCapabilityRegistry(),
      telemetry,
    );

    updateVehicleDynamics(plugin, focusedBody);

    expect(telemetry.currentThrustLevel).toBe(1);
    expect(telemetry.currentRcsLevel).toBe(0);
  });

  it("uses spacecraft propulsion resolver capabilities", () => {
    const focusedBody = createBody("ship:focus");
    const plugin = createSpacecraftVehicleDynamicsPlugin(
      [],
      createPluginCapabilityRegistry([
        {
          id: "spacecraft.propulsionResolver.v1",
          value: {
            resolvePropulsionCommand: () => ({
              main: { forward: 0 },
              rcs: { right: 1 },
            }),
          },
        },
      ]),
    );

    updateVehicleDynamics(plugin, focusedBody);

    expect(
      vec3.dot(focusedBody.velocity, focusedBody.frame.right),
    ).toBeGreaterThan(0);
    expect(vec3.dot(focusedBody.velocity, focusedBody.frame.forward)).toBe(0);
  });

  it("keeps spacecraft control state per focused entity", () => {
    const mainBody = createBody("ship:main");
    const enemyBody = createBody("ship:enemy");
    const world = createWorld(mainBody, enemyBody);
    const telemetry = createSpacecraftOperatorTelemetry();
    const plugin = createSpacecraftVehicleDynamicsPlugin(
      [],
      createPluginCapabilityRegistry(),
      telemetry,
    );

    const mainInput = createControlInput();
    mainInput.thrust5 = true;
    updateVehicleDynamics(plugin, mainBody, mainInput, world);
    expect(telemetry.currentThrustLevel).toBe(5);

    updateVehicleDynamics(plugin, enemyBody, createControlInput(), world);
    expect(telemetry.currentThrustLevel).toBe(1);

    updateVehicleDynamics(plugin, mainBody, createControlInput(), world);
    expect(telemetry.currentThrustLevel).toBe(5);
  });
});
