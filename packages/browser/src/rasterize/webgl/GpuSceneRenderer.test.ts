import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import type {
  BodySceneObject,
  ControlledBodySceneObject,
  ViewRenderParams,
} from "@solitude/engine/render";
import { createUnitIcosphereMesh } from "@solitude/engine/render/icosphere";
import { describe, expect, it } from "vitest";
import { GpuSceneRenderer } from "./GpuSceneRenderer";

describe("GPU scene renderer", () => {
  it("uploads unchanged geometry once and releases it", () => {
    const recording = createRecordingGl();
    const failures: unknown[] = [];
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: (failure) => failures.push(failure),
    });
    const object = createObject();
    const params = createRenderParams(object);

    renderer.render(params);
    renderer.render(params);
    renderer.dispose();

    expect(recording.staticBufferUploads).toBe(1);
    expect(recording.drawCalls).toBe(2);
    expect(recording.deletedBuffers).toBe(1);
    expect(failures).toEqual([]);
  });

  it("reuses one mesh buffer for differently scaled objects", () => {
    const recording = createRecordingGl();
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: () => {},
    });
    const small = createObject("body:small", 2);
    const large = createObject("body:large", 5);
    large.mesh = small.mesh;

    renderer.render(createRenderParams([small, large]));

    expect(recording.staticBufferUploads).toBe(1);
    expect(recording.drawCalls).toBe(2);
    expect(recording.modelScales).toEqual([2, 5]);
  });

  it("draws lower sphere LODs for small projected bodies", () => {
    const recording = createRecordingGl();
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: () => {},
    });
    const farBody = createIcosphereBody("body:far", 2_000);
    const nearBody = createIcosphereBody("body:near", 20);

    renderer.render(createRenderParams([farBody, nearBody]));

    expect(recording.drawVertexCounts).toEqual([240, 15_360]);
  });

  it("selects flat and smooth sphere shading per object", () => {
    const recording = createRecordingGl();
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: () => {},
    });

    renderer.render(
      createRenderParams([
        createObject(),
        createIcosphereBody("body:smooth", 20),
      ]),
    );

    expect(recording.smoothSphereShading).toEqual([0, 1]);
  });

  it("reports context loss and stops issuing draws", () => {
    const recording = createRecordingGl();
    const failures: { code: string }[] = [];
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: (failure) => failures.push(failure),
    });
    const params = createRenderParams(createObject());
    renderer.render(params);

    recording.loseContext();
    renderer.render(params);

    expect(recording.drawCalls).toBe(1);
    expect(failures).toEqual([
      { code: "webgl-context-lost", cause: expect.anything() },
    ]);
  });
});

function createObject(
  id = "craft:test",
  meshScale = 1,
): ControlledBodySceneObject {
  return {
    applyTransform: true,
    backFaceCulling: false,
    color: { b: 30, g: 20, r: 10 },
    id,
    kind: "controlledBody",
    lineWidth: 1,
    mesh: {
      faces: [[0, 1, 2]],
      points: [
        vec3.create(-1, 0, -1),
        vec3.create(1, 0, -1),
        vec3.create(0, 0, 1),
      ],
    },
    meshLod: { kind: "none" },
    meshShading: { kind: "flat" },
    meshScale,
    orientation: mat3.copy(mat3.identity, mat3.zero()),
    position: vec3.create(0, 10, 0),
    wireframeOnly: false,
  };
}

function createIcosphereBody(id: string, depth: number): BodySceneObject {
  return {
    applyTransform: true,
    backFaceCulling: true,
    centralEntityId: "body:primary",
    color: { b: 30, g: 20, r: 10 },
    id,
    kind: "orbitalBody",
    lineWidth: 1,
    mesh: createUnitIcosphereMesh(4),
    meshLod: { kind: "unitIcosphere", maxSubdivisions: 4 },
    meshShading: { kind: "smoothSphere" },
    meshScale: 10,
    orientation: mat3.copy(mat3.identity, mat3.zero()),
    position: vec3.create(0, depth, 0),
    velocity: vec3.zero(),
    wireframeOnly: false,
  };
}

function createRenderParams(
  objectOrObjects:
    | ViewRenderParams["scene"]["objects"][number]
    | ViewRenderParams["scene"]["objects"],
): ViewRenderParams {
  const objects = Array.isArray(objectOrObjects)
    ? objectOrObjects
    : [objectOrObjects];
  return {
    camera: {
      frame: localFrame.clone({
        right: vec3.create(1, 0, 0),
        forward: vec3.create(0, 1, 0),
        up: vec3.create(0, 0, 1),
      }),
      position: vec3.zero(),
    },
    renderPolylines: true,
    renderSceneLabels: true,
    renderSegments: true,
    scene: { lights: [], objects },
    sceneLabelCandidates: [],
    surface: { height: 600, width: 800 },
    worldMarkers: [],
    worldSegments: [],
  };
}

function createRecordingGl(): {
  deletedBuffers: number;
  drawCalls: number;
  drawVertexCounts: number[];
  gl: WebGL2RenderingContext;
  loseContext: () => void;
  modelScales: number[];
  smoothSphereShading: number[];
  staticBufferUploads: number;
} {
  const state = {
    deletedBuffers: 0,
    drawCalls: 0,
    drawVertexCounts: [] as number[],
    modelScales: [] as number[],
    smoothSphereShading: [] as number[],
    staticBufferUploads: 0,
  };
  let contextLostListener: ((event: Event) => void) | null = null;
  const canvas = {
    addEventListener: (name: string, listener: (event: Event) => void) => {
      if (name === "webglcontextlost") contextLostListener = listener;
    },
    removeEventListener: (name: string) => {
      if (name === "webglcontextlost") contextLostListener = null;
    },
  };
  const gl = {
    ARRAY_BUFFER: 1,
    BACK: 2,
    CLAMP_TO_EDGE: 3,
    COLOR_BUFFER_BIT: 4,
    COMPILE_STATUS: 5,
    CULL_FACE: 6,
    DEPTH_BUFFER_BIT: 8,
    DEPTH_TEST: 7,
    FLOAT: 9,
    FRAGMENT_SHADER: 10,
    LEQUAL: 11,
    LINEAR: 12,
    LINK_STATUS: 13,
    NEAREST: 14,
    RGBA: 15,
    RGBA32F: 16,
    STATIC_DRAW: 17,
    TEXTURE0: 18,
    TEXTURE_2D: 19,
    TEXTURE_MAG_FILTER: 20,
    TEXTURE_MIN_FILTER: 21,
    TEXTURE_WRAP_S: 22,
    TEXTURE_WRAP_T: 23,
    TRIANGLES: 24,
    UNSIGNED_SHORT: 25,
    VERTEX_SHADER: 26,
    canvas,
    activeTexture: () => {},
    attachShader: () => {},
    bindBuffer: () => {},
    bindTexture: () => {},
    bindVertexArray: () => {},
    bufferData: (_target: number, _data: unknown, usage: number) => {
      if (usage === 17) state.staticBufferUploads++;
    },
    clear: () => {},
    clearColor: () => {},
    clearDepth: () => {},
    compileShader: () => {},
    createBuffer: () => ({}),
    createProgram: () => ({}),
    createShader: () => ({}),
    createTexture: () => ({}),
    createVertexArray: () => ({}),
    cullFace: () => {},
    deleteBuffer: () => state.deletedBuffers++,
    deleteProgram: () => {},
    deleteShader: () => {},
    deleteTexture: () => {},
    deleteVertexArray: () => {},
    depthFunc: () => {},
    disable: () => {},
    drawArrays: (_mode: number, _first: number, count: number) => {
      state.drawCalls++;
      state.drawVertexCounts.push(count);
    },
    enable: () => {},
    enableVertexAttribArray: () => {},
    frontFace: () => {},
    getAttribLocation: () => 0,
    getProgramInfoLog: () => "",
    getProgramParameter: () => true,
    getShaderInfoLog: () => "",
    getShaderParameter: () => true,
    getUniformLocation: (_program: unknown, name: string) => name,
    linkProgram: () => {},
    shaderSource: () => {},
    texImage2D: () => {},
    texParameteri: () => {},
    texSubImage2D: () => {},
    uniform1f: (location: unknown, value: number) => {
      if (location === "uModelScale") state.modelScales.push(value);
    },
    uniform1i: (location: unknown, value: number) => {
      if (location === "uSmoothSphereShading") {
        state.smoothSphereShading.push(value);
      }
    },
    uniform2f: () => {},
    uniform3f: () => {},
    uniformMatrix3fv: () => {},
    useProgram: () => {},
    vertexAttribPointer: () => {},
    viewport: () => {},
  } as unknown as WebGL2RenderingContext;
  return Object.assign(state, {
    gl,
    loseContext: () =>
      contextLostListener?.({ preventDefault: () => {} } as Event),
  });
}
