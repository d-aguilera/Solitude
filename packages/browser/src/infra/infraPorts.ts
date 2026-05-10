import type { WorldAndSceneConfig } from "@solitude/engine/app/configPorts";
import type { ControlInput } from "@solitude/engine/app/controlPorts";
import type { GamePlugin } from "@solitude/engine/app/pluginPorts";
import type { ViewDefinition } from "@solitude/engine/app/viewPorts";
import type { GravityEngine } from "@solitude/engine/domain/domainPorts";
import type {
  Rasterizer,
  RenderSurface2D,
  ViewRenderer,
} from "@solitude/engine/render/renderPorts";
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
