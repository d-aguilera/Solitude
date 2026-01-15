import type { Renderer } from "../../app/rendererPort.js";
import type { Plane, Scene, WorldState } from "../../world/types.js";
import { renderHUD } from "../../app/hud.js";
import type { ViewRenderer } from "../projection/viewRendererPort.js";
import { DefaultViewRenderer } from "../projection/viewRenderer.js";
import type { Profiler, Vec3 } from "../../world/domain.js";
import type { ViewConfig } from "../../app/viewConfig.js";

/**
 * Canvas2D implementation of the ViewRenderer abstraction.
 *
 * This adapter owns all knowledge about concrete CanvasRenderingContext2D
 * instances and how pilot/top views + HUD are drawn into them.
 * The application/game layer does not know about these contexts.
 */
export class CanvasViewRenderer implements ViewRenderer {
  private readonly impl: DefaultViewRenderer;

  constructor() {
    this.impl = new DefaultViewRenderer();
  }

  renderView(params: {
    context: CanvasRenderingContext2D;
    scene: Scene;
    viewConfig: ViewConfig;
    profiler: Profiler;
  }): void {
    this.impl.renderView(params);
  }
}

/**
 * Canvas2D implementation of the top-level Renderer abstraction.
 *
 * This adapter owns its internal ViewRenderer and is responsible
 * for composing pilot/top views and HUD into the associated canvases.
 * It is constructed by an outer composition root.
 */
export class CanvasRenderer implements Renderer {
  private readonly pilotContext: CanvasRenderingContext2D;
  private readonly topContext: CanvasRenderingContext2D;
  private readonly viewRenderer: CanvasViewRenderer;

  constructor(
    pilotContext: CanvasRenderingContext2D,
    topContext: CanvasRenderingContext2D
  ) {
    this.pilotContext = pilotContext;
    this.topContext = topContext;
    this.viewRenderer = new CanvasViewRenderer();
  }

  renderFrame(params: {
    scene: Scene;
    world: WorldState;
    mainPlane: Plane;
    pilotView: ViewConfig;
    topView: ViewConfig;
    profiler: Profiler;
    pilotCameraLocalOffset: Vec3;
    thrustPercent: number;
    profilingEnabled: boolean;
  }): void {
    const {
      scene,
      mainPlane,
      pilotView,
      topView,
      profiler,
      pilotCameraLocalOffset,
      thrustPercent,
      profilingEnabled,
    } = params;

    // Pilot view uses the full scene.
    this.viewRenderer.renderView({
      context: this.pilotContext,
      scene,
      viewConfig: pilotView,
      profiler,
    });

    // Top view uses a scene that may omit some objects (already encoded
    // into the ViewConfig or scene by the app layer).
    this.viewRenderer.renderView({
      context: this.topContext,
      scene,
      viewConfig: topView,
      profiler,
    });

    // HUD overlay on pilot canvas.
    renderHUD(
      this.pilotContext,
      mainPlane,
      profilingEnabled,
      pilotCameraLocalOffset,
      thrustPercent
    );
  }
}
