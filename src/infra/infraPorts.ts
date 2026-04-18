import type { WorldAndSceneConfig } from "../app/configPorts";
import type { ControlInput } from "../app/controlPorts";
import type { GamePlugin } from "../app/pluginPorts";
import type { ViewDefinition } from "../app/viewPorts";
import type { GravityEngine } from "../domain/domainPorts";
import type {
  HudRenderer,
  Rasterizer,
  RenderSurface2D,
  ViewRenderer,
} from "../render/renderPorts";

export interface RunLoopView {
  definition: ViewDefinition;
  rasterizer: Rasterizer;
  renderer: ViewRenderer;
  surface: RenderSurface2D;
}

export interface RunLoopParams {
  config: WorldAndSceneConfig;
  views: RunLoopView[];
  hudRenderer: HudRenderer;
  hudRasterizer: Rasterizer;
  gravityEngine: GravityEngine;
  controlInput: ControlInput;
  plugins: GamePlugin[];
}
