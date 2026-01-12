import type { Renderer } from "../../app/rendererPort.js";
import type {
  DrawMode,
  Plane,
  Profiler,
  Scene,
  Vec3,
  WorldState,
} from "../../world/types.js";
import {
  renderPilotView as renderPilotViewImpl,
  renderTopView as renderTopViewImpl,
} from "../projection/viewRenderer.js";
import { renderHUD } from "../../app/hud.js";
import { isProfilingEnabled } from "../../profiling/profilingFacade.js";
import type { ViewRenderer } from "../projection/viewRendererPort.js";

/**
 * Canvas2D implementation of the ViewRenderer abstraction.
 *
 * This adapter owns all knowledge about concrete CanvasRenderingContext2D
 * instances and how pilot/top views + HUD are drawn into them.
 */
export class CanvasViewRenderer implements ViewRenderer {
  private readonly pilotContext: CanvasRenderingContext2D;
  private readonly topContext: CanvasRenderingContext2D;

  constructor(
    pilotContext: CanvasRenderingContext2D,
    topContext: CanvasRenderingContext2D
  ) {
    this.pilotContext = pilotContext;
    this.topContext = topContext;
  }

  renderPilotView(params: {
    scene: Scene;
    world: WorldState;
    pilotCameraId: string;
    referencePlane: Plane;
    drawMode: DrawMode;
    debugPlanes: Plane[];
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
  }): void {
    const {
      scene,
      world,
      pilotCameraId,
      referencePlane,
      drawMode,
      debugPlanes,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent,
    } = params;

    renderPilotViewImpl(
      this.pilotContext,
      scene,
      world,
      pilotCameraId,
      referencePlane,
      drawMode,
      debugPlanes,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent
    );
  }

  renderTopView(params: {
    scene: Scene;
    world: WorldState;
    topCameraId: string;
    referencePlane: Plane;
    drawMode: DrawMode;
    debugPlanes: Plane[];
    profiler: Profiler;
  }): void {
    const {
      scene,
      world,
      topCameraId,
      referencePlane,
      drawMode,
      debugPlanes,
      profiler,
    } = params;

    renderTopViewImpl(
      this.topContext,
      scene,
      world,
      topCameraId,
      referencePlane,
      drawMode,
      debugPlanes,
      profiler
    );
  }

  /**
   * Draw HUD into the pilot view canvas.
   *
   * HUD composition is kept separate from core scene rendering so that
   * it can be layered on top of whatever view configuration is used.
   */
  renderHudOverlay(
    mainPlane: Plane,
    pilotCameraLocalOffset: Vec3,
    thrustPercent: number
  ): void {
    renderHUD(
      this.pilotContext,
      mainPlane,
      isProfilingEnabled(),
      pilotCameraLocalOffset,
      thrustPercent
    );
  }
}

/**
 * Canvas2D implementation of the top-level Renderer abstraction.
 *
 * This adapter owns its internal ViewRenderer and is responsible
 * for composing pilot/top views and HUD into the associated canvases.
 */
export class CanvasRenderer implements Renderer {
  private readonly viewRenderer: CanvasViewRenderer;

  constructor(
    pilotContext: CanvasRenderingContext2D,
    topContext: CanvasRenderingContext2D
  ) {
    this.viewRenderer = new CanvasViewRenderer(pilotContext, topContext);
  }

  renderFrame(params: {
    scene: Scene;
    world: WorldState;
    mainPlane: Plane;
    mainPlaneId: string;
    topCameraId: string;
    pilotCameraId: string;
    debugPlanes: Plane[];
    drawMode: DrawMode;
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
  }): void {
    const {
      scene,
      world,
      mainPlane,
      topCameraId,
      pilotCameraId,
      debugPlanes,
      drawMode,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent,
    } = params;

    // Delegate per-view drawing to the internal ViewRenderer.
    this.viewRenderer.renderPilotView({
      scene,
      world,
      pilotCameraId,
      referencePlane: mainPlane,
      drawMode,
      debugPlanes,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent,
    });

    this.viewRenderer.renderTopView({
      scene,
      world,
      topCameraId,
      referencePlane: mainPlane,
      drawMode,
      debugPlanes,
      profiler,
    });

    // Compose the HUD on top of the pilot view.
    this.viewRenderer.renderHudOverlay(
      mainPlane,
      pilotCameraLocalOffset,
      thrustPercent
    );
  }
}
