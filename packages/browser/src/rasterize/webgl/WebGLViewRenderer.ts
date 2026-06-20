import {
  type RenderedView,
  type TextMetrics,
  type ViewLabelMode,
  type ViewRenderer,
  type ViewRenderParams,
} from "@solitude/engine/render";
import { SceneOverlayRenderer } from "@solitude/engine/render/sceneOverlayRenderer";
import { GpuSceneRenderer } from "./GpuSceneRenderer";

export class WebGLViewRenderer implements ViewRenderer {
  private readonly overlayRenderer: SceneOverlayRenderer;

  constructor(
    private readonly gpuRenderer: GpuSceneRenderer,
    measureText: (text: string, font: string) => TextMetrics,
    labelMode: ViewLabelMode,
  ) {
    this.overlayRenderer = new SceneOverlayRenderer(measureText, labelMode);
  }

  renderInto(into: RenderedView, params: ViewRenderParams): void {
    this.gpuRenderer.render(params);
    this.overlayRenderer.renderInto(into, params);
  }

  dispose(): void {
    this.gpuRenderer.dispose();
  }
}
