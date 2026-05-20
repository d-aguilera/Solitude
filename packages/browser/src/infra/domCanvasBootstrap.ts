import type { GamePlugin } from "@solitude/engine/plugin";
import type { Rasterizer, RenderSurface2D } from "@solitude/engine/render";
import type { WorldAndSceneConfig } from "@solitude/engine/world";
import { CanvasHudRasterizer } from "../rasterize/canvas/CanvasHudRasterizer";
import { CanvasRasterizer } from "../rasterize/canvas/CanvasRasterizer";
import { CanvasSurface } from "../rasterize/canvas/CanvasSurface";
import { bootstrapWith } from "./domBootstrap";
import type { OverlayRasterizer } from "./overlayPorts";

/**
 * Canvas 2D DOM-level bootstrap
 */
export function bootstrap(
  config: WorldAndSceneConfig,
  plugins: GamePlugin[],
): void {
  bootstrapWith(
    config,
    makeSurface,
    makeRasterizer,
    makeOverlayRasterizer,
    plugins,
  );
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to get a Canvas 2D context.");
  return context;
}

function makeRasterizer(canvas: HTMLCanvasElement): Rasterizer {
  return new CanvasRasterizer(getContext(canvas));
}

function makeOverlayRasterizer(canvas: HTMLCanvasElement): OverlayRasterizer {
  return new CanvasHudRasterizer(getContext(canvas));
}

function makeSurface(canvas: HTMLCanvasElement): RenderSurface2D {
  return new CanvasSurface(getContext(canvas));
}
