import type {
  DomainCameraPose,
  DrawMode,
  PlanetSceneObject,
  Scene,
  SceneObject,
} from "../app/appPorts.js";
import type { ShipBody, Vec3 } from "../domain/domainPorts.js";
import { ProjectionService } from "./ProjectionService.js";
import { renderBodyLabels } from "./renderBodyLabels.js";
import { renderFaces } from "./renderFaces.js";
import { renderPolylines } from "./renderPolylines.js";
import type {
  RenderSurface2D,
  RenderedView,
  RenderedFace,
  RenderedPolyline,
  RenderedSegment,
  RenderedBodyLabel,
} from "./renderPorts.js";
import { renderVelocitySegments } from "./renderVelocitySegments.js";

const drawMode: DrawMode = "faces";

const isNotPolylinePath = (obj: SceneObject) =>
  obj.kind !== "polyline" || !obj.id.startsWith("path:");

// Per-view grow-only scratch buffers for shaded faces.
const pilotShadedFaceBuffer: RenderedFace[] = [];
const topShadedFaceBuffer: RenderedFace[] = [];

export function renderPilotView(
  camera: DomainCameraPose,
  surface: RenderSurface2D,
  scene: Scene,
  mainShip: ShipBody,
  overlayBodies: PlanetSceneObject[],
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

  const pilotScene: Scene = scene; // full, unfiltered

  const faces: RenderedFace[] =
    drawMode === "faces"
      ? renderFaces(pilotScene, camera, surface, pilotShadedFaceBuffer)
      : [];

  const polylines: RenderedPolyline[] =
    drawMode === "faces"
      ? renderPolylines(
          surface,
          pilotScene.objects.filter((obj) => obj.wireframeOnly),
          projectSegment,
        )
      : renderPolylines(surface, pilotScene.objects, projectSegment);

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

  return {
    faces,
    polylines,
    segments,
    bodyLabels,
  };
}

export function renderTopView(
  camera: DomainCameraPose,
  surface: RenderSurface2D,
  scene: Scene,
  mainShip: ShipBody,
  overlayBodies: PlanetSceneObject[],
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

  // Top scene: no trajectory polylines
  const topScene: Scene = {
    ...scene,
    objects: scene.objects.filter(isNotPolylinePath),
  };

  const faces: RenderedFace[] =
    drawMode === "faces"
      ? renderFaces(topScene, camera, surface, topShadedFaceBuffer)
      : [];

  const polylines: RenderedPolyline[] =
    drawMode === "faces"
      ? renderPolylines(
          surface,
          topScene.objects.filter((obj) => obj.wireframeOnly),
          projectSegment,
        )
      : renderPolylines(surface, topScene.objects, projectSegment);

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
