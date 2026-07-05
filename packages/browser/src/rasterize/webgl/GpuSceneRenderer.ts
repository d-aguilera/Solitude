import type { RenderTextureSourceCatalog } from "@solitude/engine/plugin";
import type { ViewRenderParams } from "@solitude/engine/render";
import { renderNearDepth } from "@solitude/engine/render/parameters";
import { ProjectionService } from "@solitude/engine/render/projectionService";
import type { RenderFailure } from "../../infra/renderFailure";
import { GpuLineRenderer } from "./GpuLineRenderer";
import { GpuMeshRenderer } from "./GpuMeshRenderer";
import { requireResource } from "./webglProgram";

export interface GpuSceneRendererOptions {
  gl: WebGL2RenderingContext;
  onFatalError: (failure: RenderFailure) => void;
  textureSources: RenderTextureSourceCatalog;
}

export class GpuSceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly projectionService: ProjectionService;
  private lightData = new Float32Array(4);
  private lightStorageAllocated = false;
  private lightTextureWidth = 1;
  private readonly lightTexture: WebGLTexture;
  private readonly lineRenderer: GpuLineRenderer;
  private readonly meshRenderer: GpuMeshRenderer;
  private failed = false;
  private readonly contextLostListener: (event: Event) => void;

  constructor({ gl, onFatalError, textureSources }: GpuSceneRendererOptions) {
    this.gl = gl;
    try {
      this.lightTexture = requireResource(gl.createTexture(), "light texture");
      this.lineRenderer = new GpuLineRenderer(gl);
      this.meshRenderer = new GpuMeshRenderer(gl, textureSources);
    } catch (cause) {
      onFatalError({ code: "webgl-program-failed", cause });
      throw cause;
    }

    this.projectionService = new ProjectionService(
      {
        frame: {
          right: { x: 1, y: 0, z: 0 },
          forward: { x: 0, y: 1, z: 0 },
          up: { x: 0, y: 0, z: 1 },
        },
        position: { x: 0, y: 0, z: 0 },
      },
      1,
      1,
    );

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.bindTexture(gl.TEXTURE_2D, this.lightTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.contextLostListener = (event) => {
      event.preventDefault();
      this.failed = true;
      onFatalError({ code: "webgl-context-lost", cause: event });
    };
    gl.canvas.addEventListener("webglcontextlost", this.contextLostListener);
  }

  render(params: ViewRenderParams): void {
    if (this.failed) return;
    const gl = this.gl;
    const width = params.surface.width;
    const height = params.surface.height;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.projectionService.reset(params.camera, width, height);
    this.uploadLights(params);

    const logDepthRange = Math.log2(
      this.meshRenderer.getFarDepth(params, this.projectionService) /
        renderNearDepth,
    );
    this.meshRenderer.render({
      lightCount: params.scene.lights.length,
      lightTexture: this.lightTexture,
      logDepthRange,
      params,
      projectionService: this.projectionService,
    });

    if (params.renderPolylines || params.renderSegments) {
      this.lineRenderer.render(params, this.projectionService, logDepthRange);
    }
  }

  dispose(): void {
    const gl = this.gl;
    gl.canvas.removeEventListener("webglcontextlost", this.contextLostListener);
    gl.deleteTexture(this.lightTexture);
    this.lineRenderer.dispose();
    this.meshRenderer.dispose();
  }

  private uploadLights(params: ViewRenderParams): void {
    const lights = params.scene.lights;
    const lightCount = lights.length;
    const requiredLength = Math.max(4, lightCount * 4);
    if (this.lightData.length < requiredLength) {
      let nextLength = this.lightData.length;
      while (nextLength < requiredLength) nextLength *= 2;
      this.lightData = new Float32Array(nextLength);
      this.lightTextureWidth = nextLength / 4;
      this.lightStorageAllocated = false;
    }
    const campos = params.camera.position;
    for (let index = 0; index < lightCount; index++) {
      const light = lights[index];
      const offset = index * 4;
      this.lightData[offset] = light.position.x - campos.x;
      this.lightData[offset + 1] = light.position.y - campos.y;
      this.lightData[offset + 2] = light.position.z - campos.z;
      this.lightData[offset + 3] = light.intensity;
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.lightTexture);
    if (!this.lightStorageAllocated) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        this.lightTextureWidth,
        1,
        0,
        gl.RGBA,
        gl.FLOAT,
        null,
      );
      this.lightStorageAllocated = true;
    }
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      this.lightTextureWidth,
      1,
      gl.RGBA,
      gl.FLOAT,
      this.lightData,
    );
  }
}
