import type { RenderSurface2D } from "../app/appPorts.js";

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

  clear(color: string): void {
    const { width, height } = this.ctx.canvas;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, width, height);
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}
