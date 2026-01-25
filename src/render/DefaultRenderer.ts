import type {
  DomainCameraPose,
  DrawMode,
  PlanetSceneObject,
  ProfilerController,
  Scene,
  SceneObject,
} from "../app/appPorts.js";
import { getSignedThrustPercent } from "../app/controls.js";
import { fps } from "../app/fps.js";
import { getShipById } from "../app/worldLookup.js";
import type { ShipBody, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import type {
  Rasterizer,
  RenderedBodyLabel,
  RenderedFace,
  RenderedHud,
  RenderedPolyline,
  RenderedSegment,
  RenderedView,
  Renderer,
  RenderParams,
  RenderSurface2D,
} from "./renderPorts.js";
import { renderFaces } from "./renderFaces.js";
import { renderPolylines } from "./renderPolylines.js";
import { renderBodyLabels } from "./renderBodyLabels.js";
import { renderVelocitySegments } from "./renderVelocitySegments.js";
import { ProjectionService } from "./ProjectionService.js";

const drawMode: DrawMode = "faces";

const isNotPolylinePath = (obj: SceneObject) =>
  obj.kind !== "polyline" || !obj.id.startsWith("path:");

export class DefaultRenderer implements Renderer {
  constructor(
    private readonly pilotRasterizer: Rasterizer,
    private readonly topRasterizer: Rasterizer,
    private profilerController: ProfilerController,
  ) {}

  renderCurrentFrame({
    input,
    controlState,
    scene,
    world,
    mainShipId,
    pilotCamera,
    topCamera,
    pilotSurface,
    topSurface,
    pilotCameraLocalOffset,
  }: RenderParams): void {
    const mainShip = getShipById(world, mainShipId);
    const overlayBodies: PlanetSceneObject[] = scene.objects.filter(
      (obj): obj is PlanetSceneObject =>
        obj.kind === "planet" || obj.kind === "star",
    );

    var pilotData: RenderedView = renderPilotView(
      pilotCamera,
      pilotSurface,
      scene,
      mainShip,
      overlayBodies,
    );

    var topData: RenderedView = renderTopView(
      topCamera,
      topSurface,
      scene,
      mainShip,
      overlayBodies,
    );

    const profilingEnabled = this.profilerController.isEnabled();
    const thrustPercent = getSignedThrustPercent(input, controlState);

    var hudData = renderHud(
      mainShip,
      pilotCameraLocalOffset,
      profilingEnabled,
      thrustPercent,
    );

    this.pilotRasterizer.clear(pilotSurface, "#000000");
    this.pilotRasterizer.drawFaces(pilotSurface, pilotData.faces);
    this.pilotRasterizer.drawPolylines(pilotSurface, pilotData.polylines);
    this.pilotRasterizer.drawSegments(pilotSurface, pilotData.segments);
    this.pilotRasterizer.drawBodyLabels(pilotSurface, pilotData.bodyLabels);

    this.topRasterizer.clear(topSurface, "#000000");
    this.topRasterizer.drawFaces(topSurface, topData.faces);
    this.topRasterizer.drawPolylines(topSurface, topData.polylines);
    this.topRasterizer.drawSegments(topSurface, topData.segments);
    this.topRasterizer.drawBodyLabels(topSurface, topData.bodyLabels);

    this.pilotRasterizer.drawHud(pilotSurface, hudData);
  }
}

function renderPilotView(
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
    drawMode === "faces" ? renderFaces(pilotScene, camera, surface) : [];

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

function renderTopView(
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
    drawMode === "faces" ? renderFaces(topScene, camera, surface) : [];

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

function renderHud(
  mainShip: ShipBody,
  pilotCameraLocalOffset: Vec3,
  profilingEnabled: boolean,
  thrustPercent: number,
): RenderedHud {
  return {
    speedMps: vec3.length(mainShip.velocity),
    fps,
    profilingEnabled,
    pilotCameraLocalOffset,
    thrustPercent,
  };
}
