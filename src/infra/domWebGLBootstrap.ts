import type { WorldAndSceneConfig } from "../app/configPorts";
import type { GamePlugin } from "../app/pluginPorts";
import { WebGLRasterizer } from "../rasterize/webgl/WebGLRasterizer";
import { WebGLSurface } from "../rasterize/webgl/WebGLSurface";
import type { Rasterizer, RenderSurface2D } from "../render/renderPorts";
import { bootstrapWith } from "./domBootstrap";

/**
 * WebGL DOM-level bootstrap
 */
export function bootstrap(
  config: WorldAndSceneConfig,
  plugins: GamePlugin[],
): void {
  bootstrapWith(config, makeSurface, makeRasterizer, plugins);
}

function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const context = canvas.getContext("webgl2");
  if (!context) throw new Error("Failed to get a WebGL context.");
  return context;
}

function makeRasterizer(canvas: HTMLCanvasElement): Rasterizer {
  return new WebGLRasterizer(getContext(canvas));
}

function makeSurface(canvas: HTMLCanvasElement): RenderSurface2D {
  return new WebGLSurface(getContext(canvas));
}
