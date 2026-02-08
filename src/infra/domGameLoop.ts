import { createTickHandler } from "../app/game.js";
import type {
  ControlInput,
  EnvInput,
  Scene,
  SceneObject,
  TickCallback,
  TickOutput,
  TickParams,
} from "../app/appPorts.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import type {
  HudRenderer,
  HudRenderParams,
  Rasterizer,
  RenderedView,
  RenderSurface2D,
  ViewRenderer,
} from "../render/renderPorts.js";
import type { ProfilerController } from "./infraPorts.js";
import { handlePauseToggle } from "./pause.js";
import { handleProfilingToggle } from "./profilerControl.js";

/**
 * DOM-level game loop (depends on requestAnimationFrame).
 */
export function runLoop(
  pilotViewRenderer: ViewRenderer,
  pilotRasterizer: Rasterizer,
  topViewRenderer: ViewRenderer,
  topRasterizer: Rasterizer,
  hudRenderer: HudRenderer,
  hudRasterizer: Rasterizer,
  gravityEngine: GravityEngine,
  pilotSurface: RenderSurface2D,
  topSurface: RenderSurface2D,
  controlInput: ControlInput,
  envInput: EnvInput,
  profilerController: ProfilerController,
): void {
  const tick: TickCallback = createTickHandler(gravityEngine);

  const tickParams: TickParams = {
    nowMs: 0,
    controlInput,
    paused: false,
  };

  const loop = (nowMs: number) => {
    const paused = handlePauseToggle(envInput.pauseToggle);
    const profilingEnabled = handleProfilingToggle(envInput.profilingToggle);

    profilerController.setEnabled(profilingEnabled);
    profilerController.setPaused(paused);
    profilerController.check();

    tickParams.nowMs = nowMs;
    tickParams.paused = paused;

    const {
      pilotCamera,
      mainShip,
      scene,
      topCamera,
      currentThrustLevel,
      fps,
      pilotCameraLocalOffset,
      speedMps,
    }: TickOutput = tick(tickParams);

    const renderedPilotView = pilotViewRenderer.render({
      camera: pilotCamera,
      mainShip: mainShip,
      scene: scene,
      surface: pilotSurface,
    });

    // no trajectory polylines
    const topScene: Scene = {
      ...scene,
      objects: scene.objects.filter(
        (obj: SceneObject) =>
          obj.kind !== "polyline" || !obj.id.startsWith("path:"),
      ),
    };

    const renderedTopView = topViewRenderer.render({
      camera: topCamera,
      mainShip: mainShip,
      scene: topScene,
      surface: topSurface,
    });

    const renderedHud: HudRenderParams = hudRenderer.render({
      currentThrustLevel,
      fps,
      pilotCameraLocalOffset,
      profilingEnabled,
      speedMps,
    });

    rasterizeView(renderedPilotView, pilotRasterizer);
    rasterizeView(renderedTopView, topRasterizer);

    hudRasterizer.drawHud(renderedHud);

    profilerController.flush();

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}

function rasterizeView(renderedView: RenderedView, rasterizer: Rasterizer) {
  rasterizer.clear("#000000");
  rasterizer.drawFaces(renderedView.faces);
  rasterizer.drawPolylines(renderedView.polylines);
  rasterizer.drawSegments(renderedView.segments);
  rasterizer.drawBodyLabels(renderedView.bodyLabels);
}
