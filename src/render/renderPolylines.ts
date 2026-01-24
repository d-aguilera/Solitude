import type { SceneObject } from "../app/appPorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import { rgbToCss } from "./color.js";
import { ndcToScreen } from "./ndcToScreen.js";
import type {
  NdcPoint,
  RenderedPolyline,
  RenderSurface2D,
  ScreenPoint,
} from "./renderPorts.js";
import { toRenderable } from "./renderPrep.js";

export function renderPolylines(
  surface: RenderSurface2D,
  objects: SceneObject[],
  project: (worldPoint: Vec3) => NdcPoint | null,
): RenderedPolyline[] {
  const renderedPolylines: RenderedPolyline[] = [];
  const { width, height } = surface;

  objects.forEach((obj) => {
    const { mesh, worldPoints, baseColor, lineWidth } = toRenderable(obj);
    const { faces } = mesh;
    const cssColor = rgbToCss(baseColor);

    for (let i = 0; i < faces.length; i++) {
      const polyIndices = faces[i];
      const projectedPoints: ScreenPoint[] = [];

      for (let j = 0; j < polyIndices.length; j++) {
        const wp = worldPoints[polyIndices[j]];

        const ndc = project(wp);
        if (!ndc) {
          projectedPoints.length = 0;
          break;
        }

        const screenPoint = ndcToScreen(ndc, width, height);
        projectedPoints.push(screenPoint);
      }

      if (projectedPoints.length > 0) {
        renderedPolylines.push({
          points: projectedPoints,
          cssColor,
          lineWidth,
        });
      }
    }
  });

  return renderedPolylines;
}
