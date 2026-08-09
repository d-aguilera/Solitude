import type { Vec3 } from "./math";

export interface ExternalGravityBodyState {
  mass: number;
  velocity: Vec3;
}

export interface ExternalGravityState {
  bodyStates: ExternalGravityBodyState[];
  positions: Vec3[];
}

export interface ExternalGravityEngine {
  step: (dtSeconds: number, state: ExternalGravityState) => void;
}

export interface ExternalGravityProvider {
  createGravityEngine: () => ExternalGravityEngine;
}
