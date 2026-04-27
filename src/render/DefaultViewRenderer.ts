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
import { renderWorldSegmentsInto } from "./renderSegments";

export class DefaultViewRenderer implements ViewRenderer {
  private readonly labelLayoutCache: LabelLayoutCache;
  private readonly labelMode: BodyLabelContent;
  private projectionService?: ProjectionService;

  constructor(
    private readonly measureText: (text: string, font: string) => TextMetrics,
    labelMode: BodyLabelContent = "full",
  ) {
    this.labelLayoutCache = createLabelLayoutCache(this.measureText);
    this.labelMode = labelMode;
  }

  renderInto(into: RenderedView, params: ViewRenderParams): void {
    const {
      mainControlledBody,
      camera,
      objectsFilter,
      surface,
      scene,
      renderCache,
      renderFaces = true,
      sortFaces = true,
      renderPolylines = true,
      renderSegments = true,
      renderBodyLabels = true,
    } = params;
    const { width: screenWidth, height: screenHeight } = surface;

    if (this.projectionService) {
      this.projectionService.reset(camera, screenWidth, screenHeight);
    } else {
      this.projectionService = new ProjectionService(
        camera,
        screenWidth,
        screenHeight,
      );
    }
    const projectionService = this.projectionService;

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
      renderFaces && drawMode === "faces"
        ? renderFacesInto(
            into.faces,
            scene,
            camera,
            screenWidth,
            screenHeight,
            renderCache,
            objectsFilter,
            sortFaces,
            projectionService,
          )
        : 0;

    into.polylineCount = renderPolylines
      ? renderPolylinesInto(
          into.polylines,
          scene.objects,
          projectSegmentInto,
          (obj: SceneObject): obj is PolylineSceneObject =>
            obj.kind === "polyline" &&
            (objectsFilter ? objectsFilter(obj) : true),
        )
      : 0;

    into.segmentCount = renderSegments
      ? renderWorldSegmentsInto(
          into.segments,
          params.worldSegments,
          projectSegmentInto,
        )
      : 0;

    into.bodyLabelCount = renderBodyLabels
      ? renderBodyLabelsInto(
          into.bodyLabels,
          scene.objects,
          mainControlledBody.position,
          screenWidth,
          screenHeight,
          projectInto,
          this.labelLayoutCache,
          nowMs(),
          objectsFilter,
          this.labelMode,
        )
      : 0;
  }
}

const nowMs = createNowMs();

function createNowMs(): () => number {
  if (typeof performance !== "undefined" && performance.now) {
    return () => performance.now();
  }
  return () => Date.now();
}
