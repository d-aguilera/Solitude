import type { SceneObject } from "../app/appPorts.js";
import { alloc } from "../global/allocProfiler.js";
import { rgbToCss } from "./color.js";
import type { ProjectedSegment, SegmentProjector } from "./renderInternals.js";
import type { RenderedPolyline, ScreenPoint } from "./renderPorts.js";
import { toRenderable } from "./renderPrep.js";

// scratch
let segment: ProjectedSegment = {
  a: { x: 0, y: 0, depth: 0 },
  b: { x: 0, y: 0, depth: 0 },
  clipped: false,
};

export function renderPolylinesInto(
  into: RenderedPolyline[],
  objects: SceneObject[],
  projectSegmentInto: SegmentProjector,
  objectsFilter?: (obj: SceneObject) => boolean,
): number {
  return alloc.withName(renderPolylinesInto.name, () => {
    let intoCount = 0;
    let pointCount = 0;
    let current: RenderedPolyline;

    const updateOrPush = (p: ScreenPoint) => {
      const { points } = current;
      if (pointCount < points.length) {
        const point = points[pointCount];
        point.depth = p.depth;
        point.x = p.x;
        point.y = p.y;
      } else {
        points.push({
          depth: p.depth,
          x: p.x,
          y: p.y,
        });
      }
      pointCount++;
    };

    const flush = () => {
      current.pointCount = pointCount;
      intoCount++;
      pointCount = 0;
    };

    objects.forEach((obj) => {
      if (objectsFilter && !objectsFilter(obj)) return;

      const { baseColor, lineWidth, mesh, worldPoints } = toRenderable(obj);

      for (let polyIndices of mesh.faces) {
        const length = polyIndices.length;
        // Accumulate continuous visible segments for this logical polyline.
        for (let j = 1; j < length; j++) {
          const a = worldPoints[polyIndices[j - 1]];
          const b = worldPoints[polyIndices[j]];
          if (projectSegmentInto(segment, a, b)) {
            // Handle initial point
            if (pointCount === 0) {
              // Grow output array if necessary
              if (intoCount === into.length) {
                current = {
                  cssColor: rgbToCss(baseColor),
                  lineWidth,
                  pointCount: 0,
                  points: [],
                };
                into.push(current);
              } else {
                current = into[intoCount];
                current.cssColor = rgbToCss(baseColor);
                current.lineWidth = lineWidth;
              }
              // Add initial point
              updateOrPush(segment.a);
            }
            // Extend current polyline
            updateOrPush(segment.b);
            if (segment.clipped && pointCount > 2) {
              // Was fully visible but now it's not => flush
              flush();
            }
          }
        }

        // Flush last polyline (if any)
        if (pointCount > 0) {
          flush();
        }
      }
    });

    return intoCount;
  });
}
