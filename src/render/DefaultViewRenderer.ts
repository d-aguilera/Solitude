import type { PlanetSceneObject } from "../app/appPorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import { ProjectionService } from "./ProjectionService.js";
import { renderBodyLabels } from "./renderBodyLabels.js";
import { renderFaces } from "./renderFaces.js";
import { renderPolylines } from "./renderPolylines.js";
import { drawMode } from "./renderPorts.js";
import type {
  RenderedBodyLabel,
  RenderedFace,
  RenderedPolyline,
  RenderedSegment,
  RenderedView,
  TextMetrics,
  ViewRenderer,
  ViewRenderParams,
} from "./renderPorts.js";
import { renderVelocitySegments } from "./renderVelocitySegments.js";

export class DefaultViewRenderer implements ViewRenderer {
  // Per-view grow-only scratch buffers for shaded faces.
  private shadedFaceBuffer: RenderedFace[] = [];

  constructor(
    private readonly measureText: (text: string, font: string) => TextMetrics,
  ) {}

  render({ mainShip, camera, surface, scene }: ViewRenderParams): RenderedView {
    const projectionService = new ProjectionService(
      camera,
      surface.width,
      surface.height,
    );

    const project = (wp: Vec3) => projectionService.projectWorldPointToNdc(wp);
    const projectSegment = (a: Vec3, b: Vec3) =>
      projectionService.projectWorldSegmentToScreen(
        a,
        b,
        surface.width,
        surface.height,
      );

    const faces: RenderedFace[] =
      drawMode === "faces"
        ? renderFaces(scene, camera, surface, this.shadedFaceBuffer)
        : [];

    const polylines: RenderedPolyline[] =
      drawMode === "faces"
        ? renderPolylines(
            surface,
            scene.objects.filter((obj) => obj.wireframeOnly),
            projectSegment,
          )
        : renderPolylines(surface, scene.objects, projectSegment);

    const segments: RenderedSegment[] = renderVelocitySegments(
      surface,
      mainShip,
      project,
    );

    const overlayBodies: PlanetSceneObject[] = scene.objects.filter(
      (obj): obj is PlanetSceneObject =>
        obj.kind === "planet" || obj.kind === "star",
    );

    const bodyLabels: RenderedBodyLabel[] = renderBodyLabels(
      surface,
      overlayBodies,
      mainShip.position,
      project,
      this.measureText,
    );

    return { faces, polylines, segments, bodyLabels };
  }
}
