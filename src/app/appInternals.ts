import type { BodyId } from "../domain/domainPorts.js";
import type { LocalFrame } from "../domain/localFrame.js";
import type { Mat3 } from "../domain/mat3.js";
import type { Vec3 } from "../domain/vec3.js";
import type { DomainCameraPose, Trajectory } from "./appPorts.js";

/**
 * Simple container for the controlled body's pose and velocity.
 */
export interface ControlledBodyState {
  frame: LocalFrame;
  orientation: Mat3;
  velocity: Vec3;
}

export interface SceneState {
  pilotCamera: DomainCameraPose;
  topCamera: DomainCameraPose;
  trajectories: Record<BodyId, Trajectory>;
}

/**
 * Per-player simulation control state that must persist across frames.
 */
export interface SimControlState {
  alignToVelocity: boolean;
  thrustLevel: number;
}
