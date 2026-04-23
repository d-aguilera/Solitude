import type { WorldAndSceneConfig } from "../app/configPorts";
import type { RuntimeOptions } from "../app/pluginPorts";
import { CanvasRasterizer } from "../rasterize/canvas/CanvasRasterizer";
import { CanvasSurface } from "../rasterize/canvas/CanvasSurface";
import type { Rasterizer, RenderSurface2D } from "../render/renderPorts";
import { bootstrapWith } from "./domBootstrap";

/**
 * Canvas 2D DOM-level bootstrap
 */
export function bootstrap(
  config: WorldAndSceneConfig,
  runtimeOptions: RuntimeOptions = {},
): void {
  bootstrapWith(config, makeSurface, makeRasterizer, runtimeOptions);
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to get a Canvas 2D context.");
  return context;
}

function makeRasterizer(canvas: HTMLCanvasElement): Rasterizer {
  return new CanvasRasterizer(getContext(canvas));
}

function makeSurface(canvas: HTMLCanvasElement): RenderSurface2D {
  return new CanvasSurface(getContext(canvas));
}
