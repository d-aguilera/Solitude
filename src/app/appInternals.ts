import type { AngularVelocity } from "../domain/domainPorts";
import type { LocalFrame } from "../domain/localFrame";
import type { Mat3 } from "../domain/mat3";
import type { Vec3 } from "../domain/vec3";
import type { Trajectory } from "./runtimePorts";
import type { DomainCameraPose } from "./scenePorts";

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

/**
 * Desired angular velocity in roll/pitch/yaw (rad/s).
 */
export interface AttitudeCommand {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface SceneState {
  pilotCamera: DomainCameraPose;
  topCamera: DomainCameraPose;
  trajectoryList: Trajectory[];
}

/**
 * Per-player simulation control state that must persist across frames.
 */
export interface SimControlState {
  thrustLevel: number;
}
