import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import type {
  PolylineSceneObject,
  RenderedView,
  TextMetrics,
  ViewRenderParams,
} from "@solitude/engine/render";
import { describe, expect, it } from "vitest";
import type { GpuSceneRenderer } from "./GpuSceneRenderer";
import { WebGLViewRenderer } from "./WebGLViewRenderer";

describe("WebGL view renderer", () => {
  it("passes polyline rendering through to the GPU renderer", () => {
    const gpuRenderFlags: boolean[] = [];
    const gpuRenderer = {
      dispose: () => {},
      render: (params: ViewRenderParams) =>
        gpuRenderFlags.push(params.renderPolylines),
    } as unknown as GpuSceneRenderer;
    const renderer = new WebGLViewRenderer(gpuRenderer, measureText, "full");
    const renderedView = createRenderedView();
    const params = createRenderParams(createPolyline());

    renderer.renderInto(renderedView, params);

    expect(gpuRenderFlags).toEqual([true]);
    expect(params.renderPolylines).toBe(true);
  });
});

function createRenderParams(object: PolylineSceneObject): ViewRenderParams {
  return {
    camera: {
      frame: localFrame.clone({
        forward: vec3.create(0, 1, 0),
        right: vec3.create(1, 0, 0),
        up: vec3.create(0, 0, 1),
      }),
      position: vec3.zero(),
    },
    renderPolylines: true,
    renderSceneLabels: true,
    renderSegments: true,
    scene: { lights: [], objects: [object] },
    sceneLabelCandidateCount: 0,
    sceneLabelCandidates: [],
    surface: { height: 600, width: 800 },
    worldMarkerCount: 0,
    worldMarkers: [],
    worldSegmentCount: 0,
    worldSegments: [],
  };
}

function createRenderedView(): RenderedView {
  return {
    markers: [],
    markerCount: 0,
    sceneLabels: [],
    sceneLabelCount: 0,
    segments: [],
    segmentCount: 0,
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
    orientation: mat3.identity,
    position: vec3.create(-1, 10, 0),
    tail: 0,
    wireframeOnly: true,
  };
}

function measureText(text: string): TextMetrics {
  return {
    actualBoundingBoxAscent: 0,
    actualBoundingBoxDescent: 0,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: text.length,
    alphabeticBaseline: 0,
    emHeightAscent: 0,
    emHeightDescent: 0,
    fontBoundingBoxAscent: 0,
    fontBoundingBoxDescent: 0,
    hangingBaseline: 0,
    ideographicBaseline: 0,
    width: text.length,
  };
}
