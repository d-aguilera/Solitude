import type { WorldAndSceneConfig } from "@solitude/engine/app/configPorts";
import type { ControlInput } from "@solitude/engine/app/controlPorts";
import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import type { ViewDefinition } from "@solitude/engine/app/viewPorts";
import type { GravityEngine } from "@solitude/engine/domain/domainPorts";
import type {
  HudRenderer,
  Rasterizer,
  RenderSurface2D,
  ViewRenderer,
} from "@solitude/engine/render/renderPorts";

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
