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

/**
 * Ship adapter type extends the domain ShipBody with derived speed
 * for HUD/debug overlays.
 */
export interface Ship extends ShipBody {
  speed: number;
}
