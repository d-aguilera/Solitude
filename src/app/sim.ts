import type { ControlInput } from "./appPorts.js";
import type { SimControlState } from "./appInternals.js";
import {
  getSignedThrustPercent,
  updateAlignToVelocityFromInput,
  updateThrustLevelFromInput,
} from "./controls.js";

export function updateControlState(
  controlInput: ControlInput,
  controlState: SimControlState,
): number {
  updateThrustLevelFromInput(controlInput, controlState);
  updateAlignToVelocityFromInput(controlInput, controlState);
  return getSignedThrustPercent(controlInput, controlState);
}
