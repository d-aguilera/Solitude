import type { ControlInput, GamePlugin } from "@solitude/engine/plugin";
import type {
  RenderSurface2D,
  ViewDefinition,
  ViewRenderer,
} from "@solitude/engine/render";
import type { SceneOverlayRasterizer } from "@solitude/engine/render/ports";
import type { WorldAndSceneConfig } from "@solitude/engine/world";
import type { OverlayRasterizer } from "./overlayPorts";

export interface RunLoopView {
  definition: ViewDefinition;
  dispose: () => void;
  overlayRasterizer: OverlayRasterizer | null;
  sceneOverlayRasterizer: SceneOverlayRasterizer;
  renderer: ViewRenderer;
  surface: RenderSurface2D;
}

export interface RunLoopParams {
  config: WorldAndSceneConfig;
  onError: (error: unknown) => void;
  views: RunLoopView[];
  controlInput: ControlInput;
  plugins: GamePlugin[];
}
