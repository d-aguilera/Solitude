import type { RenderSurface2D } from "../../render/renderPorts.js";

/**
 * Canvas-backed implementation of RenderSurface2D.
 */
export class CanvasSurface implements RenderSurface2D {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  get width(): number {
    return this.ctx.canvas.width;
  }

  get height(): number {
    return this.ctx.canvas.height;
  }
}
