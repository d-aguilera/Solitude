import type { SceneObject } from "../app/appPorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import { alloc } from "../global/allocProfiler.js";
import { rgbToCss } from "./color.js";
import type { RenderedPolyline, ScreenPoint } from "./renderPorts.js";
import { toRenderable } from "./renderPrep.js";

type ProjectedSegment = {
  a: ScreenPoint;
  b: ScreenPoint;
  clipped: boolean;
};

type SegmentProjector = (a: Vec3, b: Vec3) => ProjectedSegment | undefined;

// Grow-only scratch buffer reused across renderPolylines calls for the
// current continuous visible stretch of a logical polyline.
const scratchPoints: ScreenPoint[] = [];

// scratch
let polyIndices: number[];
let idxA: number;
let idxB: number;
let segment: ProjectedSegment | undefined;

export function renderPolylines(
  objects: SceneObject[],
  projectSegment: SegmentProjector,
): RenderedPolyline[] {
  return alloc.withName(renderPolylines.name, () => {
    const renderedPolylines: RenderedPolyline[] = [];

    objects.forEach((obj) => {
      const { mesh, worldPoints, baseColor, lineWidth } = toRenderable(obj);
      const { faces } = mesh;
      const cssColor = rgbToCss(baseColor);

      for (polyIndices of faces) {
        // Accumulate continuous visible stretches for this logical polyline.
        //
        // scratchPoints is a grow-only scratch buffer; we clear its logical
        // length for each new stretch, and clone the used prefix when
        // emitting a RenderedPolyline so that callers do not retain the
        // scratch storage.
        scratchPoints.length = 0;

        for (let j = 1; j < polyIndices.length; j++) {
          idxA = polyIndices[j - 1];
          idxB = polyIndices[j];
          segment = projectSegment(worldPoints[idxA], worldPoints[idxB]);

          if (segment) {
            if (scratchPoints.length === 0) {
              // Start a new visible polyline
              scratchPoints.push(segment.a, segment.b);
            } else {
              // Extend the current polyline
              scratchPoints.push(segment.b);
            }
            if (segment.clipped && scratchPoints.length > 2) {
              // Was fully visible but now it's not => flush
              renderedPolylines.push({
                points: scratchPoints.slice(0, scratchPoints.length),
                cssColor,
                lineWidth,
              });
              scratchPoints.length = 0;
            }
          }
        }

        // Flush last polyline (if any)
        if (scratchPoints.length >= 2) {
          renderedPolylines.push({
            points: scratchPoints.slice(0, scratchPoints.length),
            cssColor,
            lineWidth,
          });
        }
      }
    });

    return renderedPolylines;
  });
}
