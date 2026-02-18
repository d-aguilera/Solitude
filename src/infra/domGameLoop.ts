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
    simTimeSeconds: 0,
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
  };

  const hudRenderParams: HudRenderParams = {
    currentThrustLevel: tickOutput.currentThrustLevel,
    fps: 0,
    pilotCameraLocalOffset: tickOutput.pilotCameraLocalOffset,
    profilingEnabled: false,
    simTimeSeconds: 0,
    speedMps: tickOutput.speedMps,
  };

  const renderedHud: RenderedHud = [
    ["", ""],
    ["", ""],
    ["", ""],
  ];

  let lastTimeMs: number;
  let elapsedMs: number;
  let dtSeconds: number;

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

    pilotViewRenderParams.camera = tickOutput.pilotCamera;
    pilotViewRenderParams.mainShip = tickOutput.mainShip;
    pilotViewRenderParams.scene = tickOutput.scene;

    pilotViewRenderer.renderInto(renderedPilotView, pilotViewRenderParams);

    topViewRenderParams.camera = tickOutput.topCamera;
    topViewRenderParams.mainShip = tickOutput.mainShip;
    topViewRenderParams.scene = tickOutput.scene;

    topViewRenderer.renderInto(renderedTopView, topViewRenderParams);

    hudRenderParams.currentThrustLevel = tickOutput.currentThrustLevel;
    hudRenderParams.fps = dtSeconds === 0 ? 0 : updateFps(dtSeconds);
    hudRenderParams.pilotCameraLocalOffset = tickOutput.pilotCameraLocalOffset;
    hudRenderParams.profilingEnabled = profilingEnabled;
    hudRenderParams.simTimeSeconds = tickOutput.simTimeSeconds;
    hudRenderParams.speedMps = tickOutput.speedMps;

    hudRenderer.renderInto(renderedHud, hudRenderParams);

    rasterizeView(renderedPilotView, pilotRasterizer);
    rasterizeView(renderedTopView, topRasterizer);
    rasterizeHud(renderedHud, hudRasterizer);

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
  rasterizer.drawFaces(renderedView.faces, renderedView.faceCount);
  rasterizer.drawPolylines(renderedView.polylines, renderedView.polylineCount);
  rasterizer.drawSegments(renderedView.segments);
  rasterizer.drawBodyLabels(renderedView.bodyLabels);
}

function rasterizeHud(renderedHud: RenderedHud, rasterizer: Rasterizer) {
  rasterizer.drawHud(renderedHud);
}
