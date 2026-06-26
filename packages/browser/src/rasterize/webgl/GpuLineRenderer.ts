import type { ViewRenderParams } from "@solitude/engine/render";
import { renderNearDepth } from "@solitude/engine/render/parameters";
import type { ProjectionService } from "@solitude/engine/render/projectionService";
import {
  GpuLineRibbonBuilder,
  gpuLineRibbonFloatsPerVertex,
} from "./GpuLineRibbonBuilder";
import fragmentShaderSource from "./shaders/polylineRibbon.frag.glsl?raw";
import vertexShaderSource from "./shaders/polylineRibbon.vert.glsl?raw";
import {
  createProgramFromSources,
  requireResource,
  requireUniform,
} from "./webglProgram";

const bytesPerFloat = 4;
const stride = gpuLineRibbonFloatsPerVertex * bytesPerFloat;

export class GpuLineRenderer {
  private readonly buffer: WebGLBuffer;
  private readonly builder = new GpuLineRibbonBuilder();
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly uniforms: {
    logDepthRange: WebGLUniformLocation;
    nearDepth: WebGLUniformLocation;
  };

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgramFromSources(
      gl,
      vertexShaderSource,
      fragmentShaderSource,
    );
    this.vao = requireResource(gl.createVertexArray(), "line vertex array");
    this.buffer = requireResource(gl.createBuffer(), "line buffer");
    this.uniforms = {
      logDepthRange: requireUniform(gl, this.program, "uLogDepthRange"),
      nearDepth: requireUniform(gl, this.program, "uNearDepth"),
    };

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    configureAttributes(gl, this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }

  render(
    params: ViewRenderParams,
    projectionService: ProjectionService,
    logDepthRange: number,
  ): void {
    const data = this.builder.build({
      objects: params.scene.objects,
      objectsFilter: params.objectsFilter,
      projectionService,
      renderPolylines: params.renderPolylines,
      renderSegments: params.renderSegments,
      surfaceHeight: params.surface.height,
      surfaceWidth: params.surface.width,
      worldSegments: params.worldSegments,
    });
    const vertexCount = this.builder.getVertexCount();
    if (vertexCount === 0) return;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.uniform1f(this.uniforms.nearDepth, renderNearDepth);
    gl.uniform1f(this.uniforms.logDepthRange, logDepthRange);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    try {
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    } finally {
      gl.depthMask(true);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.buffer);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }
}

function configureAttributes(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): void {
  for (const name of ["aClipPosition", "aCameraDepth", "aColor"]) {
    gl.enableVertexAttribArray(gl.getAttribLocation(program, name));
  }
  gl.vertexAttribPointer(
    gl.getAttribLocation(program, "aClipPosition"),
    4,
    gl.FLOAT,
    false,
    stride,
    0,
  );
  gl.vertexAttribPointer(
    gl.getAttribLocation(program, "aCameraDepth"),
    1,
    gl.FLOAT,
    false,
    stride,
    4 * bytesPerFloat,
  );
  gl.vertexAttribPointer(
    gl.getAttribLocation(program, "aColor"),
    3,
    gl.FLOAT,
    false,
    stride,
    5 * bytesPerFloat,
  );
}
