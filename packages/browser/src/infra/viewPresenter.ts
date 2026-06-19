import type {
  RenderedView,
  ViewLabelMode,
  ViewRenderer,
  ViewRenderParams,
} from "@solitude/engine/render";
import { DefaultViewRenderer } from "@solitude/engine/render";
import { CanvasHudRasterizer } from "../rasterize/canvas/CanvasHudRasterizer";
import { CanvasRasterizer } from "../rasterize/canvas/CanvasRasterizer";
import { CanvasSurface } from "../rasterize/canvas/CanvasSurface";
import { GpuSceneRenderer } from "../rasterize/webgl/GpuSceneRenderer";
import { WebGLSurface } from "../rasterize/webgl/WebGLSurface";
import { WebGLViewRenderer } from "../rasterize/webgl/WebGLViewRenderer";
import type { OverlayRasterizer } from "./overlayPorts";
import type { RendererBackend, RenderFailure } from "./rendererBackend";

export interface BrowserViewPresenter extends ViewRenderer {
  readonly backend: RendererBackend;
  readonly overlayRasterizer: OverlayRasterizer;
  readonly rasterizer: CanvasRasterizer;
  readonly surface: CanvasSurface | WebGLSurface;
  dispose: () => void;
  resize: (cssWidth: number, cssHeight: number, pixelRatio: number) => void;
  resizeToDisplaySize: (pixelRatio: number) => void;
}

export interface BrowserViewPresenterOptions {
  backend: RendererBackend;
  labelMode: ViewLabelMode;
  onFatalError: (failure: RenderFailure) => void;
  overlayCanvas: HTMLCanvasElement;
  sceneCanvas: HTMLCanvasElement;
}

export function createBrowserViewPresenter({
  backend,
  labelMode,
  onFatalError,
  overlayCanvas,
  sceneCanvas,
}: BrowserViewPresenterOptions): BrowserViewPresenter {
  const overlayContext = requireCanvasContext(overlayCanvas);
  if (backend === "canvas") {
    const sceneContext = requireCanvasContext(sceneCanvas);
    return createPresenter(
      backend,
      sceneCanvas,
      overlayCanvas,
      new CanvasSurface(sceneContext),
      new CanvasRasterizer(sceneContext, "opaque"),
      new CanvasHudRasterizer(overlayContext, true),
      new DefaultViewRenderer((text, font) => {
        sceneContext.font = font;
        return sceneContext.measureText(text);
      }, labelMode),
      () => {},
    );
  }

  const gl = sceneCanvas.getContext("webgl2");
  if (!gl) {
    const failure: RenderFailure = {
      code: "webgl2-unavailable",
      cause: new Error("WebGL2 context creation returned null"),
    };
    onFatalError(failure);
    throw failure.cause;
  }
  const gpuRenderer = new GpuSceneRenderer({ gl, onFatalError });
  return createPresenter(
    backend,
    sceneCanvas,
    overlayCanvas,
    new WebGLSurface(gl),
    new CanvasRasterizer(overlayContext, "transparent"),
    new CanvasHudRasterizer(overlayContext, false),
    new WebGLViewRenderer(
      gpuRenderer,
      (text, font) => {
        overlayContext.font = font;
        return overlayContext.measureText(text);
      },
      labelMode,
    ),
    () => gpuRenderer.dispose(),
  );
}

function createPresenter(
  backend: RendererBackend,
  sceneCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
  surface: CanvasSurface | WebGLSurface,
  rasterizer: CanvasRasterizer,
  overlayRasterizer: OverlayRasterizer,
  renderer: DefaultViewRenderer | WebGLViewRenderer,
  dispose: () => void,
): BrowserViewPresenter {
  return {
    backend,
    dispose,
    overlayRasterizer,
    rasterizer,
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
    surface,
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
  if (!context) throw new Error("Failed to get a Canvas 2D context");
  return context;
}
