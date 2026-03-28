import type { SceneState } from "../app/appInternals.js";
import { createTickHandler } from "../app/game.js";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "../app/runtimePorts.js";
import { updateSceneGraph } from "../app/scene.js";
import type { SceneControlState, SceneObject } from "../app/scenePorts.js";
import { computeShipOrbitReadout } from "../domain/orbit.js";
import { vec3 } from "../domain/vec3.js";
import { parameters } from "../global/parameters.js";
import type {
  HudRenderParams,
  Rasterizer,
  RenderedHud,
  RenderedView,
  ViewRenderParams,
} from "../render/renderPorts.js";
import { createSceneAndTrajectories } from "../setup/sceneSetup.js";
import { createWorld } from "../setup/setup.js";
import { buildTrajectoryPlan } from "../setup/trajectoryPlan.js";
import { updateFps } from "./fps.js";
import type { RunLoopParams } from "./infraPorts.js";
import { handlePauseToggle } from "./pause.js";
import { handleProfilingToggle } from "./profilerControl.js";
import { handleTimeScaleChange } from "./timeScale.js";

/**
 * DOM-level game loop (depends on requestAnimationFrame).
 */
export function runLoop({
  config,
  pilotViewRenderer,
  pilotRasterizer,
  topViewRenderer,
  topRasterizer,
  hudRenderer,
  hudRasterizer,
  gravityEngine,
  pilotSurface,
  topSurface,
  controlInput,
  envInput,
  profilerController,
}: RunLoopParams): void {
  const worldSetup = createWorld(config);
  const trajectoryPlan = buildTrajectoryPlan(
    worldSetup.world,
    config.physics.planets,
    config.render.planets,
  );
  const { scene, trajectoryList } = createSceneAndTrajectories(
    worldSetup.world,
    config,
    trajectoryPlan,
  );
  const worldAndScene: WorldAndScene = {
    ...worldSetup,
    scene,
    trajectoryList,
  };
  const tickInto: TickCallback = createTickHandler(
    gravityEngine,
    config.thrustLevel,
    worldAndScene,
  );

  const sceneControlState: SceneControlState = {
    pilotLookState: config.render.pilotLookState,
    pilotCameraOffset: config.render.pilotCameraOffset,
    topCameraOffset: config.render.topCameraOffset,
  };

  const sceneState: SceneState = {
    pilotCamera: worldAndScene.pilotCamera,
    topCamera: worldAndScene.topCamera,
    trajectoryList: worldAndScene.trajectoryList,
  };

  const tickParams: TickParams = {
    dtMillis: 0,
    dtMillisSim: 0,
    controlInput,
  };

  const tickOutput: TickOutput = {
    currentThrustLevel: 0,
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
    orbitReadout: null,
    paused: false,
    pilotCameraLocalOffset: sceneControlState.pilotCameraOffset,
    profilingEnabled: false,
    simTimeMillis: 0,
    speedMps: 0,
  };

  const renderedHud: RenderedHud = Array.from({ length: 4 }, () => [
    "",
    "",
    "",
    "",
  ]);

  let lastTimeMs: number;
  let lastHudTimeMs: number;
  let dtMillis: number;
  let paused: boolean;
  let profilingEnabled: boolean;
  let fps: number;
  let simTimeMillis = 0;
  let timeScale = parameters.timeScale;

  const loop = (nowMs: number) => {
    dtMillis = nowMs - lastTimeMs;
    lastTimeMs = nowMs;

    paused = handlePauseToggle(envInput.pauseToggle);
    profilingEnabled = handleProfilingToggle(envInput.profilingToggle);
    profilerController.setEnabled(profilingEnabled);
    profilerController.setPaused(paused);
    profilerController.check();

    timeScale = handleTimeScaleChange(
      envInput.decreaseTimeScale,
      envInput.increaseTimeScale,
      timeScale,
    );

    if (!paused) {
      tickParams.dtMillis = dtMillis;
      tickParams.dtMillisSim = dtMillis * timeScale;
      tickInto(tickOutput, tickParams);
      simTimeMillis += tickParams.dtMillisSim;

      updateSceneGraph(
        dtMillis,
        tickParams.dtMillisSim,
        sceneState,
        sceneControlState,
        worldAndScene.mainShip,
        controlInput,
      );
    }

    pilotViewRenderer.renderInto(renderedPilotView, pilotViewRenderParams);
    topViewRenderer.renderInto(renderedTopView, topViewRenderParams);

    fps = updateFps(dtMillis);

    const shouldRenderHud = nowMs - lastHudTimeMs > 100;

    if (shouldRenderHud) {
      hudRenderParams.currentThrustLevel = tickOutput.currentThrustLevel;
      hudRenderParams.currentTimeScale = timeScale;
      hudRenderParams.fps = fps;
      hudRenderParams.orbitReadout = computeShipOrbitReadout(
        worldAndScene.world,
        worldAndScene.mainShip,
      );
      hudRenderParams.paused = paused;
      hudRenderParams.pilotCameraLocalOffset =
        sceneControlState.pilotCameraOffset;
      hudRenderParams.profilingEnabled = profilingEnabled;
      hudRenderParams.simTimeMillis = simTimeMillis;
      hudRenderParams.speedMps = vec3.length(worldAndScene.mainShip.velocity);

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
