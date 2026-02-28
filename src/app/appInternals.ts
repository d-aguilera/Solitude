import type { BodyId, World } from "../domain/domainPorts.js";
import type { LocalFrame } from "../domain/localFrame.js";
import type { Mat3 } from "../domain/mat3.js";
import type { Vec3 } from "../domain/vec3.js";
import type {
  DomainCameraPose,
  PolylineSceneObject,
  Scene,
} from "./appPorts.js";

/**
 * Simple container for the controlled body's pose and velocity.
 */
export interface ControlledBodyState {
  frame: LocalFrame;
  orientation: Mat3;
  velocity: Vec3;
}

export type Trajectory = {
  intervalMillis: number;
  remainingMillis: number;
  sceneObject: PolylineSceneObject;
};

export interface SceneState {
  pilotCamera: DomainCameraPose;
  planetPathMappings: Record<BodyId, BodyId>;
  scene: Scene;
  speedMps: number;
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

export interface WorldAndScene {
  scene: Scene;
  world: World;
  topCamera: DomainCameraPose;
  pilotCamera: DomainCameraPose;
  planetPathMappings: Record<BodyId, BodyId>;
  trajectories: Record<BodyId, Trajectory>;
}
