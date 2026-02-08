import type {
  DomainCameraPose,
  PlanetSceneObject,
  Scene,
} from "../app/appPorts.js";
import type { ShipBody, Vec3 } from "../domain/domainPorts.js";
import { ProjectionService } from "./ProjectionService.js";
import { renderBodyLabels } from "./renderBodyLabels.js";
import { renderFaces } from "./renderFaces.js";
import { renderPolylines } from "./renderPolylines.js";
import { drawMode } from "./renderPorts.js";
import type {
  RenderSurface2D,
  RenderedView,
  RenderedFace,
  RenderedPolyline,
  RenderedSegment,
  RenderedBodyLabel,
} from "./renderPorts.js";
import { renderVelocitySegments } from "./renderVelocitySegments.js";

export function renderView(
  camera: DomainCameraPose,
  surface: RenderSurface2D,
  scene: Scene,
  mainShip: ShipBody,
  overlayBodies: PlanetSceneObject[],
  shadedFaceBuffer: RenderedFace[],
): RenderedView {
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
      ? renderFaces(scene, camera, surface, shadedFaceBuffer)
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

  const bodyLabels: RenderedBodyLabel[] = renderBodyLabels(
    surface,
    overlayBodies,
    mainShip.position,
    project,
  );

  return { faces, polylines, segments, bodyLabels };
}
