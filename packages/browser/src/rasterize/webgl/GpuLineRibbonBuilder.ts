import type { Vec3 } from "@solitude/engine/math";
import type { WorldSegment } from "@solitude/engine/plugin";
import type { PolylineSceneObject, SceneObject } from "@solitude/engine/render";
import { renderNearDepth } from "@solitude/engine/render/parameters";
import type { ProjectionService } from "@solitude/engine/render/projectionService";

const floatsPerVertex = 8;
const verticesPerSegment = 6;
const floatsPerSegment = floatsPerVertex * verticesPerSegment;

interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
}

interface ProjectedSegment {
  a: ScreenPoint;
  b: ScreenPoint;
  clipped: boolean;
}

interface LineStyle {
  color: { r: number; g: number; b: number };
  lineWidth: number;
}

export interface LineRibbonBuildParams {
  objects: readonly SceneObject[];
  objectsFilter?: (obj: SceneObject) => boolean;
  projectionService: ProjectionService;
  renderPolylines: boolean;
  renderSegments: boolean;
  surfaceHeight: number;
  surfaceWidth: number;
  worldSegmentCount: number;
  worldSegments: readonly WorldSegment[];
}

export class GpuLineRibbonBuilder {
  private data = new Float32Array(floatsPerSegment);
  private vertexCount = 0;
  private readonly segment: ProjectedSegment = {
    a: { depth: 0, x: 0, y: 0 },
    b: { depth: 0, x: 0, y: 0 },
    clipped: false,
  };

  build(params: LineRibbonBuildParams): Float32Array {
    this.vertexCount = 0;
    if (params.renderPolylines) this.buildPolylines(params);
    if (params.renderSegments) this.buildWorldSegments(params);
    return this.data.subarray(0, this.vertexCount * floatsPerVertex);
  }

  getVertexCount(): number {
    return this.vertexCount;
  }

  private buildPolylines(params: LineRibbonBuildParams): void {
    const objects = params.objects;
    for (let index = 0; index < objects.length; index++) {
      const object = objects[index];
      if (object.kind !== "polyline") continue;
      if (params.objectsFilter && !params.objectsFilter(object)) continue;
      this.buildPolyline(object, params);
    }
  }

  private buildWorldSegments(params: LineRibbonBuildParams): void {
    const segments = params.worldSegments;
    for (let index = 0; index < params.worldSegmentCount; index++) {
      const segment = segments[index];
      this.processSegment(segment, segment.start, segment.end, params);
    }
  }

  private buildPolyline(
    object: PolylineSceneObject,
    params: LineRibbonBuildParams,
  ): void {
    const points = object.mesh.points;
    const pointCapacity = points.length;
    const count = object.count;
    const tail = object.tail;
    if (pointCapacity === 0) return;
    if (count <= 0 || tail < 0 || tail >= pointCapacity) return;
    if (object.lineWidth <= 0) return;

    const head = (tail - count + pointCapacity) % pointCapacity;
    let prev = -1;
    let curr = tail;

    this.processSegment(object, object.position, points[curr], params);
    prev = curr;
    curr = (curr - 1 + pointCapacity) % pointCapacity;

    while (curr !== head) {
      this.processSegment(object, points[prev], points[curr], params);
      prev = curr;
      curr = (curr - 1 + pointCapacity) % pointCapacity;
    }
  }

  private processSegment(
    style: LineStyle,
    aWorld: Vec3,
    bWorld: Vec3,
    params: LineRibbonBuildParams,
  ): void {
    if (
      params.projectionService.projectWorldSegmentToScreenInto(
        this.segment,
        aWorld,
        bWorld,
        params.surfaceWidth,
        params.surfaceHeight,
      )
    ) {
      this.appendSegment(style, params.surfaceWidth, params.surfaceHeight);
    }
  }

  private appendSegment(
    style: LineStyle,
    surfaceWidth: number,
    surfaceHeight: number,
  ): void {
    const a = this.segment.a;
    const b = this.segment.b;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0 || !Number.isFinite(length)) return;
    if (style.lineWidth <= 0) return;

    const halfWidth = style.lineWidth * 0.5;
    const offsetX = (-dy / length) * halfWidth;
    const offsetY = (dx / length) * halfWidth;
    const r = style.color.r / 255;
    const g = style.color.g / 255;
    const bl = style.color.b / 255;

    this.ensureAdditionalVertices(verticesPerSegment);
    this.appendVertex(
      a.x + offsetX,
      a.y + offsetY,
      a.depth,
      surfaceWidth,
      surfaceHeight,
      r,
      g,
      bl,
    );
    this.appendVertex(
      b.x + offsetX,
      b.y + offsetY,
      b.depth,
      surfaceWidth,
      surfaceHeight,
      r,
      g,
      bl,
    );
    this.appendVertex(
      a.x - offsetX,
      a.y - offsetY,
      a.depth,
      surfaceWidth,
      surfaceHeight,
      r,
      g,
      bl,
    );
    this.appendVertex(
      a.x - offsetX,
      a.y - offsetY,
      a.depth,
      surfaceWidth,
      surfaceHeight,
      r,
      g,
      bl,
    );
    this.appendVertex(
      b.x + offsetX,
      b.y + offsetY,
      b.depth,
      surfaceWidth,
      surfaceHeight,
      r,
      g,
      bl,
    );
    this.appendVertex(
      b.x - offsetX,
      b.y - offsetY,
      b.depth,
      surfaceWidth,
      surfaceHeight,
      r,
      g,
      bl,
    );
  }

  private appendVertex(
    screenX: number,
    screenY: number,
    depth: number,
    surfaceWidth: number,
    surfaceHeight: number,
    r: number,
    g: number,
    b: number,
  ): void {
    const ndcX = (screenX / surfaceWidth) * 2 - 1;
    const ndcY = 1 - (screenY / surfaceHeight) * 2;
    const offset = this.vertexCount * floatsPerVertex;
    this.data[offset] = ndcX * depth;
    this.data[offset + 1] = ndcY * depth;
    this.data[offset + 2] = depth - 2 * renderNearDepth;
    this.data[offset + 3] = depth;
    this.data[offset + 4] = depth;
    this.data[offset + 5] = r;
    this.data[offset + 6] = g;
    this.data[offset + 7] = b;
    this.vertexCount++;
  }

  private ensureAdditionalVertices(additionalVertexCount: number): void {
    const required =
      (this.vertexCount + additionalVertexCount) * floatsPerVertex;
    if (this.data.length >= required) return;
    let nextLength = this.data.length;
    while (nextLength < required) nextLength *= 2;
    const next = new Float32Array(nextLength);
    next.set(this.data);
    this.data = next;
  }
}

export const gpuLineRibbonFloatsPerVertex = floatsPerVertex;
