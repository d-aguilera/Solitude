import type { Vec3 } from "../domain/vec3";
import type { NdcPoint } from "./ndc";
import { ProjectionService } from "./ProjectionService";
import type { BodyLabelContent, LabelLayoutCache } from "./renderBodyLabels";
import {
  createLabelLayoutCache,
  renderBodyLabelsInto,
} from "./renderBodyLabels";
import { createRenderFacesWorkspace, renderFacesInto } from "./renderFaces";
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
  private readonly faceWorkspace;
  private readonly labelLayoutCache: LabelLayoutCache;
  private readonly labelMode: BodyLabelContent;
  private projectionService?: ProjectionService;
  private screenWidth = 0;
  private screenHeight = 0;
  private readonly projectInto = (into: NdcPoint, wp: Vec3) =>
    this.requireProjectionService().projectWorldPointToNdcInto(into, wp);
  private readonly projectSegmentInto: SegmentProjector = (
    into: ProjectedSegment,
    a: Vec3,
    b: Vec3,
  ) =>
    this.requireProjectionService().projectWorldSegmentToScreenInto(
      into,
      a,
      b,
      this.screenWidth,
      this.screenHeight,
    );

  constructor(
    private readonly measureText: (text: string, font: string) => TextMetrics,
    labelMode: BodyLabelContent = "full",
  ) {
    this.faceWorkspace = createRenderFacesWorkspace();
    this.labelLayoutCache = createLabelLayoutCache(this.measureText);
    this.labelMode = labelMode;
  }

  renderInto(into: RenderedView, params: ViewRenderParams): void {
    const {
      mainFocus,
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
    const screenWidth = surface.width;
    const screenHeight = surface.height;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    if (this.projectionService) {
      this.projectionService.reset(camera, screenWidth, screenHeight);
    } else {
      this.projectionService = new ProjectionService(
        camera,
        screenWidth,
        screenHeight,
      );
    }
    const projectionService = this.requireProjectionService();

    into.faceCount =
      renderFaces && drawMode === "faces"
        ? renderFacesInto(
            into.faces,
            scene,
            camera,
            screenWidth,
            screenHeight,
            renderCache,
            projectionService,
            this.faceWorkspace,
            objectsFilter,
            sortFaces,
          )
        : 0;

    into.polylineCount = renderPolylines
      ? renderPolylinesInto(
          into.polylines,
          scene.objects,
          this.projectSegmentInto,
          objectsFilter,
        )
      : 0;

    into.segmentCount = renderSegments
      ? renderWorldSegmentsInto(
          into.segments,
          params.worldSegments,
          this.projectSegmentInto,
        )
      : 0;

    into.bodyLabelCount = renderBodyLabels
      ? renderBodyLabelsInto(
          into.bodyLabels,
          scene.objects,
          mainFocus.controlledBody.position,
          screenWidth,
          screenHeight,
          this.projectInto,
          this.labelLayoutCache,
          nowMs(),
          objectsFilter,
          this.labelMode,
        )
      : 0;
  }

  private requireProjectionService(): ProjectionService {
    if (!this.projectionService) {
      throw new Error("Projection service used before renderer initialization");
    }
    return this.projectionService;
  }
}

const nowMs = createNowMs();

function createNowMs(): () => number {
  if (typeof performance !== "undefined" && performance.now) {
    return () => performance.now();
  }
  return () => Date.now();
}
