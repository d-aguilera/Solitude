import type { PlanetSceneObject } from "../app/appPorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import { ProjectionService } from "./ProjectionService.js";
import { renderBodyLabels } from "./renderBodyLabels.js";
import { renderFaces } from "./renderFaces.js";
import type { ProjectedSegment, SegmentProjector } from "./renderInternals.js";
import { renderPolylines } from "./renderPolylines.js";
import { drawMode } from "./renderPorts.js";
import type {
  NdcPoint,
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
    const { width: screenWidth, height: screenHeight } = surface;

    const projectionService = new ProjectionService(
      camera,
      screenWidth,
      screenHeight,
    );

    const projectInto = (into: NdcPoint, wp: Vec3) =>
      projectionService.projectWorldPointToNdcInto(into, wp);

    const projectSegmentInto: SegmentProjector = (
      into: ProjectedSegment,
      a: Vec3,
      b: Vec3,
    ) =>
      projectionService.projectWorldSegmentToScreenInto(
        into,
        a,
        b,
        screenWidth,
        screenHeight,
      );

    const faces: RenderedFace[] =
      drawMode === "faces"
        ? renderFaces(
            scene,
            camera,
            screenWidth,
            screenHeight,
            this.shadedFaceBuffer,
          )
        : [];

    const polylines: RenderedPolyline[] =
      drawMode === "faces"
        ? renderPolylines(
            scene.objects.filter((obj) => obj.wireframeOnly),
            projectSegmentInto,
          )
        : renderPolylines(scene.objects, projectSegmentInto);

    const segments: RenderedSegment[] = renderVelocitySegments(
      mainShip,
      projectSegmentInto,
    );

    const overlayBodies: PlanetSceneObject[] = scene.objects.filter(
      (obj): obj is PlanetSceneObject =>
        obj.kind === "planet" || obj.kind === "star",
    );

    const bodyLabels: RenderedBodyLabel[] = renderBodyLabels(
      overlayBodies,
      mainShip.position,
      screenWidth,
      screenHeight,
      projectInto,
      this.measureText,
    );

    return { faces, polylines, segments, bodyLabels };
  }
}
