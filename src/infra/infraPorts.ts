import type { WorldAndSceneConfig } from "../app/configPorts";
import type { ControlInput, EnvInput } from "../app/controlPorts";
import type { GamePlugin } from "../app/pluginPorts";
import type { GravityEngine } from "../domain/domainPorts";
import type {
  HudRenderer,
  Rasterizer,
  RenderSurface2D,
  ViewRenderer,
} from "../render/renderPorts";

/**
 * Control-side profiling interface.
 */
export interface ProfilerController {
  /**
   * Enable or disable profiling globally.
   */
  setEnabled(value: boolean): void;

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

export interface RunLoopParams {
  config: WorldAndSceneConfig;
  pilotViewRenderer: ViewRenderer;
  pilotRasterizer: Rasterizer;
  topViewRenderer: ViewRenderer;
  topRasterizer: Rasterizer;
  hudRenderer: HudRenderer;
  hudRasterizer: Rasterizer;
  gravityEngine: GravityEngine;
  pilotSurface: RenderSurface2D;
  topSurface: RenderSurface2D;
  controlInput: ControlInput;
  envInput: EnvInput;
  profilerController: ProfilerController;
  plugins: GamePlugin[];
}
