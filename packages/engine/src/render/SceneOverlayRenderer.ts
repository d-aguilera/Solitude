import type { ViewLabelMode } from "../app/viewPorts";
import type { Vec3 } from "../domain/vec3";
import type { NdcPoint } from "./ndc";
import { ProjectionService } from "./ProjectionService";
import type { ProjectedSegment, SegmentProjector } from "./renderInternals";
import { renderWorldMarkersInto } from "./renderMarkers";
import type {
  RenderedView,
  TextMetrics,
  ViewRenderer,
  ViewRenderParams,
} from "./renderPorts";
import type { LabelLayoutCache } from "./renderSceneLabels";
import {
  createLabelLayoutCache,
  renderSceneLabelsInto,
} from "./renderSceneLabels";
import { renderWorldSegmentsInto } from "./renderSegments";

export class SceneOverlayRenderer implements ViewRenderer {
  private readonly labelLayoutCache: LabelLayoutCache;
  private readonly labelMode: ViewLabelMode;
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
    labelMode: ViewLabelMode = "full",
  ) {
    this.labelLayoutCache = createLabelLayoutCache(this.measureText);
    this.labelMode = labelMode;
  }

  renderInto(into: RenderedView, params: ViewRenderParams): void {
    const {
      camera,
      surface,
      renderSegments,
      renderSceneLabels,
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
    into.segmentCount = renderSegments
      ? renderWorldSegmentsInto(
          into.segments,
          params.worldSegments,
          this.projectSegmentInto,
        )
      : 0;

    into.markerCount = renderSegments
      ? renderWorldMarkersInto(
          into.markers,
          params.worldMarkers,
          screenWidth,
          screenHeight,
          this.projectInto,
        )
      : 0;

    into.sceneLabelCount = renderSceneLabels
      ? renderSceneLabelsInto(
          into.sceneLabels,
          params.sceneLabelCandidates,
          screenWidth,
          screenHeight,
          this.projectInto,
          this.labelLayoutCache,
          nowMs(),
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
