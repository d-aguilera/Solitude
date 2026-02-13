import type { SceneObject } from "../app/appPorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import { alloc } from "../global/allocProfiler.js";
import { rgbToCss } from "./color.js";
import type { RenderedPolyline, ScreenPoint } from "./renderPorts.js";
import { toRenderable } from "./renderPrep.js";

type SegmentProjector = (aWorld: Vec3, bWorld: Vec3) => ScreenPoint[][];

// Grow-only scratch buffer reused across renderPolylines calls for the
// current continuous visible stretch of a logical polyline.
const scratchPoints: ScreenPoint[] = [];

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

      for (let i = 0; i < faces.length; i++) {
        const polyIndices = faces[i];

        // Accumulate continuous visible stretches for this logical polyline.
        //
        // scratchPoints is a grow-only scratch buffer; we clear its logical
        // length for each new stretch, and clone the used prefix when
        // emitting a RenderedPolyline so that callers do not retain the
        // scratch storage.
        scratchPoints.length = 0;

        for (let j = 0; j < polyIndices.length - 1; j++) {
          const idxA = polyIndices[j];
          const idxB = polyIndices[j + 1];

          const aWorld = worldPoints[idxA];
          const bWorld = worldPoints[idxB];

          const segments = projectSegment(aWorld, bWorld);

          if (segments.length === 0) {
            // Segment fully invisible: flush current polyline (if any).
            if (scratchPoints.length >= 2) {
              renderedPolylines.push({
                // Clone only the used prefix so the result is stable and
                // independent of the shared scratch buffer.
                points: scratchPoints.slice(0, scratchPoints.length),
                cssColor,
                lineWidth,
              });
            }
            scratchPoints.length = 0;
            continue;
          }

          // We only ever expect at most one segment per world segment with this
          // clipping scheme, but we handle the general shape.
          for (const seg of segments) {
            const [pStart, pEnd] = seg;

            if (scratchPoints.length === 0) {
              // Start a new visible polyline.
              scratchPoints.push(pStart, pEnd);
            } else {
              const last = scratchPoints[scratchPoints.length - 1];

              // If the new segment starts where the last one ended, avoid
              // duplicating the vertex; otherwise, start a new polyline.
              if (last.x === pStart.x && last.y === pStart.y) {
                scratchPoints.push(pEnd);
              } else {
                if (scratchPoints.length >= 2) {
                  renderedPolylines.push({
                    points: scratchPoints.slice(0, scratchPoints.length),
                    cssColor,
                    lineWidth,
                  });
                }
                scratchPoints.length = 0;
                scratchPoints.push(pStart, pEnd);
              }
            }
          }
        }

        // Flush any remaining visible stretch for this face.
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
