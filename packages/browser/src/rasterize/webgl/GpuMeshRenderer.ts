import type { Mat3 } from "@solitude/engine/math";
import type {
  Mesh,
  SceneObject,
  ViewRenderParams,
} from "@solitude/engine/render";
import { isBodyAtOrBeyondOnePixelThreshold } from "@solitude/engine/render/bodyLod";
import {
  getRenderFocalLengthX,
  renderAmbientFactor,
  renderDiffuseFactor,
  renderExposure,
  renderFocalLengthY,
  renderGamma,
  renderNearDepth,
} from "@solitude/engine/render/parameters";
import type { ProjectionService } from "@solitude/engine/render/projectionService";
import { profiler } from "@solitude/engine/runtime";
import { getPackedGpuMesh } from "./meshPacking";
import fragmentShaderSource from "./shaders/solidMesh.frag.glsl?raw";
import vertexShaderSource from "./shaders/solidMesh.vert.glsl?raw";
import { selectGpuMeshForObject } from "./sphereLod";
import type { TextureSourceCatalog } from "./textureSources";
import {
  createProgramFromSources,
  requireResource,
  requireUniform,
} from "./webglProgram";

interface GpuMesh {
  boundingRadius: number;
  buffer: WebGLBuffer;
  byteLength: number;
  triangleCount: number;
  vertexCount: number;
}

interface GpuTexture {
  failed: boolean;
  loaded: boolean;
  texture: WebGLTexture;
}

export interface GpuMeshRenderParams {
  lightCount: number;
  lightTexture: WebGLTexture;
  logDepthRange: number;
  params: ViewRenderParams;
  projectionService: ProjectionService;
}

const floatsPerVertex = 9;
const bytesPerFloat = 4;
const stride = floatsPerVertex * bytesPerFloat;

export class GpuMeshRenderer {
  private readonly meshBuffers = new Map<Mesh, GpuMesh>();
  private readonly textureCache = new Map<string, GpuTexture>();
  private readonly objectOrientation = new Float32Array(9);
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private disposed = false;

  private readonly uniforms: {
    ambient: WebGLUniformLocation;
    atmosphereColor: WebGLUniformLocation;
    baseColor: WebGLUniformLocation;
    colorTexture: WebGLUniformLocation;
    cameraForward: WebGLUniformLocation;
    cameraRight: WebGLUniformLocation;
    cameraUp: WebGLUniformLocation;
    diffuse: WebGLUniformLocation;
    emissive: WebGLUniformLocation;
    exposure: WebGLUniformLocation;
    focalLength: WebGLUniformLocation;
    gamma: WebGLUniformLocation;
    lightCount: WebGLUniformLocation;
    lights: WebGLUniformLocation;
    logDepthRange: WebGLUniformLocation;
    modelOrientation: WebGLUniformLocation;
    modelScale: WebGLUniformLocation;
    modelTranslation: WebGLUniformLocation;
    nearDepth: WebGLUniformLocation;
    overlayOpacity: WebGLUniformLocation;
    overlayTexture: WebGLUniformLocation;
    renderMode: WebGLUniformLocation;
    smoothSphereShading: WebGLUniformLocation;
    textureLongitudeOffset: WebGLUniformLocation;
    useColorTexture: WebGLUniformLocation;
  };

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly textureSources: TextureSourceCatalog = {},
  ) {
    this.program = createProgramFromSources(
      gl,
      vertexShaderSource,
      fragmentShaderSource,
    );
    this.vao = requireResource(gl.createVertexArray(), "mesh vertex array");
    this.uniforms = collectUniforms(gl, this.program);

    gl.bindVertexArray(this.vao);
    configureAttributes(gl, this.program);
    gl.bindVertexArray(null);
  }

  render({
    lightCount,
    lightTexture,
    logDepthRange,
    params,
    projectionService,
  }: GpuMeshRenderParams): void {
    const gl = this.gl;
    const width = params.surface.width;
    const height = params.surface.height;
    const frame = params.camera.frame;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, lightTexture);
    gl.uniform1i(this.uniforms.lights, 0);
    gl.uniform1i(this.uniforms.lightCount, lightCount);
    gl.uniform1f(this.uniforms.ambient, renderAmbientFactor);
    gl.uniform1f(this.uniforms.diffuse, renderDiffuseFactor);
    gl.uniform1f(this.uniforms.exposure, renderExposure);
    gl.uniform1f(this.uniforms.gamma, renderGamma);
    gl.uniform2f(
      this.uniforms.focalLength,
      getRenderFocalLengthX(width, height),
      renderFocalLengthY,
    );
    gl.uniform1f(this.uniforms.nearDepth, renderNearDepth);
    gl.uniform1f(this.uniforms.logDepthRange, logDepthRange);
    gl.uniform1i(this.uniforms.overlayTexture, 2);
    gl.uniform1f(this.uniforms.overlayOpacity, 1);
    gl.uniform3f(this.uniforms.atmosphereColor, 0, 0, 0);
    gl.uniform3f(
      this.uniforms.cameraRight,
      frame.right.x,
      frame.right.y,
      frame.right.z,
    );
    gl.uniform3f(
      this.uniforms.cameraForward,
      frame.forward.x,
      frame.forward.y,
      frame.forward.z,
    );
    gl.uniform3f(this.uniforms.cameraUp, frame.up.x, frame.up.y, frame.up.z);

    const objects = params.scene.objects;
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    for (let index = 0; index < objects.length; index++) {
      const object = objects[index];
      if (shouldSkipObject(object, params, projectionService, height)) continue;
      this.drawObject(object, params, projectionService);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (let index = 0; index < objects.length; index++) {
      const object = objects[index];
      if (shouldSkipObject(object, params, projectionService, height)) continue;
      this.drawObjectClouds(object, params, projectionService);
    }
    for (let index = 0; index < objects.length; index++) {
      const object = objects[index];
      if (shouldSkipObject(object, params, projectionService, height)) continue;
      this.drawObjectAtmosphere(object, params, projectionService);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  getFarDepth(
    params: ViewRenderParams,
    projectionService: ProjectionService,
  ): number {
    const cameraPosition = params.camera.position;
    const cameraForward = params.camera.frame.forward;
    const objects = params.scene.objects;
    let farDepth = renderNearDepth * 2;
    for (let index = 0; index < objects.length; index++) {
      const object = objects[index];
      if (object.wireframeOnly) continue;
      const relativeX = object.position.x - cameraPosition.x;
      const relativeY = object.position.y - cameraPosition.y;
      const relativeZ = object.position.z - cameraPosition.z;
      const centerDepth =
        relativeX * cameraForward.x +
        relativeY * cameraForward.y +
        relativeZ * cameraForward.z;
      const selectedMesh = selectGpuMeshForObject(
        object,
        projectionService,
        params.surface.height,
      );
      farDepth = Math.max(
        farDepth,
        centerDepth +
          getPackedGpuMesh(selectedMesh).boundingRadius * object.meshScale,
      );
    }
    return farDepth * 1.01;
  }

  dispose(): void {
    const gl = this.gl;
    this.disposed = true;
    for (const mesh of this.meshBuffers.values()) gl.deleteBuffer(mesh.buffer);
    this.meshBuffers.clear();
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
    for (const texture of this.textureCache.values()) {
      gl.deleteTexture(texture.texture);
    }
    this.textureCache.clear();
  }

  private drawObject(
    object: SceneObject,
    params: ViewRenderParams,
    projectionService: ProjectionService,
  ): void {
    const gl = this.gl;
    const selectedMesh = selectGpuMeshForObject(
      object,
      projectionService,
      params.surface.height,
    );
    const mesh = this.getGpuMesh(selectedMesh);
    const texture = this.getTextureForObject(object);
    gl.uniform1i(this.uniforms.colorTexture, 1);
    gl.uniform1i(this.uniforms.useColorTexture, texture ? 1 : 0);
    gl.uniform1i(this.uniforms.renderMode, texture ? 1 : 0);
    gl.uniform1f(
      this.uniforms.textureLongitudeOffset,
      object.material?.kind === "sphericalTexture"
        ? (object.material.longitudeOffsetRad ?? 0)
        : 0,
    );
    gl.uniform3f(
      this.uniforms.baseColor,
      object.color.r / 255,
      object.color.g / 255,
      object.color.b / 255,
    );
    gl.uniform1i(
      this.uniforms.emissive,
      object.kind === "lightEmitter" ? 1 : 0,
    );

    if (object.backFaceCulling) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.frontFace(gl.CCW);
    } else {
      gl.disable(gl.CULL_FACE);
    }

    if (texture) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texture.texture);
    }
    this.drawMesh(object, mesh, params, 1);
  }

  private drawObjectClouds(
    object: SceneObject,
    params: ViewRenderParams,
    projectionService: ProjectionService,
  ): void {
    const material = object.material;
    if (material?.kind !== "sphericalTexture" || !material.cloudTextureId) {
      return;
    }
    const texture = this.getTexture(material.cloudTextureId);
    if (!texture) return;

    const selectedMesh = selectGpuMeshForObject(
      object,
      projectionService,
      params.surface.height,
    );
    const mesh = this.getGpuMesh(selectedMesh);
    glBindOverlayTexture(
      this.gl,
      this.uniforms.overlayTexture,
      texture.texture,
    );
    this.gl.uniform1i(this.uniforms.renderMode, 2);
    this.gl.uniform1f(
      this.uniforms.overlayOpacity,
      material.cloudOpacity ?? 0.4,
    );
    this.drawMesh(object, mesh, params, material.cloudScale ?? 1.01);
  }

  private drawObjectAtmosphere(
    object: SceneObject,
    params: ViewRenderParams,
    projectionService: ProjectionService,
  ): void {
    const material = object.material;
    if (material?.kind !== "sphericalTexture" || !material.atmosphere) {
      return;
    }

    const selectedMesh = selectGpuMeshForObject(
      object,
      projectionService,
      params.surface.height,
    );
    const mesh = this.getGpuMesh(selectedMesh);
    const atmosphere = material.atmosphere;
    this.gl.uniform1i(this.uniforms.renderMode, 3);
    this.gl.uniform1f(this.uniforms.overlayOpacity, atmosphere.opacity);
    this.gl.uniform3f(
      this.uniforms.atmosphereColor,
      atmosphere.color.r / 255,
      atmosphere.color.g / 255,
      atmosphere.color.b / 255,
    );
    this.drawMesh(object, mesh, params, atmosphere.scale);
  }

  private getGpuMesh(mesh: Mesh): GpuMesh {
    const existing = this.meshBuffers.get(mesh);
    if (existing) return existing;
    const packed = getPackedGpuMesh(mesh);
    const buffer = requireResource(this.gl.createBuffer(), "mesh buffer");
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, packed.data, this.gl.STATIC_DRAW);
    const gpuMesh = {
      boundingRadius: packed.boundingRadius,
      buffer,
      byteLength: packed.data.byteLength,
      triangleCount: packed.triangleCount,
      vertexCount: packed.vertexCount,
    };
    this.meshBuffers.set(mesh, gpuMesh);
    profiler.increment("gpuRender", "meshUploads");
    profiler.increment("gpuRender", "uploadedBytes", gpuMesh.byteLength);
    return gpuMesh;
  }

  private getTextureForObject(object: SceneObject): GpuTexture | null {
    const material = object.material;
    if (material?.kind !== "sphericalTexture") return null;

    return this.getTexture(material.textureId);
  }

  private getTexture(textureId: string): GpuTexture | null {
    const source = this.textureSources[textureId];
    if (!source) return null;

    const existing = this.textureCache.get(textureId);
    if (existing) return existing.loaded && !existing.failed ? existing : null;

    const texture = this.createTextureRecord(textureId, source);
    return texture.loaded && !texture.failed ? texture : null;
  }

  private drawMesh(
    object: SceneObject,
    mesh: GpuMesh,
    params: ViewRenderParams,
    scaleMultiplier: number,
    cullFaceMode?: number,
  ): void {
    const gl = this.gl;
    writeMatrixColumnMajor(this.objectOrientation, object.orientation);
    gl.uniformMatrix3fv(
      this.uniforms.modelOrientation,
      false,
      this.objectOrientation,
    );
    gl.uniform3f(
      this.uniforms.modelTranslation,
      object.position.x - params.camera.position.x,
      object.position.y - params.camera.position.y,
      object.position.z - params.camera.position.z,
    );
    gl.uniform1f(this.uniforms.modelScale, object.meshScale * scaleMultiplier);
    gl.uniform1i(
      this.uniforms.smoothSphereShading,
      object.meshShading.kind === "smoothSphere" ? 1 : 0,
    );
    if (object.backFaceCulling) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(cullFaceMode ?? gl.BACK);
      gl.frontFace(gl.CCW);
    } else {
      gl.disable(gl.CULL_FACE);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    bindAttributePointers(gl, this.program);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
    profiler.increment("gpuRender", "drawCalls");
    profiler.increment("gpuRender", "objects");
    profiler.increment("gpuRender", "triangles", mesh.triangleCount);
  }

  private createTextureRecord(textureId: string, source: string): GpuTexture {
    const gl = this.gl;
    const texture = requireResource(gl.createTexture(), "mesh color texture");
    const record: GpuTexture = { failed: false, loaded: false, texture };
    this.textureCache.set(textureId, record);

    if (typeof Image === "undefined") {
      record.failed = true;
      return record;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (this.disposed || record.failed) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
      gl.bindTexture(gl.TEXTURE_2D, null);
      record.loaded = true;
      profiler.increment("gpuRender", "textureUploads");
    };
    image.onerror = () => {
      record.failed = true;
    };
    image.src = source;
    return record;
  }
}

function configureAttributes(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): void {
  for (const name of ["aPosition", "aNormal", "aFaceAnchor"]) {
    gl.enableVertexAttribArray(gl.getAttribLocation(program, name));
  }
}

function bindAttributePointers(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): void {
  gl.vertexAttribPointer(
    gl.getAttribLocation(program, "aPosition"),
    3,
    gl.FLOAT,
    false,
    stride,
    0,
  );
  gl.vertexAttribPointer(
    gl.getAttribLocation(program, "aNormal"),
    3,
    gl.FLOAT,
    false,
    stride,
    3 * bytesPerFloat,
  );
  gl.vertexAttribPointer(
    gl.getAttribLocation(program, "aFaceAnchor"),
    3,
    gl.FLOAT,
    false,
    stride,
    6 * bytesPerFloat,
  );
}

function shouldSkipObject(
  object: SceneObject,
  params: ViewRenderParams,
  projectionService: ProjectionService,
  height: number,
): boolean {
  return (
    object.wireframeOnly ||
    Boolean(params.objectsFilter && !params.objectsFilter(object)) ||
    isBodyAtOrBeyondOnePixelThreshold(object, projectionService, height)
  );
}

function glBindOverlayTexture(
  gl: WebGL2RenderingContext,
  textureUniform: WebGLUniformLocation,
  texture: WebGLTexture,
): void {
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(textureUniform, 2);
}

function collectUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
  return {
    ambient: requireUniform(gl, program, "uAmbient"),
    atmosphereColor: requireUniform(gl, program, "uAtmosphereColor"),
    baseColor: requireUniform(gl, program, "uBaseColor"),
    colorTexture: requireUniform(gl, program, "uColorTexture"),
    cameraForward: requireUniform(gl, program, "uCameraForward"),
    cameraRight: requireUniform(gl, program, "uCameraRight"),
    cameraUp: requireUniform(gl, program, "uCameraUp"),
    diffuse: requireUniform(gl, program, "uDiffuse"),
    emissive: requireUniform(gl, program, "uEmissive"),
    exposure: requireUniform(gl, program, "uExposure"),
    focalLength: requireUniform(gl, program, "uFocalLength"),
    gamma: requireUniform(gl, program, "uGamma"),
    lightCount: requireUniform(gl, program, "uLightCount"),
    lights: requireUniform(gl, program, "uLights"),
    logDepthRange: requireUniform(gl, program, "uLogDepthRange"),
    modelOrientation: requireUniform(gl, program, "uModelOrientation"),
    modelScale: requireUniform(gl, program, "uModelScale"),
    modelTranslation: requireUniform(gl, program, "uModelTranslation"),
    nearDepth: requireUniform(gl, program, "uNearDepth"),
    overlayOpacity: requireUniform(gl, program, "uOverlayOpacity"),
    overlayTexture: requireUniform(gl, program, "uOverlayTexture"),
    renderMode: requireUniform(gl, program, "uRenderMode"),
    smoothSphereShading: requireUniform(gl, program, "uSmoothSphereShading"),
    textureLongitudeOffset: requireUniform(
      gl,
      program,
      "uTextureLongitudeOffset",
    ),
    useColorTexture: requireUniform(gl, program, "uUseColorTexture"),
  };
}

function writeMatrixColumnMajor(into: Float32Array, matrix: Mat3): void {
  into[0] = matrix[0][0];
  into[1] = matrix[1][0];
  into[2] = matrix[2][0];
  into[3] = matrix[0][1];
  into[4] = matrix[1][1];
  into[5] = matrix[2][1];
  into[6] = matrix[0][2];
  into[7] = matrix[1][2];
  into[8] = matrix[2][2];
}
