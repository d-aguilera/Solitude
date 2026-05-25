import type { RenderedView, RenderSurface2D } from "@solitude/engine/render";
import type { RuntimeWorldSnapshot } from "@solitude/engine/runtime";
import { CanvasRasterizer } from "../rasterize/canvas/CanvasRasterizer";
import { CanvasSurface } from "../rasterize/canvas/CanvasSurface";
import {
  createRemoteWorldRenderer,
  rasterizeRenderedView,
  type RemoteWorldRenderer,
  type RemoteWorldRendererOptions,
  type RemoteWorldRenderOptions,
} from "./remoteWorldRenderer";

export type RemoteCanvasRendererOptions = Omit<
  RemoteWorldRendererOptions,
  "measureText" | "surface"
> & {
  canvas: HTMLCanvasElement;
};

export interface RemoteCanvasRenderer {
  readonly renderedView: RenderedView;
  readonly surface: RenderSurface2D;
  readonly worldRenderer: RemoteWorldRenderer;
  renderCurrent: (options?: RemoteWorldRenderOptions) => void;
  renderSnapshot: (
    snapshot: RuntimeWorldSnapshot,
    options?: RemoteWorldRenderOptions,
  ) => boolean;
  setFocusEntityId: (entityId: string) => boolean;
}

export function createRemoteCanvasRenderer({
  canvas,
  ...options
}: RemoteCanvasRendererOptions): RemoteCanvasRenderer {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get a Canvas 2D context.");
  }

  const rasterizer = new CanvasRasterizer(context);
  const surface = new CanvasSurface(context);
  const worldRenderer = createRemoteWorldRenderer({
    ...options,
    measureText: (text, font) => rasterizer.measureText(text, font),
    surface,
  });

  const rasterizeCurrent = () => {
    rasterizeRenderedView(worldRenderer.renderedView, rasterizer);
  };

  return {
    renderedView: worldRenderer.renderedView,
    surface,
    worldRenderer,
    renderCurrent: (renderOptions) => {
      worldRenderer.renderCurrent(renderOptions);
      rasterizeCurrent();
    },
    renderSnapshot: (snapshot, renderOptions) => {
      if (!worldRenderer.renderSnapshot(snapshot, renderOptions)) return false;
      rasterizeCurrent();
      return true;
    },
    setFocusEntityId: (entityId) => worldRenderer.setFocusEntityId(entityId),
  };
}
