import { Profiler } from "../domain/domainPorts.js";
import type {
  Renderer,
  ViewConfig,
  HudRenderData,
} from "../render/renderPorts.js";
import type { Scene } from "../render/scenePorts.js";
import { CanvasViewRenderer } from "./CanvasViewRenderer.js";
import { renderCanvasHud } from "./CanvasHudRenderer.js";

/**
 * Canvas2D implementation of the top-level Renderer abstraction.
 */
export class CanvasRenderer implements Renderer {
  private readonly viewRenderer: CanvasViewRenderer;

  constructor(private profiler: Profiler) {
    this.viewRenderer = new CanvasViewRenderer(this.profiler);
  }

  renderFrame(params: {
    pilotScene: Scene;
    topScene: Scene;
    mainPlane: { id: string; position: any; velocity: any };
    pilotContext: CanvasRenderingContext2D;
    topContext: CanvasRenderingContext2D;
    pilotView: ViewConfig;
    topView: ViewConfig;
    hud: HudRenderData;
  }): void {
    const {
      pilotScene,
      topScene,
      pilotContext,
      topContext,
      pilotView,
      topView,
      hud,
    } = params;

    this.viewRenderer.renderView({
      context: pilotContext,
      scene: pilotScene,
      viewConfig: pilotView,
    });

    this.viewRenderer.renderView({
      context: topContext,
      scene: topScene,
      viewConfig: topView,
    });

    renderCanvasHud(pilotContext, hud);
  }
}
