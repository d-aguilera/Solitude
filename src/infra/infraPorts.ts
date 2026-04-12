import type { WorldAndSceneConfig } from "../app/configPorts";
import type { ControlInput } from "../app/controlPorts";
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
  leftViewRenderer: ViewRenderer;
  leftRasterizer: Rasterizer;
  rightViewRenderer: ViewRenderer;
  rightRasterizer: Rasterizer;
  rearViewRenderer: ViewRenderer;
  rearRasterizer: Rasterizer;
  hudRenderer: HudRenderer;
  hudRasterizer: Rasterizer;
  gravityEngine: GravityEngine;
  pilotSurface: RenderSurface2D;
  topSurface: RenderSurface2D;
  leftSurface: RenderSurface2D;
  rightSurface: RenderSurface2D;
  rearSurface: RenderSurface2D;
  controlInput: ControlInput;
  plugins: GamePlugin[];
}
