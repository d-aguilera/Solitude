import type { PlanetSceneObject } from "../app/appPorts.js";
import type {
  Rasterizer,
  RenderedHud,
  RenderedView,
  Renderer,
  RenderParams,
} from "./renderPorts.js";
import { renderPilotView, renderTopView } from "./renderViews.js";

export class DefaultRenderer implements Renderer {
  constructor(
    private readonly pilotRasterizer: Rasterizer,
    private readonly topRasterizer: Rasterizer,
  ) {}

  renderCurrentFrame({
    scene,
    mainShip,
    pilotCamera,
    topCamera,
    fps,
    currentThrustLevel,
    pilotCameraLocalOffset,
    speedMps,
    pilotSurface,
    topSurface,
    profilingEnabled,
  }: RenderParams): void {
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

    var hudData: RenderedHud = {
      currentThrustLevel,
      fps,
      pilotCameraLocalOffset,
      profilingEnabled,
      speedMps,
    };

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
