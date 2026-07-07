import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import type { SimulationPlugin } from "@solitude/engine/plugin";
import { createControlInput } from "@solitude/engine/plugin";
import { createPluginCapabilityRegistry } from "@solitude/engine/runtime";
import type { ControlledBody, World } from "@solitude/engine/world";
import { createSpacecraftOperatorTelemetry } from "@solitude/hud/telemetry";
import { describe, expect, it } from "vitest";
import {
  createAutonomousControlProvider,
  createControlPlugin as createAutopilotControlPlugin,
} from "../../../autopilot/core";
import {
  createSpacecraftLocalPredictionProvider,
  createSpacecraftVehicleDynamicsPlugin,
} from "../core";

const EMPTY_ENTITY_CONTROL_INPUTS = new Map();

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
    controlInputsByEntityId: EMPTY_ENTITY_CONTROL_INPUTS,
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

  it("provides local prediction for controllable spacecraft bodies", () => {
    const focusedBody = createBody("ship:focus");
    const world = createWorld(focusedBody);
    const provider = createSpacecraftLocalPredictionProvider();
    const controlInput = createControlInput();
    controlInput.thrust5 = true;
    controlInput.burnForward = true;

    expect(provider.canPredictEntity(focusedBody, world)).toBe(true);

    provider.predictEntity({
      controlInput,
      controlledBody: focusedBody,
      dtMillis: 1000,
      world,
    });

    expect(vec3.length(focusedBody.velocity)).toBeGreaterThan(0);
  });

  it("uses simulation time for thrust while keeping attitude on control time", () => {
    const wallStepBody = createBody("ship:wall");
    const simStepBody = createBody("ship:sim");
    const wallStepPlugin = createSpacecraftVehicleDynamicsPlugin(
      [],
      createPluginCapabilityRegistry(),
    );
    const simStepPlugin = createSpacecraftVehicleDynamicsPlugin(
      [],
      createPluginCapabilityRegistry(),
    );
    const wallStepInput = createControlInput();
    wallStepInput.thrust9 = true;
    wallStepInput.burnForward = true;
    wallStepInput.yawLeft = true;
    const simStepInput = createControlInput();
    simStepInput.thrust9 = true;
    simStepInput.burnForward = true;
    simStepInput.yawLeft = true;

    runVehicleDynamics(
      wallStepPlugin,
      wallStepBody,
      wallStepInput,
      createWorld(wallStepBody),
      100,
      100,
    );
    runVehicleDynamics(
      simStepPlugin,
      simStepBody,
      simStepInput,
      createWorld(simStepBody),
      100,
      1000,
    );

    expect(vec3.length(simStepBody.velocity)).toBeGreaterThan(
      vec3.length(wallStepBody.velocity) * 5,
    );
    expect(simStepBody.angularVelocity.yaw).toBeCloseTo(
      wallStepBody.angularVelocity.yaw,
    );
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
    const blueBody = createBody("ship:1");
    const redBody = createBody("ship:red");
    const world = createWorld(blueBody, redBody);
    const telemetry = createSpacecraftOperatorTelemetry();
    const plugin = createSpacecraftVehicleDynamicsPlugin(
      [],
      createPluginCapabilityRegistry(),
      telemetry,
    );

    const mainInput = createControlInput();
    mainInput.thrust5 = true;
    updateVehicleDynamics(plugin, blueBody, mainInput, world);
    expect(telemetry.currentThrustLevel).toBe(5);

    updateVehicleDynamics(plugin, redBody, createControlInput(), world);
    expect(telemetry.currentThrustLevel).toBe(1);

    updateVehicleDynamics(plugin, blueBody, createControlInput(), world);
    expect(telemetry.currentThrustLevel).toBe(5);
  });

  it("treats released partial attitude inputs as inactive", () => {
    const focusedBody = createBody("ship:focus");
    const plugin = createSpacecraftVehicleDynamicsPlugin(
      [],
      createPluginCapabilityRegistry(),
    );
    const input = createControlInput();
    input.yawLeft = false;

    runVehicleDynamics(plugin, focusedBody, input, createWorld(focusedBody));

    expect(focusedBody.angularVelocity.yaw).toBe(0);
  });

  it("continues autonomous autopilot propulsion on unfocused controlled bodies", () => {
    const blueBody = createBody("ship:1");
    const redBody = createBody("ship:red");
    const world = createWorld(blueBody, redBody);
    const plugin = createSpacecraftVehicleDynamicsPlugin(
      [createAutopilotControlPlugin()],
      createPluginCapabilityRegistry([
        createAutonomousControlProvider(),
        createCircleNowThrustResolver(),
      ]),
    );
    const mainInput = createControlInput();
    mainInput.circleNow = true;

    runVehicleDynamics(plugin, blueBody, mainInput, world);
    const focusedBlueSpeed = vec3.length(blueBody.velocity);

    runVehicleDynamics(plugin, redBody, createControlInput(), world);

    expect(vec3.length(blueBody.velocity)).toBeGreaterThan(focusedBlueSpeed);
    expect(vec3.length(redBody.velocity)).toBe(0);
  });

  it("restores the focused body's stored autopilot mode on focus return", () => {
    const blueBody = createBody("ship:1");
    const redBody = createBody("ship:red");
    const world = createWorld(blueBody, redBody);
    const plugin = createSpacecraftVehicleDynamicsPlugin(
      [createAutopilotControlPlugin()],
      createPluginCapabilityRegistry([
        createAutonomousControlProvider(),
        createCircleNowThrustResolver(),
      ]),
    );
    const mainInput = createControlInput();
    mainInput.circleNow = true;
    runVehicleDynamics(plugin, blueBody, mainInput, world);
    runVehicleDynamics(plugin, redBody, createControlInput(), world);

    const returnInput = createControlInput();
    runVehicleDynamics(plugin, blueBody, returnInput, world);

    expect(returnInput.circleNow).toBe(true);
  });
});

function runVehicleDynamics(
  plugin: SimulationPlugin,
  focusedBody: ControlledBody,
  controlInput: ReturnType<typeof createControlInput>,
  world: World,
  dtMillis = 1000,
  dtMillisSim = 1000,
): void {
  plugin.updateVehicleDynamics?.({
    controlInput,
    controlInputsByEntityId: EMPTY_ENTITY_CONTROL_INPUTS,
    dtMillis,
    dtMillisSim,
    mainFocus: {
      controlledBody: focusedBody,
      entityId: focusedBody.id,
    },
    world,
  });
}

function createCircleNowThrustResolver() {
  return {
    id: "spacecraft.propulsionResolver.v1",
    value: {
      resolvePropulsionCommand: (params: {
        controlInput: ReturnType<typeof createControlInput>;
        manualPropulsion: { main: { forward: number }; rcs: { right: number } };
      }) =>
        params.controlInput.circleNow
          ? { main: { forward: 1 }, rcs: { right: 0 } }
          : params.manualPropulsion,
    },
  };
}
