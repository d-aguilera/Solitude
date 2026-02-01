import type { SceneObject } from "../app/appPorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import { alloc } from "../infra/allocProfiler.js";
import { rgbToCss } from "./color.js";
import type {
  RenderedPolyline,
  RenderSurface2D,
  ScreenPoint,
} from "./renderPorts.js";
import { toRenderable } from "./renderPrep.js";

type SegmentProjector = (aWorld: Vec3, bWorld: Vec3) => ScreenPoint[][];

export function renderPolylines(
  surface: RenderSurface2D,
  objects: SceneObject[],
  projectSegment: SegmentProjector,
): RenderedPolyline[] {
  return alloc.withName("renderPolylines", () => {
    const renderedPolylines: RenderedPolyline[] = [];
    const { width, height } = surface;
    void width;
    void height;

    objects.forEach((obj) => {
      const { mesh, worldPoints, baseColor, lineWidth } = toRenderable(obj);
      const { faces } = mesh;
      const cssColor = rgbToCss(baseColor);

      for (let i = 0; i < faces.length; i++) {
        const polyIndices = faces[i];

        // Accumulate continuous visible stretches for this logical polyline.
        let currentPoints: ScreenPoint[] = [];

        for (let j = 0; j < polyIndices.length - 1; j++) {
          const idxA = polyIndices[j];
          const idxB = polyIndices[j + 1];

          const aWorld = worldPoints[idxA];
          const bWorld = worldPoints[idxB];

          const segments = projectSegment(aWorld, bWorld);

          if (segments.length === 0) {
            // Segment fully invisible: flush current polyline (if any).
            if (currentPoints.length >= 2) {
              renderedPolylines.push({
                points: currentPoints,
                cssColor,
                lineWidth,
              });
            }
            currentPoints = [];
            continue;
          }

          // We only ever expect at most one segment per world segment with this
          // clipping scheme, but we handle the general shape.
          for (const seg of segments) {
            const [pStart, pEnd] = seg;

            if (currentPoints.length === 0) {
              // Start a new visible polyline.
              currentPoints.push(pStart, pEnd);
            } else {
              const last = currentPoints[currentPoints.length - 1];

              // If the new segment starts where the last one ended, avoid
              // duplicating the vertex; otherwise, start a new polyline.
              if (last.x === pStart.x && last.y === pStart.y) {
                currentPoints.push(pEnd);
              } else {
                if (currentPoints.length >= 2) {
                  renderedPolylines.push({
                    points: currentPoints,
                    cssColor,
                    lineWidth,
                  });
                }
                currentPoints = [pStart, pEnd];
              }
            }
          }
        }

        // Flush any remaining visible stretch for this face.
        if (currentPoints.length >= 2) {
          renderedPolylines.push({
            points: currentPoints,
            cssColor,
            lineWidth,
          });
        }
      }
    });

    return renderedPolylines;
  });
}
