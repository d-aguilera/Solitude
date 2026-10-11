import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import type {
  BodySceneObject,
  ControlledBodySceneObject,
  PolylineSceneObject,
  ViewRenderParams,
} from "@solitude/engine/render";
import { createUnitIcosphereMesh } from "@solitude/engine/render/icosphere";
import { describe, expect, it, vi } from "vitest";
import { GpuSceneRenderer } from "../../../rasterize/webgl/GpuSceneRenderer";

describe("GPU scene renderer", () => {
  it("uploads unchanged geometry once and releases it", () => {
    const recording = createRecordingGl();
    const failures: unknown[] = [];
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: (failure) => failures.push(failure),
      textureSources: {},
    });
    const object = createObject();
    const params = createRenderParams(object);

    renderer.render(params);
    renderer.render(params);
    renderer.dispose();

    expect(recording.staticBufferUploads).toBe(1);
    expect(recording.drawCalls).toBe(2);
    expect(recording.deletedBuffers).toBe(2);
    expect(failures).toEqual([]);
  });

  it("reuses one mesh buffer for differently scaled objects", () => {
    const recording = createRecordingGl();
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: () => {},
      textureSources: {},
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
      textureSources: {},
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
      textureSources: {},
    });

    renderer.render(
      createRenderParams([
        createObject(),
        createIcosphereBody("body:smooth", 20),
      ]),
    );

    expect(recording.smoothSphereShading).toEqual([0, 1]);
  });

  it("uses loaded spherical textures when a source is available", async () => {
    const recording = createRecordingGl();
    const restoreImage = installDecodedBitmap();
    try {
      const renderer = new GpuSceneRenderer({
        gl: recording.gl,
        onFatalError: () => {},
        textureSources: { "texture:test": "/texture-test.jpg" },
      });
      const object = createIcosphereBody("body:textured", 20);
      object.material = {
        kind: "sphericalTexture",
        textureId: "texture:test",
      };

      renderer.render(createRenderParams(object));
      await new Promise((resolve) => setTimeout(resolve, 0));
      // Allocate storage, then publish only after the complete pixel upload.
      renderer.render(createRenderParams(object));
      renderer.render(createRenderParams(object));

      expect(recording.textureUploads).toBe(1);
      expect(recording.useColorTexture).toEqual([0, 0, 1]);
      renderer.dispose();
    } finally {
      restoreImage();
    }
  });

  it("draws cloud and atmosphere overlays after the cloud texture loads", async () => {
    const recording = createRecordingGl();
    const restoreImage = installDecodedBitmap();
    try {
      const renderer = new GpuSceneRenderer({
        gl: recording.gl,
        onFatalError: () => {},
        textureSources: {
          "texture:clouds": "/clouds.jpg",
          "texture:surface": "/surface.jpg",
        },
      });
      const object = createIcosphereBody("body:earth", 20);
      object.material = {
        atmosphere: {
          color: { b: 255, g: 170, r: 80 },
          opacity: 0.25,
          scale: 1.02,
        },
        cloudTextureId: "texture:clouds",
        kind: "sphericalTexture",
        textureId: "texture:surface",
      };

      renderer.render(createRenderParams(object));
      await new Promise((resolve) => setTimeout(resolve, 0));
      // Allocate storage, then publish only after the complete pixel upload.
      renderer.render(createRenderParams(object));
      renderer.render(createRenderParams(object));

      renderer.render(createRenderParams(object));
      renderer.render(createRenderParams(object));
      expect(recording.textureUploads).toBe(2);
      expect(recording.renderModes).toEqual([0, 3, 0, 3, 1, 3, 1, 3, 1, 2, 3]);
      expect(recording.blendFuncs).toEqual(
        Array.from({ length: 5 }, () => [
          recording.gl.SRC_ALPHA,
          recording.gl.ONE_MINUS_SRC_ALPHA,
        ]),
      );
      renderer.dispose();
    } finally {
      restoreImage();
    }
  });

  it("uploads full 8K textures in bounded strips and publishes only the complete image", async () => {
    const recording = createRecordingGl();
    const restore = installDecodedBitmap();
    const close = vi.fn();
    globalThis.createImageBitmap = (async () => ({
      width: 8192,
      height: 4096,
      close,
    })) as typeof createImageBitmap;
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: () => {},
      textureSources: { earth: "/large-earth.jpg" },
    });
    const object = createIcosphereBody("earth", 20);
    object.material = { kind: "sphericalTexture", textureId: "earth" };
    try {
      renderer.render(createRenderParams(object));
      await new Promise((resolve) => setTimeout(resolve, 0));
      renderer.render(createRenderParams(object));
      expect(recording.textureStorage).toEqual([[8192, 4096]]);
      expect(recording.textureRegions).toHaveLength(0);
      for (let i = 0; i < 64; i++) {
        renderer.render(createRenderParams(object));
        expect(recording.textureRegions[i]).toEqual({
          y: i * 64,
          width: 8192,
          height: 64,
          sourceY: i * 64,
        });
        expect(
          recording.useColorTexture[recording.useColorTexture.length - 1],
        ).toBe(i === 63 ? 1 : 0);
        expect(recording.pixelSkips[recording.pixelSkips.length - 1]).toBe(0);
      }
      expect(close).toHaveBeenCalledOnce();
      renderer.render(createRenderParams(object));
      expect(recording.textureRegions).toHaveLength(64);
    } finally {
      renderer.dispose();
      restore();
    }
  });

  it("does not upload a late bitmap to a disposed Retry generation", async () => {
    const recording = createRecordingGl();
    const restore = installDecodedBitmap();
    const close = vi.fn();
    let finish: (bitmap: ImageBitmap) => void = () => {};
    globalThis.createImageBitmap = (() =>
      new Promise<ImageBitmap>((resolve) => {
        finish = resolve;
      })) as typeof createImageBitmap;
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: () => {},
      textureSources: { earth: "/cancelled-earth.jpg" },
    });
    const object = createIcosphereBody("earth", 20);
    object.material = { kind: "sphericalTexture", textureId: "earth" };
    try {
      renderer.render(createRenderParams(object));
      await new Promise((resolve) => setTimeout(resolve, 0));
      renderer.dispose();
      finish({ width: 8192, height: 4096, close } as unknown as ImageBitmap);
      await new Promise((resolve) => setTimeout(resolve, 0));
      renderer.render(createRenderParams(object));
      expect(recording.textureStorage).toHaveLength(0);
      expect(recording.textureRegions).toHaveLength(0);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      renderer.dispose();
      restore();
    }
  });

  it("draws line ribbons after solid meshes", () => {
    const recording = createRecordingGl();
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: () => {},
      textureSources: {},
    });
    const params = createRenderParams([createObject(), createPolyline()]);
    params.worldSegments.push(createWorldSegment());
    params.worldSegmentCount = params.worldSegments.length;

    renderer.render(params);

    expect(recording.drawVertexCounts).toEqual([3, 12]);
    expect(recording.dynamicBufferUploads).toBe(1);
  });

  it("gates trajectory ribbons with renderPolylines", () => {
    const recording = createRecordingGl();
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: () => {},
      textureSources: {},
    });
    const params = createRenderParams([createObject(), createPolyline()]);
    params.renderPolylines = false;

    renderer.render(params);

    expect(recording.drawVertexCounts).toEqual([3]);
    expect(recording.dynamicBufferUploads).toBe(0);
  });

  it("gates world segment ribbons with renderSegments", () => {
    const recording = createRecordingGl();
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: () => {},
      textureSources: {},
    });
    const params = createRenderParams(createObject());
    params.worldSegments.push(createWorldSegment());
    params.worldSegmentCount = params.worldSegments.length;
    params.renderSegments = false;

    renderer.render(params);

    expect(recording.drawVertexCounts).toEqual([3]);
    expect(recording.dynamicBufferUploads).toBe(0);
  });

  it("applies object filters to trajectory ribbons", () => {
    const recording = createRecordingGl();
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: () => {},
      textureSources: {},
    });
    const params = createRenderParams([createObject(), createPolyline()]);
    params.objectsFilter = (object) => object.kind !== "polyline";

    renderer.render(params);

    expect(recording.drawVertexCounts).toEqual([3]);
    expect(recording.dynamicBufferUploads).toBe(0);
  });

  it("releases partially constructed renderers when mesh setup fails", () => {
    const recording = createRecordingGl();
    const deleteProgram = vi.spyOn(recording.gl, "deleteProgram");
    const deleteVao = vi.spyOn(recording.gl, "deleteVertexArray");
    const deleteTexture = vi.spyOn(recording.gl, "deleteTexture");
    vi.spyOn(recording.gl, "getUniformLocation").mockImplementation(
      (_program, name) =>
        name === "uAmbient" ? null : ({} as WebGLUniformLocation),
    );
    const failure = vi.fn();
    expect(
      () =>
        new GpuSceneRenderer({
          gl: recording.gl,
          onFatalError: failure,
          textureSources: {},
        }),
    ).toThrow("uniform uAmbient");
    expect(deleteProgram).toHaveBeenCalledTimes(2);
    expect(deleteVao).toHaveBeenCalledTimes(2);
    expect(deleteTexture).toHaveBeenCalledTimes(1);
    expect(recording.deletedBuffers).toBe(1);
    expect(failure).toHaveBeenCalledWith(
      expect.objectContaining({ code: "webgl-program-failed" }),
    );
  });
  it("disposes once and rejects rendering and context notifications afterward", () => {
    const recording = createRecordingGl();
    const failure = vi.fn();
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: failure,
      textureSources: {},
    });
    renderer.render(createRenderParams(createObject()));
    renderer.dispose();
    renderer.dispose();
    renderer.render(createRenderParams(createObject()));
    recording.loseContext();
    expect(recording.deletedBuffers).toBe(2);
    expect(recording.drawCalls).toBe(1);
    expect(failure).not.toHaveBeenCalled();
  });

  it("reports context loss and stops issuing draws", () => {
    const recording = createRecordingGl();
    const failures: { code: string }[] = [];
    const renderer = new GpuSceneRenderer({
      gl: recording.gl,
      onFatalError: (failure) => failures.push(failure),
      textureSources: {},
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

function createPolyline(): PolylineSceneObject {
  return {
    applyTransform: false,
    backFaceCulling: false,
    color: { b: 0, g: 128, r: 255 },
    count: 1,
    id: "trajectory:test",
    kind: "polyline",
    lineWidth: 2,
    mesh: {
      faces: [],
      points: [vec3.create(1, 10, 0)],
    },
    meshLod: { kind: "none" },
    meshScale: 1,
    meshShading: { kind: "flat" },
    orientation: mat3.copy(mat3.identity, mat3.zero()),
    position: vec3.create(-1, 10, 0),
    tail: 0,
    wireframeOnly: true,
  };
}

function createWorldSegment(): ViewRenderParams["worldSegments"][number] {
  return {
    color: { b: 0, g: 255, r: 255 },
    end: vec3.create(1, 10, 0),
    lineWidth: 2,
    start: vec3.create(-1, 10, 0),
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
    sceneLabelCandidateCount: 0,
    sceneLabelCandidates: [],
    surface: { height: 600, width: 800 },
    worldMarkerCount: 0,
    worldMarkers: [],
    worldSegmentCount: 0,
    worldSegments: [],
  };
}

function createRecordingGl(): {
  blendFuncs: Array<[number, number]>;
  cullFaces: number[];
  deletedBuffers: number;
  drawCalls: number;
  drawVertexCounts: number[];
  dynamicBufferUploads: number;
  gl: WebGL2RenderingContext;
  loseContext: () => void;
  modelScales: number[];
  renderModes: number[];
  smoothSphereShading: number[];
  staticBufferUploads: number;
  textureUploads: number;
  textureStorage: number[][];
  textureRegions: {
    y: number;
    width: number;
    height: number;
    sourceY: number;
  }[];
  pixelSkips: number[];
  useColorTexture: number[];
} {
  const state = {
    blendFuncs: [] as Array<[number, number]>,
    cullFaces: [] as number[],
    deletedBuffers: 0,
    drawCalls: 0,
    drawVertexCounts: [] as number[],
    dynamicBufferUploads: 0,
    modelScales: [] as number[],
    renderModes: [] as number[],
    smoothSphereShading: [] as number[],
    staticBufferUploads: 0,
    textureUploads: 0,
    textureStorage: [] as number[][],
    textureRegions: [] as {
      y: number;
      width: number;
      height: number;
      sourceY: number;
    }[],
    pixelSkips: [] as number[],
    useColorTexture: [] as number[],
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
    BLEND: 29,
    CLAMP_TO_EDGE: 3,
    COLOR_BUFFER_BIT: 4,
    COMPILE_STATUS: 5,
    CULL_FACE: 6,
    DEPTH_BUFFER_BIT: 8,
    DEPTH_TEST: 7,
    DYNAMIC_DRAW: 27,
    FLOAT: 9,
    FRAGMENT_SHADER: 10,
    LEQUAL: 11,
    LINEAR: 12,
    LINK_STATUS: 13,
    NEAREST: 14,
    RGBA: 15,
    RGBA8: 34,
    UNPACK_SKIP_ROWS: 35,
    RGBA32F: 16,
    STATIC_DRAW: 17,
    TEXTURE0: 18,
    TEXTURE1: 19,
    TEXTURE2: 20,
    TEXTURE_2D: 21,
    TEXTURE_MAG_FILTER: 22,
    TEXTURE_MIN_FILTER: 23,
    TEXTURE_WRAP_S: 24,
    TEXTURE_WRAP_T: 25,
    TRIANGLES: 26,
    UNSIGNED_BYTE: 27,
    UNSIGNED_SHORT: 28,
    VERTEX_SHADER: 30,
    ONE_MINUS_SRC_ALPHA: 31,
    SRC_ALPHA: 32,
    ONE: 33,
    canvas,
    activeTexture: () => {},
    attachShader: () => {},
    bindBuffer: () => {},
    bindTexture: () => {},
    bindVertexArray: () => {},
    blendFunc: (src: number, dst: number) => {
      state.blendFuncs.push([src, dst]);
    },
    bufferData: (_target: number, _data: unknown, usage: number) => {
      if (usage === 17) state.staticBufferUploads++;
      if (usage === 27) state.dynamicBufferUploads++;
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
    cullFace: (mode: number) => {
      state.cullFaces.push(mode);
    },
    deleteBuffer: () => state.deletedBuffers++,
    deleteProgram: () => {},
    deleteShader: () => {},
    deleteTexture: () => {},
    deleteVertexArray: () => {},
    depthFunc: () => {},
    depthMask: () => {},
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
    texImage2D: (...args: unknown[]) => {
      if (args.length === 6) state.textureUploads++;
    },
    texParameteri: () => {},
    texStorage2D: (
      _target: number,
      _levels: number,
      _format: number,
      width: number,
      height: number,
    ) => {
      state.textureStorage.push([width, height]);
    },
    pixelStorei: (parameter: number, value: number) => {
      if (parameter === 35) state.pixelSkips.push(value);
    },
    texSubImage2D: (...args: unknown[]) => {
      if (args.length === 9 && !(args[8] instanceof Float32Array)) {
        state.textureUploads++;
        state.textureRegions.push({
          y: args[3] as number,
          width: args[4] as number,
          height: args[5] as number,
          sourceY: state.pixelSkips[state.pixelSkips.length - 1] ?? 0,
        });
      }
    },
    uniform1f: (location: unknown, value: number) => {
      if (location === "uModelScale") state.modelScales.push(value);
    },
    uniform1i: (location: unknown, value: number) => {
      if (location === "uSmoothSphereShading") {
        state.smoothSphereShading.push(value);
      }
      if (location === "uUseColorTexture") {
        state.useColorTexture.push(value);
      }
      if (location === "uRenderMode") {
        state.renderModes.push(value);
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

function installDecodedBitmap(): () => void {
  const previousFetch = globalThis.fetch;
  const previousBitmap = globalThis.createImageBitmap;
  globalThis.fetch = async () => new Response(new Blob());
  globalThis.createImageBitmap = (async () => ({
    width: 2,
    height: 2,
    close: () => {},
  })) as typeof createImageBitmap;
  return () => {
    globalThis.fetch = previousFetch;
    globalThis.createImageBitmap = previousBitmap;
  };
}
