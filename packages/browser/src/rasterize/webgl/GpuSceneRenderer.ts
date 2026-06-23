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
import { ProjectionService } from "@solitude/engine/render/projectionService";
import { profiler } from "@solitude/engine/runtime";
import type { RenderFailure } from "../../infra/renderFailure";
import { getPackedGpuMesh } from "./meshPacking";
import fragmentShaderSource from "./shaders/solidMesh.frag.glsl?raw";
import vertexShaderSource from "./shaders/solidMesh.vert.glsl?raw";

interface GpuMesh {
  boundingRadius: number;
  buffer: WebGLBuffer;
  byteLength: number;
  triangleCount: number;
  vertexCount: number;
}

export interface GpuSceneRendererOptions {
  gl: WebGL2RenderingContext;
  onFatalError: (failure: RenderFailure) => void;
}

const floatsPerVertex = 9;
const bytesPerFloat = 4;
const stride = floatsPerVertex * bytesPerFloat;

export class GpuSceneRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly meshBuffers = new Map<Mesh, GpuMesh>();
  private readonly objectOrientation = new Float32Array(9);
  private readonly projectionService: ProjectionService;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private lightData = new Float32Array(4);
  private lightStorageAllocated = false;
  private lightTextureWidth = 1;
  private readonly lightTexture: WebGLTexture;
  private failed = false;
  private readonly contextLostListener: (event: Event) => void;

  private readonly uniforms: {
    ambient: WebGLUniformLocation;
    baseColor: WebGLUniformLocation;
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
  };

  constructor({ gl, onFatalError }: GpuSceneRendererOptions) {
    this.gl = gl;
    try {
      this.program = createProgram(gl);
      this.vao = requireResource(gl.createVertexArray(), "vertex array");
      this.lightTexture = requireResource(gl.createTexture(), "light texture");
      this.uniforms = collectUniforms(gl, this.program);
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

    gl.bindVertexArray(this.vao);
    configureAttributes(gl, this.program);
    gl.bindVertexArray(null);
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
    const frame = params.camera.frame;

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.projectionService.reset(params.camera, width, height);
    this.uploadLights(params);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.lightTexture);
    gl.uniform1i(this.uniforms.lights, 0);
    gl.uniform1i(this.uniforms.lightCount, params.scene.lights.length);
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
    gl.uniform1f(
      this.uniforms.logDepthRange,
      Math.log2(this.getFarDepth(params) / renderNearDepth),
    );
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
    for (let index = 0; index < objects.length; index++) {
      const object = objects[index];
      if (object.wireframeOnly) continue;
      if (params.objectsFilter && !params.objectsFilter(object)) continue;
      if (
        isBodyAtOrBeyondOnePixelThreshold(
          object,
          this.projectionService,
          height,
        )
      ) {
        continue;
      }
      this.drawObject(object, params);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
    gl.useProgram(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.canvas.removeEventListener("webglcontextlost", this.contextLostListener);
    for (const mesh of this.meshBuffers.values()) gl.deleteBuffer(mesh.buffer);
    this.meshBuffers.clear();
    gl.deleteTexture(this.lightTexture);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
  }

  private drawObject(object: SceneObject, params: ViewRenderParams): void {
    const gl = this.gl;
    const mesh = this.getGpuMesh(object.mesh);
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
    gl.uniform1f(this.uniforms.modelScale, object.meshScale);
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

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    bindAttributePointers(gl, this.program);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
    profiler.increment("gpuRender", "drawCalls");
    profiler.increment("gpuRender", "objects");
    profiler.increment("gpuRender", "triangles", mesh.triangleCount);
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

  private getFarDepth(params: ViewRenderParams): number {
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
      farDepth = Math.max(
        farDepth,
        centerDepth +
          getPackedGpuMesh(object.mesh).boundingRadius * object.meshScale,
      );
    }
    return farDepth * 1.01;
  }

  private uploadLights(params: ViewRenderParams): void {
    const lightCount = params.scene.lights.length;
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
      const light = params.scene.lights[index];
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

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = requireResource(gl.createProgram(), "shader program");
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "Unknown program error";
    gl.deleteProgram(program);
    throw new Error(`WebGL program link failed: ${message}`);
  }
  return program;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
): WebGLShader {
  const shader = requireResource(gl.createShader(type), "shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    gl.deleteShader(shader);
    throw new Error(`WebGL shader compilation failed: ${message}`);
  }
  return shader;
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

function collectUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
  return {
    ambient: requireUniform(gl, program, "uAmbient"),
    baseColor: requireUniform(gl, program, "uBaseColor"),
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
  };
}

function requireUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  return requireResource(
    gl.getUniformLocation(program, name),
    `uniform ${name}`,
  );
}

function requireResource<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`Failed to create WebGL ${name}`);
  return value;
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
