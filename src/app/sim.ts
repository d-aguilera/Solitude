import type { ControlInput } from "./appPorts.js";
import type { SimControlState } from "./appInternals.js";
import {
  getSignedThrustPercent,
  updateAlignToVelocityFromInput,
  updateThrustMagnitudeFromInput,
} from "./controls.js";

export function updateControlState(
  controlInput: ControlInput,
  controlState: SimControlState,
): number {
  updateThrustMagnitudeFromInput(controlInput, controlState);
  updateAlignToVelocityFromInput(controlInput, controlState);
  return getSignedThrustPercent(controlInput, controlState);
}
