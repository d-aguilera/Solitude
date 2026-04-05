import type { RenderSurface2D } from "../../render/renderPorts";

export class WebGLSurface implements RenderSurface2D {
  constructor(private readonly gl: WebGL2RenderingContext) {}

  get width(): number {
    return this.gl.drawingBufferWidth;
  }

  get height(): number {
    return this.gl.drawingBufferHeight;
  }
}
