import { localFrame, mat3, vec3 } from "@solitude/engine/math";
import type {
  PolylineSceneObject,
  ViewRenderParams,
} from "@solitude/engine/render";
import { renderNearDepth } from "@solitude/engine/render/parameters";
import { ProjectionService } from "@solitude/engine/render/projectionService";
import { describe, expect, it } from "vitest";
import { GpuLineRibbonBuilder } from "../../../rasterize/webgl/GpuLineRibbonBuilder";

describe("GPU line ribbon builder", () => {
  it("emits one quad for a single visible trajectory sample", () => {
    const builder = new GpuLineRibbonBuilder();
    const polyline = createPolyline({
      count: 1,
      points: [vec3.create(1, 10, 0)],
      position: vec3.create(-1, 10, 0),
      tail: 0,
    });

    const data = builder.build(createBuildParams(polyline));

    expect(builder.getVertexCount()).toBe(6);
    expect(data.length).toBe(48);
  });

  it("walks the whole trajectory ring instead of only live-to-tail", () => {
    const builder = new GpuLineRibbonBuilder();
    const polyline = createPolyline({
      count: 3,
      points: [
        vec3.create(0, 10, 0),
        vec3.create(1, 10, 0),
        vec3.create(2, 10, 0),
        vec3.create(99, 10, 0),
      ],
      position: vec3.create(-1, 10, 0),
      tail: 2,
    });

    builder.build(createBuildParams(polyline));

    expect(builder.getVertexCount()).toBe(18);
  });

  it("keeps ribbon width in screen space", () => {
    const builder = new GpuLineRibbonBuilder();
    const polyline = createPolyline({
      count: 1,
      lineWidth: 2,
      points: [vec3.create(1, 10, 0)],
      position: vec3.create(-1, 10, 0),
      tail: 0,
    });

    const data = builder.build(
      createBuildParams(polyline, { height: 100, width: 100 }),
    );

    const firstClipY = data[1];
    const oppositeClipY = data[17];
    expect(Math.abs(firstClipY - oppositeClipY)).toBeCloseTo(0.4);
  });

  it("clips segments crossing the near plane", () => {
    const builder = new GpuLineRibbonBuilder();
    const polyline = createPolyline({
      count: 1,
      points: [vec3.create(1, 10, 0)],
      position: vec3.create(-1, renderNearDepth * 0.5, 0),
      tail: 0,
    });

    builder.build(createBuildParams(polyline));

    expect(builder.getVertexCount()).toBe(6);
  });

  it("skips empty, invalid, filtered, and zero-width polylines", () => {
    const builder = new GpuLineRibbonBuilder();
    const valid = createPolyline({
      count: 1,
      id: "trajectory:visible",
      points: [vec3.create(1, 10, 0)],
      position: vec3.create(-1, 10, 0),
      tail: 0,
    });
    const empty = createPolyline({
      count: 0,
      id: "trajectory:empty",
      points: [vec3.create(1, 10, 0)],
      tail: 0,
    });
    const invalidTail = createPolyline({
      count: 1,
      id: "trajectory:invalid",
      points: [vec3.create(1, 10, 0)],
      tail: 2,
    });
    const zeroWidth = createPolyline({
      count: 1,
      id: "trajectory:zero-width",
      lineWidth: 0,
      points: [vec3.create(1, 10, 0)],
      tail: 0,
    });

    builder.build(
      createBuildParams([valid, empty, invalidTail, zeroWidth], {
        objectsFilter: (object) => object.id !== "trajectory:visible",
      }),
    );

    expect(builder.getVertexCount()).toBe(0);
  });

  it("emits one quad for a visible world segment", () => {
    const builder = new GpuLineRibbonBuilder();

    builder.build(
      createBuildParams([], {
        worldSegments: [
          {
            color: { b: 0, g: 255, r: 255 },
            end: vec3.create(1, 10, 0),
            lineWidth: 3,
            start: vec3.create(-1, 10, 0),
          },
        ],
      }),
    );

    expect(builder.getVertexCount()).toBe(6);
  });

  it("gates polylines and world segments independently", () => {
    const builder = new GpuLineRibbonBuilder();
    const polyline = createPolyline({
      count: 1,
      points: [vec3.create(1, 10, 0)],
      position: vec3.create(-1, 10, 0),
      tail: 0,
    });

    builder.build(
      createBuildParams(polyline, {
        renderPolylines: false,
        worldSegments: [
          {
            color: { b: 0, g: 255, r: 255 },
            end: vec3.create(1, 10, 0),
            lineWidth: 3,
            start: vec3.create(-1, 10, 0),
          },
        ],
      }),
    );
    expect(builder.getVertexCount()).toBe(6);

    builder.build(
      createBuildParams(polyline, {
        renderSegments: false,
        worldSegments: [
          {
            color: { b: 0, g: 255, r: 255 },
            end: vec3.create(1, 10, 0),
            lineWidth: 3,
            start: vec3.create(-1, 10, 0),
          },
        ],
      }),
    );
    expect(builder.getVertexCount()).toBe(6);
  });
});

function createBuildParams(
  objectOrObjects: PolylineSceneObject | PolylineSceneObject[],
  options: {
    height?: number;
    objectsFilter?: ViewRenderParams["objectsFilter"];
    renderPolylines?: boolean;
    renderSegments?: boolean;
    width?: number;
    worldSegments?: ViewRenderParams["worldSegments"];
    worldSegmentCount?: number;
  } = {},
) {
  const width = options.width ?? 800;
  const height = options.height ?? 600;
  const worldSegments = options.worldSegments ?? [];
  const camera: ViewRenderParams["camera"] = {
    frame: localFrame.clone({
      forward: vec3.create(0, 1, 0),
      right: vec3.create(1, 0, 0),
      up: vec3.create(0, 0, 1),
    }),
    position: vec3.zero(),
  };
  return {
    objects: Array.isArray(objectOrObjects)
      ? objectOrObjects
      : [objectOrObjects],
    objectsFilter: options.objectsFilter,
    projectionService: new ProjectionService(camera, width, height),
    renderPolylines: options.renderPolylines ?? true,
    renderSegments: options.renderSegments ?? true,
    surfaceHeight: height,
    surfaceWidth: width,
    worldSegmentCount: options.worldSegmentCount ?? worldSegments.length,
    worldSegments,
  };
}

function createPolyline({
  count,
  id = "trajectory:test",
  lineWidth = 2,
  points,
  position = vec3.create(-1, 10, 0),
  tail,
}: {
  count: number;
  id?: string;
  lineWidth?: number;
  points: ReturnType<typeof vec3.create>[];
  position?: ReturnType<typeof vec3.create>;
  tail: number;
}): PolylineSceneObject {
  return {
    applyTransform: false,
    backFaceCulling: false,
    color: { b: 0, g: 128, r: 255 },
    count,
    id,
    kind: "polyline",
    lineWidth,
    mesh: { faces: [], points },
    meshLod: { kind: "none" },
    meshScale: 1,
    meshShading: { kind: "flat" },
    orientation: mat3.identity,
    position,
    tail,
    wireframeOnly: true,
  };
}
