import type { SceneObject } from "../app/appPorts.js";
import type { Mesh, RGB, Vec3 } from "../domain/domainPorts.js";
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

export function renderPolylines(
  objects: SceneObject[],
  projectSegmentInto: SegmentProjector,
): RenderedPolyline[] {
  return alloc.withName(renderPolylines.name, () => {
    const renderedPolylines: RenderedPolyline[] = [];

    let mesh: Mesh;
    let worldPoints: Vec3[];
    let baseColor: RGB;
    let lineWidth = 0;
    let count: number;
    let cssColor = "";
    const addOrPush = (p: ScreenPoint) => {
      if (count < scratchPoints.length) {
        scratchPoints[count] = p;
      } else {
        scratchPoints.push(p);
      }
      count++;
    };
    const flush = () => {
      renderedPolylines.push({
        points: scratchPoints.slice(0, count),
        cssColor,
        lineWidth,
      });
      count = 0;
    };

    objects.forEach((obj) => {
      ({ mesh, worldPoints, baseColor, lineWidth } = toRenderable(obj));
      cssColor = rgbToCss(baseColor);

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

    return renderedPolylines;
  });
}
