import type {
  DomainWorld,
  LocalFrame,
  ShipBody,
  Vec3,
} from "../domain/domainPorts.js";

/**
 * Adapter-level world state used by the app and renderer.
 */
export interface AppWorld extends DomainWorld {
  shipBodies: Ship[];
}

export interface ControlInput {
  rollLeft: boolean;
  rollRight: boolean;
  pitchUp: boolean;
  pitchDown: boolean;
  yawLeft: boolean;
  yawRight: boolean;
  lookLeft: boolean;
  lookRight: boolean;
  lookUp: boolean;
  lookDown: boolean;
  lookReset: boolean;
  camForward: boolean;
  camBackward: boolean;
  camUp: boolean;
  camDown: boolean;
  burnForward: boolean;
  burnBackwards: boolean;
  thrust0: boolean;
  thrust1: boolean;
  thrust2: boolean;
  thrust3: boolean;
  thrust4: boolean;
  thrust5: boolean;
  thrust6: boolean;
  alignToVelocity: boolean;
}

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
 * Environment-level input.
 */
export interface EnvInput {
  pauseToggle: boolean;
  profilingToggle: boolean;
}

/**
 * Pilot's view state relative to the controlled vehicle.
 */
export interface PilotLookState {
  azimuth: number;
  elevation: number;
}

/**
 * Ship adapter type extends the domain ShipBody with derived speed
 * for HUD/debug overlays.
 */
export interface Ship extends ShipBody {
  speed: number;
}
