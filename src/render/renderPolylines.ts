import type { SceneObject } from "../app/appPorts.js";
import { alloc } from "../global/allocProfiler.js";
import { rgbToCss } from "./color.js";
import type { ProjectedSegment, SegmentProjector } from "./renderInternals.js";
import type { RenderedPolyline, ScreenPoint } from "./renderPorts.js";
import { toRenderable } from "./renderPrep.js";

// Grow-only scratch buffer reused across renderPolylines calls for the
// current continuous visible stretch of a logical polyline.
const scratchPoints: ScreenPoint[] = [];

// scratch
let polyIndices: number[];
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
    let cssColor = "";
    let lineWidth = 0;
    let count: number;

    const addOrPush = (p: ScreenPoint) => {
      if (count < scratchPoints.length) scratchPoints[count] = p;
      else scratchPoints.push(p);
      count++;
    };

    const flush = () => {
      if (intoCount < into.length) {
        const entry = into[intoCount];
        entry.cssColor = cssColor;
        entry.lineWidth = lineWidth;
        entry.points = scratchPoints.slice(0, count);
      } else {
        into.push({
          points: scratchPoints.slice(0, count),
          cssColor,
          lineWidth,
        });
      }
      intoCount++;
      count = 0;
    };

    objects.forEach((obj) => {
      if (objectsFilter && !objectsFilter(obj)) return;

      const renderable = toRenderable(obj);
      const { mesh, worldPoints } = renderable;
      cssColor = rgbToCss(renderable.baseColor);
      lineWidth = renderable.lineWidth;

      count = 0;
      for (polyIndices of mesh.faces) {
        const length = polyIndices.length;
        // Accumulate continuous visible segments for this logical polyline.
        for (let j = 1; j < length; j++) {
          const a = worldPoints[polyIndices[j - 1]];
          const b = worldPoints[polyIndices[j]];
          if (projectSegmentInto(segment, a, b)) {
            if (count === 0) {
              // Add initial point
              addOrPush(segment.a);
            }
            // Extend the current polyline
            addOrPush(segment.b);
            if (segment.clipped && count > 2) {
              // Was fully visible but now it's not => flush
              flush();
            }
          }
        }

        // Flush last polyline (if any)
        if (count > 0) {
          flush();
        }
      }
    });

    return intoCount;
  });
}
