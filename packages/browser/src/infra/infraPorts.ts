import type { ViewDefinition } from "@solitude/engine/app/viewPorts";
import type { ControlInput, GamePlugin } from "@solitude/engine/plugin";
import type {
  Rasterizer,
  RenderSurface2D,
  ViewRenderer,
} from "@solitude/engine/render/renderPorts";
import type {
  GravityEngine,
  WorldAndSceneConfig,
} from "@solitude/engine/world";
import type { OverlayRasterizer } from "./overlayPorts";

export interface RunLoopView {
  definition: ViewDefinition;
  overlayRasterizer: OverlayRasterizer | null;
  rasterizer: Rasterizer;
  renderer: ViewRenderer;
  surface: RenderSurface2D;
}

export interface RunLoopParams {
  config: WorldAndSceneConfig;
  views: RunLoopView[];
  gravityEngine: GravityEngine;
  controlInput: ControlInput;
  plugins: GamePlugin[];
}
