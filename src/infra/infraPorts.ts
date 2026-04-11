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
  plugins: GamePlugin[];
}
