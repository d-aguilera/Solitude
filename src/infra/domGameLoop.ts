import type {
  ControlInput,
  DomainCameraPose,
  EnvInput,
  GameplayParameters,
  Scene,
  SceneObject,
  TickCallback,
  TickOutput,
  TickParams,
} from "../app/appPorts.js";
import { createTickHandler } from "../app/game.js";
import type { GravityEngine, ShipBody } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import type {
  HudRenderer,
  HudRenderParams,
  Rasterizer,
  RenderedView,
  RenderSurface2D,
  ViewRenderer,
} from "../render/renderPorts.js";
import { updateFps } from "./fps.js";
import type { ProfilerController } from "./infraPorts.js";
import { handlePauseToggle } from "./pause.js";
import { handleProfilingToggle } from "./profilerControl.js";

/**
 * DOM-level game loop (depends on requestAnimationFrame).
 */
export function runLoop(
  gameplayParameters: GameplayParameters,
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
  const tickInto: TickCallback = createTickHandler(
    gameplayParameters,
    gravityEngine,
  );

  const tickParams: TickParams = {
    dtSeconds: 0,
    controlInput,
  };

  const tickOutput: TickOutput = {
    currentThrustLevel: 0,
    mainShip: {} as ShipBody,
    pilotCamera: {} as DomainCameraPose,
    pilotCameraLocalOffset: vec3.zero(),
    scene: {} as Scene,
    speedMps: 0,
    topCamera: {} as DomainCameraPose,
  };

  let lastTimeMs: number;
  let elapsedMs: number;
  let dtSeconds: number;
  let fps: number;

  const loop = (nowMs: number) => {
    elapsedMs = nowMs - lastTimeMs;
    lastTimeMs = nowMs;
    dtSeconds = elapsedMs / 1000;

    const paused = handlePauseToggle(envInput.pauseToggle);
    const profilingEnabled = handleProfilingToggle(envInput.profilingToggle);

    profilerController.setEnabled(profilingEnabled);
    profilerController.setPaused(paused);
    profilerController.check();

    if (!paused) {
      tickParams.dtSeconds = dtSeconds;
      tickInto(tickOutput, tickParams);
    }

    const renderedPilotView = pilotViewRenderer.render({
      camera: tickOutput.pilotCamera,
      mainShip: tickOutput.mainShip,
      scene: tickOutput.scene,
      surface: pilotSurface,
    });

    // no trajectory polylines
    const topScene: Scene = {
      ...tickOutput.scene,
      objects: tickOutput.scene.objects.filter(
        (obj: SceneObject) =>
          obj.kind !== "polyline" || !obj.id.startsWith("path:"),
      ),
    };

    const renderedTopView = topViewRenderer.render({
      camera: tickOutput.topCamera,
      mainShip: tickOutput.mainShip,
      scene: topScene,
      surface: topSurface,
    });

    fps = dtSeconds === 0 ? 0 : updateFps(dtSeconds);

    const renderedHud: HudRenderParams = hudRenderer.render({
      currentThrustLevel: tickOutput.currentThrustLevel,
      fps,
      pilotCameraLocalOffset: tickOutput.pilotCameraLocalOffset,
      profilingEnabled,
      speedMps: tickOutput.speedMps,
    });

    rasterizeView(renderedPilotView, pilotRasterizer);
    rasterizeView(renderedTopView, topRasterizer);

    hudRasterizer.drawHud(renderedHud);

    profilerController.flush();

    requestAnimationFrame(loop);
  };

  const init = (nowMs: number) => {
    lastTimeMs = nowMs;
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(init);
}

function rasterizeView(renderedView: RenderedView, rasterizer: Rasterizer) {
  rasterizer.clear("#000000");
  rasterizer.drawFaces(renderedView.faces);
  rasterizer.drawPolylines(renderedView.polylines);
  rasterizer.drawSegments(renderedView.segments);
  rasterizer.drawBodyLabels(renderedView.bodyLabels);
}
