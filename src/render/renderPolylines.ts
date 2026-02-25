import type { SceneObject } from "../app/appPorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import { alloc } from "../global/allocProfiler.js";
import { rgbToCss } from "./color.js";
import { ndcZero } from "./ndc.js";
import type { ProjectedSegment, SegmentProjector } from "./renderInternals.js";
import type { RenderedPolyline, ScreenPoint } from "./renderPorts.js";

// scratch
let segment: ProjectedSegment = {
  a: ndcZero(),
  b: ndcZero(),
  clipped: false,
};

/**
 * Renders polylines into the given array, growing the array if needed.
 * @param into the array to render into
 * @param objects the scene objects to render
 * @param projectSegmentInto a function to project a segment into screen space
 * @param objectsFilter a function to filter scene objects
 * @returns the number of rendered polylines.
 */
export function renderPolylinesInto(
  into: RenderedPolyline[],
  objects: SceneObject[],
  projectSegmentInto: SegmentProjector,
  objectsFilter: (obj: SceneObject) => boolean,
): number {
  return alloc.withName(renderPolylinesInto.name, () => {
    let intoCount = 0;
    let pointCount = 0;
    let current: RenderedPolyline | undefined;
    let screenPoints: ScreenPoint[];
    let obj: SceneObject;
    let meshPoints: Vec3[];
    let prev = -1,
      curr: number,
      head: number;

    for (obj of objects) {
      if (obj.kind !== "polyline") continue;
      if (objectsFilter && !objectsFilter(obj)) continue;
      if (obj.mesh.points.length === 0) continue;

      const { count, mesh, tail } = obj;
      meshPoints = mesh.points;
      head = (tail - count + meshPoints.length) % meshPoints.length;

      // Start a new polyline
      // first point: the object's live position
      // second point: the mesh tail (most recently added point)
      curr = tail;
      processSegment(obj.position, meshPoints[curr]);

      // continue to walk the mesh points up to the head
      while (curr !== head) {
        processSegment(meshPoints[prev], meshPoints[curr]);
      }

      // Flush last polyline (if any)
      flushCurrent();
    }

    return intoCount;

    function processSegment(p1: Vec3, p2: Vec3) {
      // check if p1-p2 segment is visible (fully or partially)
      /** @see SegmentProjector */
      if (projectSegmentInto(segment, p1, p2)) {
        if (pointCount === 0) {
          startNew();
          addPointToCurrent(segment.a);
        }
        addPointToCurrent(segment.b);
        if (segment.clipped && pointCount > 2) {
          // Polyline crossed the camera plane => flush it
          flushCurrent();
        }
      }
      prev = curr;
      // move current pointer backwards and wrap around
      curr = (curr - 1 + meshPoints.length) % meshPoints.length;
    }

    function startNew() {
      const { color, lineWidth } = obj;
      current = into[intoCount];
      if (current) {
        current.cssColor = rgbToCss(color);
        current.lineWidth = lineWidth;
        current.pointCount = pointCount;
      } else {
        current = {
          cssColor: rgbToCss(color),
          lineWidth,
          pointCount,
          points: [],
        };
        into[intoCount] = current;
      }
      screenPoints = current.points;
      intoCount++;
    }

    function addPointToCurrent(p: ScreenPoint) {
      const point = screenPoints[pointCount];
      if (point) {
        point.depth = p.depth;
        point.x = p.x;
        point.y = p.y;
      } else {
        screenPoints[pointCount] = {
          depth: p.depth,
          x: p.x,
          y: p.y,
        };
      }
      pointCount++;
    }

    function flushCurrent() {
      if (!current || pointCount === 0) return;
      current.pointCount = pointCount;
      current = undefined;
      pointCount = 0;
    }
  });
}
