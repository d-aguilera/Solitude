import type { SceneState } from "../app/appInternals.js";
import type { ControlInput } from "../app/controlPorts.js";
import { createTickHandler } from "../app/game.js";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "../app/runtimePorts.js";
import { updateSceneGraph } from "../app/scene.js";
import type { SceneControlState, SceneObject } from "../app/scenePorts.js";
import { EPS_LEN_COARSE, EPS_SPEED_COARSE } from "../domain/epsilon.js";
import { computeShipOrbitReadout, getDominantBodyPrimary } from "../domain/orbit.js";
import { vec3 } from "../domain/vec3.js";
import { parameters } from "../global/parameters.js";
import type {
  CircleNowHudDebug,
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
    currentRcsLevel: 0,
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
    autopilotMode: "none",
    circleNowDebug: null,
    currentThrustLevel: 0,
    currentRcsLevel: 0,
    currentTimeScale: 0,
    fps: 0,
    orbitReadout: null,
    paused: false,
    pilotCameraLocalOffset: sceneControlState.pilotCameraOffset,
    profilingEnabled: false,
    simTimeMillis: 0,
    speedMps: 0,
  };

  const renderedHud: RenderedHud = Array.from({ length: 5 }, () => [
    "",
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
  let prevTangentialValid = false;
  let prevTangentialTimeMs = 0;
  let lastCircleNowActive = false;
  const prevTangentialDir = vec3.zero();
  const debugRScratch = vec3.zero();
  const debugRHatScratch = vec3.zero();
  const debugVRelScratch = vec3.zero();
  const debugTScratch = vec3.zero();
  const circleNowDebug: CircleNowHudDebug = {
    active: false,
    radialSpeed: 0,
    tangentialSpeed: 0,
    tangentialSource: "none",
    tangentialDirDot: null,
    tangentialDirDeltaDeg: null,
    tangentialDirRateDegPerSec: null,
  };

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
      hudRenderParams.currentRcsLevel = tickOutput.currentRcsLevel;
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
      hudRenderParams.autopilotMode = getAutopilotMode(controlInput);
      hudRenderParams.circleNowDebug = circleNowDebug;

      updateCircleNowDebug(
        circleNowDebug,
        worldAndScene.world,
        worldAndScene.mainShip,
        controlInput.circleNow,
        nowMs,
      );

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

  function updateCircleNowDebug(
    debug: CircleNowHudDebug,
    world: WorldAndScene["world"],
    ship: WorldAndScene["mainShip"],
    circleNowActive: boolean,
    nowMs: number,
  ): void {
    debug.active = circleNowActive;
    if (!circleNowActive) {
      debug.tangentialSource = "none";
      debug.tangentialDirDot = null;
      debug.tangentialDirDeltaDeg = null;
      debug.tangentialDirRateDegPerSec = null;
      debug.radialSpeed = 0;
      debug.tangentialSpeed = 0;
      prevTangentialValid = false;
      lastCircleNowActive = false;
      prevTangentialTimeMs = 0;
      return;
    }

    if (!lastCircleNowActive) {
      prevTangentialValid = false;
      prevTangentialTimeMs = 0;
    }
    lastCircleNowActive = true;

    const primary = getDominantBodyPrimary(world, ship.position);
    if (!primary) {
      debug.tangentialSource = "none";
      debug.tangentialDirDot = null;
      debug.tangentialDirDeltaDeg = null;
      debug.tangentialDirRateDegPerSec = null;
      debug.radialSpeed = 0;
      debug.tangentialSpeed = 0;
      prevTangentialValid = false;
      prevTangentialTimeMs = 0;
      return;
    }

    vec3.subInto(debugRScratch, ship.position, primary.body.position);
    const rLen = vec3.length(debugRScratch);
    if (rLen === 0) {
      debug.tangentialSource = "none";
      debug.tangentialDirDot = null;
      debug.tangentialDirDeltaDeg = null;
      debug.tangentialDirRateDegPerSec = null;
      debug.radialSpeed = 0;
      debug.tangentialSpeed = 0;
      prevTangentialValid = false;
      prevTangentialTimeMs = 0;
      return;
    }

    vec3.scaleInto(debugRHatScratch, 1 / rLen, debugRScratch);
    vec3.subInto(debugVRelScratch, ship.velocity, primary.body.velocity);
    const radialSpeed = vec3.dot(debugRHatScratch, debugVRelScratch);
    debug.radialSpeed = radialSpeed;

    vec3.scaleInto(debugTScratch, radialSpeed, debugRHatScratch);
    vec3.subInto(debugTScratch, debugVRelScratch, debugTScratch);
    const tangentialSpeed = vec3.length(debugTScratch);
    debug.tangentialSpeed = tangentialSpeed;

    let directionValid = false;
    if (tangentialSpeed > EPS_SPEED_COARSE) {
      vec3.scaleInto(debugTScratch, 1 / tangentialSpeed, debugTScratch);
      debug.tangentialSource = "velocity";
      directionValid = true;
    } else {
      vec3.copyInto(debugTScratch, ship.frame.right);
      const proj = vec3.dot(debugTScratch, debugRHatScratch);
      debugTScratch.x -= proj * debugRHatScratch.x;
      debugTScratch.y -= proj * debugRHatScratch.y;
      debugTScratch.z -= proj * debugRHatScratch.z;
      const projLen = vec3.length(debugTScratch);
      if (projLen > EPS_LEN_COARSE) {
        vec3.scaleInto(debugTScratch, 1 / projLen, debugTScratch);
        debug.tangentialSource = "fallback";
        directionValid = true;
      } else {
        debug.tangentialSource = "none";
      }
    }

    if (directionValid && prevTangentialValid) {
      const dot = vec3.dot(prevTangentialDir, debugTScratch);
      const clampedDot = Math.min(1, Math.max(-1, dot));
      debug.tangentialDirDot = clampedDot;
      const deltaDeg = (Math.acos(clampedDot) * 180) / Math.PI;
      debug.tangentialDirDeltaDeg = deltaDeg;
      const dtSec = (nowMs - prevTangentialTimeMs) / 1000;
      debug.tangentialDirRateDegPerSec =
        dtSec > 0 ? deltaDeg / dtSec : null;
    } else {
      debug.tangentialDirDot = null;
      debug.tangentialDirDeltaDeg = null;
      debug.tangentialDirRateDegPerSec = null;
    }

    if (directionValid) {
      vec3.copyInto(prevTangentialDir, debugTScratch);
      prevTangentialValid = true;
      prevTangentialTimeMs = nowMs;
    } else {
      prevTangentialValid = false;
      prevTangentialTimeMs = 0;
    }
  }
}

function getAutopilotMode(controlInput: ControlInput): HudRenderParams["autopilotMode"] {
  if (controlInput.circleNow) return "circleNow";
  if (controlInput.alignToBody) return "alignToBody";
  if (controlInput.alignToVelocity) return "alignToVelocity";
  return "none";
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
