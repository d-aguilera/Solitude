import type { ControlInput, GamePlugin } from "@solitude/engine/plugin";
import type {
  Rasterizer,
  RenderSurface2D,
  ViewDefinition,
  ViewRenderer,
} from "@solitude/engine/render";
import type {
  GravityEngine,
  WorldAndSceneConfig,
} from "@solitude/engine/world";
import type { OverlayRasterizer } from "./overlayPorts";

export interface RunLoopView {
  backend: "canvas" | "webgl";
  definition: ViewDefinition;
  dispose: () => void;
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
