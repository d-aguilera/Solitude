import type { PolylineSceneObject, SceneObject } from "../app/scenePorts";
import type { Vec3 } from "../domain/vec3";
import type { NdcPoint } from "./ndc";
import { ProjectionService } from "./ProjectionService";
import type { BodyLabelContent, LabelLayoutCache } from "./renderBodyLabels";
import {
  createLabelLayoutCache,
  renderBodyLabelsInto,
} from "./renderBodyLabels";
import { renderFacesInto } from "./renderFaces";
import type { ProjectedSegment, SegmentProjector } from "./renderInternals";
import { renderPolylinesInto } from "./renderPolylines";
import type {
  RenderedView,
  TextMetrics,
  ViewRenderer,
  ViewRenderParams,
} from "./renderPorts";
import { drawMode } from "./renderPorts";
import { renderVelocitySegmentsInto } from "./renderVelocitySegments";

export class DefaultViewRenderer implements ViewRenderer {
  private readonly labelLayoutCache: LabelLayoutCache;
  private readonly labelMode: BodyLabelContent;

  constructor(
    private readonly measureText: (text: string, font: string) => TextMetrics,
    labelMode: BodyLabelContent = "full",
  ) {
    this.labelLayoutCache = createLabelLayoutCache(this.measureText);
    this.labelMode = labelMode;
  }

  renderInto(into: RenderedView, params: ViewRenderParams): void {
    const { mainShip, camera, objectsFilter, surface, scene, renderCache } =
      params;
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
            renderCache,
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

    into.bodyLabelCount = renderBodyLabelsInto(
      into.bodyLabels,
      scene.objects,
      mainShip.position,
      screenWidth,
      screenHeight,
      projectInto,
      this.labelLayoutCache,
      nowMs(),
      objectsFilter,
      this.labelMode,
    );
  }
}

const nowMs = createNowMs();

function createNowMs(): () => number {
  if (typeof performance !== "undefined" && performance.now) {
    return () => performance.now();
  }
  return () => Date.now();
}
