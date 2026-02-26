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
  RenderedHud,
  RenderedView,
  RenderSurface2D,
  ViewRenderer,
  ViewRenderParams,
} from "../render/renderPorts.js";
import { updateFps } from "./fps.js";
import type { ProfilerController } from "./infraPorts.js";
import { handlePauseToggle } from "./pause.js";
import { handleProfilingToggle } from "./profilerControl.js";
import { handleTimeScaleChange } from "./timeScale.js";

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
  const tickInto: TickCallback = createTickHandler(gravityEngine);

  const tickParams: TickParams = {
    dtMillis: 0,
    dtMillisSim: 0,
    controlInput,
  };

  const tickOutput: TickOutput = {
    currentThrustLevel: 0,
    mainShip: {} as ShipBody,
    pilotCamera: {} as DomainCameraPose,
    pilotCameraLocalOffset: vec3.zero(),
    scene: {} as Scene,
    simTimeMillis: 0,
    speedMps: 0,
    topCamera: {} as DomainCameraPose,
  };

  const pilotViewRenderParams: ViewRenderParams = {
    camera: tickOutput.pilotCamera,
    mainShip: tickOutput.mainShip,
    scene: tickOutput.scene,
    surface: pilotSurface,
  };

  const renderedPilotView: RenderedView = {
    bodyLabels: [],
    faces: [],
    faceCount: 0,
    polylines: [],
    polylineCount: 0,
    segments: [],
    segmentCount: 0,
  };

  const topViewRenderParams: ViewRenderParams = {
    camera: tickOutput.topCamera,
    mainShip: tickOutput.mainShip,
    scene: tickOutput.scene,
    surface: topSurface,
    objectsFilter: (obj: SceneObject) =>
      // no trajectory polylines in the top view
      obj.kind !== "polyline" || !obj.id.startsWith("path:"),
  };

  const renderedTopView: RenderedView = {
    bodyLabels: [],
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
  let timeScale = gameplayParameters.timeScale;

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

    pilotViewRenderParams.camera = tickOutput.pilotCamera;
    pilotViewRenderParams.mainShip = tickOutput.mainShip;
    pilotViewRenderParams.scene = tickOutput.scene;

    pilotViewRenderer.renderInto(renderedPilotView, pilotViewRenderParams);

    topViewRenderParams.camera = tickOutput.topCamera;
    topViewRenderParams.mainShip = tickOutput.mainShip;
    topViewRenderParams.scene = tickOutput.scene;

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

function rasterizeView(renderedView: RenderedView, rasterizer: Rasterizer) {
  rasterizer.clear("#000000");
  rasterizer.drawFaces(renderedView.faces, renderedView.faceCount);
  rasterizer.drawPolylines(renderedView.polylines, renderedView.polylineCount);
  rasterizer.drawSegments(renderedView.segments, renderedView.segmentCount);
  rasterizer.drawBodyLabels(renderedView.bodyLabels);
}

function rasterizeHud(renderedHud: RenderedHud, rasterizer: Rasterizer) {
  rasterizer.drawHud(renderedHud);
}
