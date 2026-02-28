import type { WorldAndSceneConfig } from "../app/appPorts.js";
import { CanvasRasterizer } from "../canvas/CanvasRasterizer.js";
import { CanvasSurface } from "../canvas/CanvasSurface.js";
import type { Rasterizer, RenderSurface2D } from "../render/renderPorts.js";
import { bootstrapWith } from "./domBootstrap.js";

/**
 * Canvas 2D DOM-level bootstrap
 */
export function bootstrap(config: WorldAndSceneConfig): void {
  bootstrapWith(config, makeSurface, makeRasterizer);
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
