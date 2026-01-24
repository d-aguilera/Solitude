import type { LocalFrame, Vec3 } from "../domain/domainPorts.js";

/**
 * Simple container for the controlled body's pose and velocity.
 */
export interface ControlledBodyState {
  frame: LocalFrame;
  velocity: Vec3;
}

/**
 * Per-player control state that must persist across frames.
 */
export interface ControlState {
  thrustPercent: number;
  look: PilotLookState;
  alignToVelocity: boolean;
}

/**
 * Pilot's view state relative to the controlled vehicle.
 */
export interface PilotLookState {
  azimuth: number;
  elevation: number;
}
