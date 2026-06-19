import {
  DefaultViewRenderer,
  type RenderedView,
  type TextMetrics,
  type ViewLabelMode,
  type ViewRenderer,
  type ViewRenderParams,
} from "@solitude/engine/render";
import { GpuSceneRenderer } from "./GpuSceneRenderer";

export class WebGLViewRenderer implements ViewRenderer {
  private readonly overlayRenderer: DefaultViewRenderer;

  constructor(
    private readonly gpuRenderer: GpuSceneRenderer,
    measureText: (text: string, font: string) => TextMetrics,
    labelMode: ViewLabelMode,
  ) {
    this.overlayRenderer = new DefaultViewRenderer(measureText, labelMode);
  }

  renderInto(into: RenderedView, params: ViewRenderParams): void {
    this.gpuRenderer.render(params);
    const renderFaces = params.renderFaces;
    const sortFaces = params.sortFaces;
    params.renderFaces = false;
    params.sortFaces = false;
    this.overlayRenderer.renderInto(into, params);
    params.renderFaces = renderFaces;
    params.sortFaces = sortFaces;
  }

  dispose(): void {
    this.gpuRenderer.dispose();
  }
}
