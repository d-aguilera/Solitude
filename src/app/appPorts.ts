import type { LocalFrame, Vec3 } from "../domain/domainPorts.js";
import { View } from "../render/projection/View.js";
import {
  DrawMode,
  ViewDebugOverlay,
} from "../render/projection/ViewDebugOverlay.js";
import { Profiler } from "./profilingPorts.js";
import { Plane, WorldState } from "./worldState.js";

/**
 * Environment wiring owned by the outermost bootstrap.
 */
export interface AppEnvironment {
  container: Element;
  pilotCanvas: HTMLCanvasElement;
  topCanvas: HTMLCanvasElement;
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
}

/**
 * Pilot's view state relative to the controlled vehicle.
 */
export interface PilotLookState {
  azimuth: number;
  elevation: number;
}

/**
 * Top‑level rendering abstraction for the app layer.
 *
 * This interface intentionally does not depend on Scene or any
 * view‑composition types. The app is responsible for mapping
 * world state into whatever view configuration is needed before
 * calling into a concrete renderer.
 */
export interface Renderer {
  renderFrame(params: {
    world: WorldState;
    mainPlane: Plane;
    pilotContext: CanvasRenderingContext2D;
    topContext: CanvasRenderingContext2D;
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
    profilingEnabled: boolean;
  }): void;
}

/**
 * Adapter-level container describing how a single view
 * should render the current scene for this frame.
 *
 * Built by the app layer from world state and then passed
 * into the Renderer implementation.
 */
export interface ViewConfig {
  view: View;
  debugOverlay?: ViewDebugOverlay;
  referencePlane: Plane;
  drawMode: DrawMode;
} // Default draw mode for rendering (faces or lines).

export const DEFAULT_DRAW_MODE: DrawMode = "faces";
