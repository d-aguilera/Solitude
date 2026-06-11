import type { RenderedView, RenderSurface2D } from "@solitude/engine/render";
import type { RuntimeWorldSnapshot } from "@solitude/engine/runtime";
import { CanvasHudRasterizer } from "../rasterize/canvas/CanvasHudRasterizer";
import { CanvasRasterizer } from "../rasterize/canvas/CanvasRasterizer";
import { CanvasSurface } from "../rasterize/canvas/CanvasSurface";
import type { OverlayRasterizer } from "./overlayPorts";
import {
  createRemoteWorldMultiRenderer,
  createRemoteWorldRenderer,
  rasterizeRenderedView,
  type RemoteWorldMultiRenderer,
  type RemoteWorldMultiRendererOptions,
  type RemoteWorldRenderedView,
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
  readonly overlayRasterizer: OverlayRasterizer;
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

export type RemoteMultiCanvasRendererOptions = Omit<
  RemoteWorldMultiRendererOptions,
  "views"
> & {
  views: {
    canvas: HTMLCanvasElement;
    viewId: string;
  }[];
};

export interface RemoteCanvasRenderedView {
  readonly canvas: HTMLCanvasElement;
  readonly renderedView: RemoteWorldRenderedView;
}

export interface RemoteMultiCanvasRenderer {
  readonly overlayRasterizer: OverlayRasterizer;
  readonly primaryView: RemoteCanvasRenderedView;
  readonly views: readonly RemoteCanvasRenderedView[];
  readonly worldRenderer: RemoteWorldMultiRenderer;
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
  const overlayRasterizer = new CanvasHudRasterizer(context);
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
    overlayRasterizer,
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

export function createRemoteMultiCanvasRenderer({
  views,
  ...options
}: RemoteMultiCanvasRendererOptions): RemoteMultiCanvasRenderer {
  const canvasViews = views.map(({ canvas, viewId }) => {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Failed to get a Canvas 2D context.");
    }
    const rasterizer = new CanvasRasterizer(context);
    return {
      canvas,
      rasterizer,
      surface: new CanvasSurface(context),
      viewId,
    };
  });
  const primaryCanvasView = canvasViews[0];
  if (!primaryCanvasView) {
    throw new Error("At least one remote canvas view is required");
  }

  const worldRenderer = createRemoteWorldMultiRenderer({
    ...options,
    views: canvasViews.map((view) => ({
      measureText: (text, font) => view.rasterizer.measureText(text, font),
      surface: view.surface,
      viewId: view.viewId,
    })),
  });
  const overlayRasterizer = new CanvasHudRasterizer(
    primaryCanvasView.canvas.getContext("2d")!,
  );
  const renderedViews = worldRenderer.views.map((renderedView, index) => ({
    canvas: canvasViews[index].canvas,
    renderedView,
  }));
  const primaryView = requirePrimaryCanvasView(
    renderedViews,
    worldRenderer.primaryView.viewId,
  );

  const rasterizeCurrent = () => {
    for (let i = 0; i < renderedViews.length; i++) {
      rasterizeRenderedView(
        renderedViews[i].renderedView.renderedView,
        canvasViews[i].rasterizer,
      );
    }
  };

  return {
    overlayRasterizer,
    primaryView,
    views: renderedViews,
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

function requirePrimaryCanvasView(
  views: readonly RemoteCanvasRenderedView[],
  primaryViewId: string,
): RemoteCanvasRenderedView {
  for (const view of views) {
    if (view.renderedView.viewId === primaryViewId) return view;
  }
  throw new Error("Required primary remote canvas view not found");
}
