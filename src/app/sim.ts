import type {
  ControlInput,
  SimControlState,
  SimulationState,
} from "./appPorts.js";
import {
  getSignedThrustPercent,
  updateAlignToVelocityFromInput,
  updateShipOrientationFromControls,
  updateThrustMagnitudeFromInput,
} from "./controls.js";
import { integrateForcesAndGravity } from "./physics.js";

export function mutateSimulation(
  dtSeconds: number,
  simState: SimulationState,
  controlState: SimControlState,
  controlInput: ControlInput,
) {
  const {
    gravityBindings,
    gravityEngine,
    gravityState,
    mainShip,
    mainShipBodyState,
    world,
  } = simState;

  updateThrustMagnitudeFromInput(controlInput, controlState);

  simState.currentThrustPercent = getSignedThrustPercent(
    controlInput,
    controlState,
  );

  updateAlignToVelocityFromInput(controlInput, controlState);

  updateShipOrientationFromControls(
    dtSeconds,
    mainShip,
    controlInput,
    controlState,
  );

  integrateForcesAndGravity(
    dtSeconds,
    world,
    mainShip,
    mainShipBodyState,
    gravityEngine,
    gravityState,
    gravityBindings,
    simState.currentThrustPercent,
  );
}
