import type {
  ControlInput,
  EnvInput,
  SceneObject,
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
  WorldAndSceneConfig,
} from "../app/appPorts.js";
import { createTickHandler } from "../app/game.js";
import type { GravityEngine } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { parameters } from "../global/parameters.js";
import type {
  HudRenderer,
  HudRenderParams,
  Rasterizer,
  RenderedHud,
  RenderedView,
  RenderSurface2D,
  ViewRenderer,
  ViewRenderParams,
} from "../render/renderPorts.js";
import { createWorldAndScene } from "../setup/setup.js";
import { updateFps } from "./fps.js";
import type { ProfilerController } from "./infraPorts.js";
import { handlePauseToggle } from "./pause.js";
import { handleProfilingToggle } from "./profilerControl.js";
import { handleTimeScaleChange } from "./timeScale.js";

/**
 * DOM-level game loop (depends on requestAnimationFrame).
 */
export function runLoop(
  config: WorldAndSceneConfig,
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
  const worldAndScene: WorldAndScene = createWorldAndScene(config);
  const tickInto: TickCallback = createTickHandler(
    gravityEngine,
    config.pilotCameraOffset,
    config.pilotLookState,
    config.thrustLevel,
    config.topCameraOffset,
    worldAndScene,
  );

  const tickParams: TickParams = {
    dtMillis: 0,
    dtMillisSim: 0,
    controlInput,
  };

  const tickOutput: TickOutput = {
    currentThrustLevel: 0,
    pilotCameraLocalOffset: vec3.zero(),
    simTimeMillis: 0,
    speedMps: 0,
  };

  const pilotViewRenderParams: ViewRenderParams = {
    camera: worldAndScene.pilotCamera,
    mainShip: worldAndScene.mainShip,
    scene: worldAndScene.scene,
    surface: pilotSurface,
  };

  const renderedPilotView: RenderedView = {
    bodyLabels: [],
    bodyLabelCount: 0,
    faces: [],
    faceCount: 0,
    polylines: [],
    polylineCount: 0,
    segments: [],
    segmentCount: 0,
  };

  const topViewRenderParams: ViewRenderParams = {
    camera: worldAndScene.topCamera,
    mainShip: worldAndScene.mainShip,
    scene: worldAndScene.scene,
    surface: topSurface,
    objectsFilter: (obj: SceneObject) =>
      // no trajectory polylines in the top view
      obj.kind !== "polyline" || !obj.id.startsWith("path:"),
  };

  const renderedTopView: RenderedView = {
    bodyLabels: [],
    bodyLabelCount: 0,
    faces: [],
    faceCount: 0,
    polylines: [],
    polylineCount: 0,
    segments: [],
    segmentCount: 0,
  };

  const hudRenderParams: HudRenderParams = {
    currentThrustLevel: 0,
    currentTimeScale: 0,
    fps: 0,
    paused: false,
    pilotCameraLocalOffset: tickOutput.pilotCameraLocalOffset,
    profilingEnabled: false,
    simTimeMillis: 0,
    speedMps: tickOutput.speedMps,
  };

  const renderedHud: RenderedHud = [
    ["", ""],
    ["", ""],
    ["", ""],
    ["", ""],
  ];

  let lastTimeMs: number;
  let lastHudTimeMs: number;
  let dtMillis: number;
  let paused: boolean;
  let profilingEnabled: boolean;
  let fps: number;
  let timeScale = parameters.timeScale;

  const loop = (nowMs: number) => {
    dtMillis = nowMs - lastTimeMs;
    lastTimeMs = nowMs;

    paused = handlePauseToggle(envInput.pauseToggle);
    profilingEnabled = handleProfilingToggle(envInput.profilingToggle);
    timeScale = handleTimeScaleChange(
      envInput.decreaseTimeScale,
      envInput.increaseTimeScale,
      timeScale,
    );

    profilerController.setEnabled(profilingEnabled);
    profilerController.setPaused(paused);
    profilerController.check();

    if (!paused) {
      tickParams.dtMillis = dtMillis;
      tickParams.dtMillisSim = dtMillis * timeScale;
      tickInto(tickOutput, tickParams);
    }

    pilotViewRenderer.renderInto(renderedPilotView, pilotViewRenderParams);
    topViewRenderer.renderInto(renderedTopView, topViewRenderParams);

    fps = updateFps(dtMillis);

    const shouldRenderHud = nowMs - lastHudTimeMs > 100;

    if (shouldRenderHud) {
      hudRenderParams.currentThrustLevel = tickOutput.currentThrustLevel;
      hudRenderParams.currentTimeScale = timeScale;
      hudRenderParams.fps = fps;
      hudRenderParams.paused = paused;
      hudRenderParams.pilotCameraLocalOffset =
        tickOutput.pilotCameraLocalOffset;
      hudRenderParams.profilingEnabled = profilingEnabled;
      hudRenderParams.simTimeMillis = tickOutput.simTimeMillis;
      hudRenderParams.speedMps = tickOutput.speedMps;

      hudRenderer.renderInto(renderedHud, hudRenderParams);
      lastHudTimeMs = nowMs;
    }

    rasterizeView(renderedPilotView, pilotRasterizer);
    rasterizeView(renderedTopView, topRasterizer);
    rasterizeHud(renderedHud, hudRasterizer);

    profilerController.flush();

    requestAnimationFrame(loop);
  };

  const first = (nowMs: number) => {
    lastTimeMs = nowMs;
    lastHudTimeMs = nowMs;
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(first);
}

function rasterizeView(view: RenderedView, rasterizer: Rasterizer) {
  rasterizer.clear("#000000");
  rasterizer.drawFaces(view.faces, view.faceCount);
  rasterizer.drawPolylines(view.polylines, view.polylineCount);
  rasterizer.drawSegments(view.segments, view.segmentCount);
  rasterizer.drawBodyLabels(view.bodyLabels, view.bodyLabelCount);
}

function rasterizeHud(hud: RenderedHud, rasterizer: Rasterizer) {
  rasterizer.drawHud(hud);
}
