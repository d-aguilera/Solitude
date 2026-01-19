import type { GravityEngine, Profiler, Vec3 } from "../domain/domainPorts";
import type { Renderer, RenderSurface2D } from "../render/renderPorts";
import type { ControlInput, EnvInput } from "./appInternals";

export type DrawMode = "faces" | "lines";

export interface GameDependencies {
  renderer: Renderer;
  gravityEngine: GravityEngine;
  profiler: Profiler;
  profilerController: ProfilerController;
  pilotSurface: RenderSurface2D;
  topSurface: RenderSurface2D;
}

/**
 * Adapter‑agnostic HUD inputs.
 */
export interface HudRenderData {
  /**
   * Speed in meters per second for the controlled ship.
   */
  speedMps: number;
  /**
   * Latest measured frames per second.
   */
  fps: number;
  /**
   * Whether profiling is currently enabled.
   */
  profilingEnabled: boolean;
  /**
   * Pilot camera offset expressed in the ship's local frame.
   */
  pilotCameraLocalOffset: Vec3;
  /**
   * Signed thrust level in [-1, 1].
   */
  thrustPercent: number;
}

/**
 * Control-side profiling interface.
 *
 * Higher layers (app / infra) use this to configure and drive profiling.
 * Not intended to be depended on by domain logic.
 */
export interface ProfilerController {
  /**
   * Enable or disable profiling globally.
   */
  setEnabled(value: boolean): void;

  /**
   * Query whether profiling is currently enabled.
   */
  isEnabled(): boolean;

  /**
   * Signal paused/unpaused application state so profilers can suspend work.
   */
  setPaused(isPaused: boolean): void;

  /**
   * Advance any internal profiling window, if enabled.
   */
  check(): void;

  /**
   * Flush accumulated counters and timing data, if enabled.
   */
  flush(): void;
}

export type TickCallback = (params: TickParams) => void;

export interface TickParams {
  nowMs: number;
  controlInput: ControlInput;
  envInput: EnvInput;
  profilingEnabled: boolean;
}
