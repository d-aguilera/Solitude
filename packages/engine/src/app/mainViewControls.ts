import type { ControlInput } from "./controlPorts";
import type { MainViewLookState } from "./scenePorts";

// Main-view look rates are in radians per millisecond.
const lookSpeed = 0.0015;

/**
 * Update main-view look angles in-place based on input.
 */
export function updateMainViewLook(
  dtMillis: number,
  controlInput: ControlInput,
  lookState: MainViewLookState,
): void {
  if (controlInput.lookReset) {
    lookState.azimuth = 0;
    lookState.elevation = 0;
  }

  if (controlInput.lookLeft) lookState.azimuth += lookSpeed * dtMillis;
  if (controlInput.lookRight) lookState.azimuth -= lookSpeed * dtMillis;
  if (controlInput.lookUp) lookState.elevation += lookSpeed * dtMillis;
  if (controlInput.lookDown) lookState.elevation -= lookSpeed * dtMillis;
}
