import type { AngularVelocity } from "../domain/domainPorts";
import type { LocalFrame } from "../domain/localFrame";
import type { Mat3 } from "../domain/mat3";
import type { Vec3 } from "../domain/vec3";

export const BASE_CONTROL_ACTIONS = [
  "lookLeft",
  "lookRight",
  "lookUp",
  "lookDown",
  "lookReset",
  "camForward",
  "camBackward",
  "camUp",
  "camDown",
] as const;

export type BaseControlAction = (typeof BASE_CONTROL_ACTIONS)[number];
export type ControlAction = string;
export type ControlInput = Record<string, boolean> &
  Record<BaseControlAction, boolean>;

export function createControlInput(
  extraActions: readonly string[] = [],
): ControlInput {
  const result: Record<string, boolean> = {};
  for (const action of BASE_CONTROL_ACTIONS) {
    result[action] = false;
  }
  for (const action of extraActions) {
    result[action] = false;
  }
  return result as ControlInput;
}

/**
 * Desired angular velocity in roll/pitch/yaw (rad/s).
 */
export interface AttitudeCommand {
  roll: number;
  pitch: number;
  yaw: number;
}

/**
 * Simple container for the controlled body's pose and velocity.
 */
export interface ControlledBodyState {
  frame: LocalFrame;
  orientation: Mat3;
  position: Vec3;
  velocity: Vec3;
  angularVelocity: AngularVelocity;
}

export type MutableControlState = Record<string, unknown>;
