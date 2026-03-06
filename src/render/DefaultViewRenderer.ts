import type { PolylineSceneObject, SceneObject } from "../app/appPorts.js";
import type { Vec3 } from "../domain/vec3.js";
import type { NdcPoint } from "./ndc.js";
import { ProjectionService } from "./ProjectionService.js";
import { renderBodyLabels } from "./renderBodyLabels.js";
import { renderFacesInto } from "./renderFaces.js";
import type { ProjectedSegment, SegmentProjector } from "./renderInternals.js";
import { renderPolylinesInto } from "./renderPolylines.js";
import type {
  RenderedView,
  TextMetrics,
  ViewRenderer,
  ViewRenderParams,
} from "./renderPorts.js";
import { drawMode } from "./renderPorts.js";
import { renderVelocitySegmentsInto } from "./renderVelocitySegments.js";

export class DefaultViewRenderer implements ViewRenderer {
  constructor(
    private readonly measureText: (text: string, font: string) => TextMetrics,
  ) {}

  renderInto(into: RenderedView, params: ViewRenderParams): void {
    const { mainShip, camera, objectsFilter, surface, scene } = params;
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

    into.faceCount =
      drawMode === "faces"
        ? renderFacesInto(
            into.faces,
            scene,
            camera,
            screenWidth,
            screenHeight,
            objectsFilter,
          )
        : 0;

    into.polylineCount = renderPolylinesInto(
      into.polylines,
      scene.objects,
      projectSegmentInto,
      (obj: SceneObject): obj is PolylineSceneObject =>
        obj.kind === "polyline" && (objectsFilter ? objectsFilter(obj) : true),
    );

    into.segmentCount = renderVelocitySegmentsInto(
      into.segments,
      mainShip,
      projectSegmentInto,
    );

    into.bodyLabels = renderBodyLabels(
      scene.objects,
      mainShip.position,
      screenWidth,
      screenHeight,
      projectInto,
      this.measureText,
      objectsFilter,
    );
  }
}
