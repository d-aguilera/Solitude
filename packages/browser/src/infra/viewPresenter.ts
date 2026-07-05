import type { RenderTextureSourceCatalog } from "@solitude/engine/plugin";
import type {
  RenderedView,
  ViewLabelMode,
  ViewRenderer,
  ViewRenderParams,
} from "@solitude/engine/render";
import { CanvasHudRasterizer } from "../rasterize/canvas/CanvasHudRasterizer";
import { CanvasSceneOverlayRasterizer } from "../rasterize/canvas/CanvasSceneOverlayRasterizer";
import { GpuSceneRenderer } from "../rasterize/webgl/GpuSceneRenderer";
import { WebGLSurface } from "../rasterize/webgl/WebGLSurface";
import { WebGLViewRenderer } from "../rasterize/webgl/WebGLViewRenderer";
import type { OverlayRasterizer } from "./overlayPorts";
import type { RenderFailure } from "./renderFailure";

export interface BrowserViewPresenter extends ViewRenderer {
  readonly overlayRasterizer: OverlayRasterizer;
  readonly sceneOverlayRasterizer: CanvasSceneOverlayRasterizer;
  readonly surface: WebGLSurface;
  dispose: () => void;
  resize: (cssWidth: number, cssHeight: number, pixelRatio: number) => void;
  resizeToDisplaySize: (pixelRatio: number) => void;
}

export interface BrowserViewPresenterOptions {
  labelMode: ViewLabelMode;
  onFatalError: (failure: RenderFailure) => void;
  overlayCanvas: HTMLCanvasElement;
  sceneCanvas: HTMLCanvasElement;
  textureSources: RenderTextureSourceCatalog;
}

export function createBrowserViewPresenter({
  labelMode,
  onFatalError,
  overlayCanvas,
  sceneCanvas,
  textureSources,
}: BrowserViewPresenterOptions): BrowserViewPresenter {
  const overlayContext = requireCanvasContext(overlayCanvas);
  const gl = sceneCanvas.getContext("webgl2");
  if (!gl) {
    const failure: RenderFailure = {
      code: "webgl2-unavailable",
      cause: new Error("WebGL2 context creation returned null"),
    };
    onFatalError(failure);
    throw failure.cause;
  }
  const gpuRenderer = new GpuSceneRenderer({
    gl,
    onFatalError,
    textureSources,
  });
  const renderer = new WebGLViewRenderer(
    gpuRenderer,
    (text, font) => {
      overlayContext.font = font;
      return overlayContext.measureText(text);
    },
    labelMode,
  );

  return {
    dispose: () => gpuRenderer.dispose(),
    overlayRasterizer: new CanvasHudRasterizer(overlayContext, false),
    renderInto: (into: RenderedView, params: ViewRenderParams) =>
      renderer.renderInto(into, params),
    resize: (cssWidth, cssHeight, pixelRatio) => {
      resizeCanvas(sceneCanvas, cssWidth, cssHeight, pixelRatio);
      resizeCanvas(overlayCanvas, cssWidth, cssHeight, pixelRatio);
    },
    resizeToDisplaySize: (pixelRatio) => {
      const width = sceneCanvas.clientWidth;
      const height = sceneCanvas.clientHeight;
      if (width > 0 && height > 0) {
        resizeCanvas(sceneCanvas, width, height, pixelRatio);
        resizeCanvas(overlayCanvas, width, height, pixelRatio);
      }
    },
    sceneOverlayRasterizer: new CanvasSceneOverlayRasterizer(overlayContext),
    surface: new WebGLSurface(gl),
  };
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number,
): void {
  const deviceWidth = Math.round(cssWidth * pixelRatio);
  const deviceHeight = Math.round(cssHeight * pixelRatio);
  if (canvas.width === deviceWidth && canvas.height === deviceHeight) return;
  canvas.width = deviceWidth;
  canvas.height = deviceHeight;
}

function requireCanvasContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to get Canvas 2D context");
  return context;
}
