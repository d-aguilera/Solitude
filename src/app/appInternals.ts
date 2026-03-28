import type { LocalFrame } from "../domain/localFrame.js";
import type { Mat3 } from "../domain/mat3.js";
import type { Vec3 } from "../domain/vec3.js";
import type { Trajectory } from "./runtimePorts.js";
import type { DomainCameraPose } from "./scenePorts.js";

/**
 * Simple container for the controlled body's pose and velocity.
 */
export interface ControlledBodyState {
  frame: LocalFrame;
  orientation: Mat3;
  position: Vec3;
  velocity: Vec3;
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
  alignToVelocity: boolean;
  alignToBody: boolean;
  thrustLevel: number;
}
