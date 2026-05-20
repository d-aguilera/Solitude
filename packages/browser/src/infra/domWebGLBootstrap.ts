import type { GamePlugin } from "@solitude/engine/plugin";
import type { Rasterizer, RenderSurface2D } from "@solitude/engine/render";
import type { WorldAndSceneConfig } from "@solitude/engine/world";
import { WebGLRasterizer } from "../rasterize/webgl/WebGLRasterizer";
import { WebGLSurface } from "../rasterize/webgl/WebGLSurface";
import { bootstrapWith } from "./domBootstrap";

/**
 * WebGL DOM-level bootstrap
 */
export function bootstrap(
  config: WorldAndSceneConfig,
  plugins: GamePlugin[],
): void {
  bootstrapWith(config, makeSurface, makeRasterizer, () => null, plugins);
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
