import type { Renderer } from "../../app/renderer.js";
import type {
  DrawMode,
  Plane,
  Profiler,
  Scene,
  Vec3,
  WorldState,
} from "../../world/types.js";
import { renderPilotView, renderTopView } from "../projection/viewRenderer.js";
import { renderHUD } from "../../app/hud.js";
import { isProfilingEnabled } from "../../profiling/profilingFacade.js";

/**
 * Canvas2D implementation of the Renderer abstraction.
 *
 * This adapter owns all knowledge about concrete CanvasRenderingContext2D
 * instances and how pilot/top views + HUD are drawn into them.
 */
export class CanvasRenderer implements Renderer {
  private readonly pilotContext: CanvasRenderingContext2D;
  private readonly topContext: CanvasRenderingContext2D;

  constructor(
    pilotContext: CanvasRenderingContext2D,
    topContext: CanvasRenderingContext2D
  ) {
    this.pilotContext = pilotContext;
    this.topContext = topContext;
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

    renderPilotView(
      this.pilotContext,
      scene,
      world,
      pilotCameraId,
      mainPlane,
      drawMode,
      debugPlanes,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent
    );

    renderTopView(
      this.topContext,
      scene,
      world,
      topCameraId,
      mainPlane,
      drawMode,
      debugPlanes,
      profiler
    );

    renderHUD(
      this.pilotContext,
      mainPlane,
      isProfilingEnabled(),
      pilotCameraLocalOffset,
      thrustPercent
    );
  }
}
