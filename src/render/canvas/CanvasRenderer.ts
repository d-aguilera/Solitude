import type { Scene } from "../../renderPorts/ScenePorts.js";
import type { Renderer, ViewConfig } from "../../renderPorts/RenderPorts.js";
import { CanvasViewRenderer } from "./CanvasViewRenderer.js";
import { Profiler } from "../../profiling/profilingPorts.js";

/**
 * Canvas2D implementation of the top-level Renderer abstraction.
 *
 * This adapter owns its internal ViewRenderer and is responsible
 * for drawing the supplied scene for pilot/top views and HUD.
 *
 * The app layer is responsible for constructing and updating the
 * Scene and ViewConfig objects each frame.
 */
export class CanvasRenderer implements Renderer {
  private readonly viewRenderer: CanvasViewRenderer;

  constructor() {
    this.viewRenderer = new CanvasViewRenderer();
  }

  renderFrame(params: {
    pilotScene: Scene;
    topScene: Scene;
    pilotContext: CanvasRenderingContext2D;
    topContext: CanvasRenderingContext2D;
    profiler: Profiler;
    pilotView: ViewConfig;
    topView: ViewConfig;
  }): void {
    const {
      pilotScene,
      topScene,
      pilotContext,
      topContext,
      profiler,
      pilotView,
      topView,
    } = params;

    this.viewRenderer.renderView({
      context: pilotContext,
      scene: pilotScene,
      viewConfig: pilotView,
      profiler,
    });

    this.viewRenderer.renderView({
      context: topContext,
      scene: topScene,
      viewConfig: topView,
      profiler,
    });

    // HUD stays in app layer (see game.ts); nothing to do here.
  }
}
