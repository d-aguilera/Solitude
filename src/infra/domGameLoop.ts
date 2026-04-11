import { createTickHandler } from "../app/game";
import type { HudRenderParams } from "../app/hudPorts";
import type {
  ControlPlugin,
  FramePolicy,
  GamePlugin,
  HudContext,
  HudPlugin,
  LoopPlugin,
  LoopState,
  SceneObjectFilter,
  ScenePlugin,
  SceneViewFilterParams,
  SceneViewId,
} from "../app/pluginPorts";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "../app/runtimePorts";
import { updateSceneGraph } from "../app/scene";
import type { SceneControlState, SceneState } from "../app/scenePorts";
import { computeShipOrbitReadout } from "../domain/orbit";
import { vec3 } from "../domain/vec3";
import type {
  Rasterizer,
  RenderedHud,
  RenderedView,
  ViewRenderParams,
} from "../render/renderPorts";
import { createScene } from "../setup/sceneSetup";
import { createWorld } from "../setup/setup";
import { updateFps } from "./fps";
import type { RunLoopParams } from "./infraPorts";
import { handleProfilingToggle } from "./profilerControl";

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
  plugins,
}: RunLoopParams): void {
  const controlPlugins = collectControlPlugins(plugins);
  const hudPlugins = collectHudPlugins(plugins);
  const loopPlugins = collectLoopPlugins(plugins);
  const scenePlugins = collectScenePlugins(plugins);

  applyLoopInitPlugins(loopPlugins, { config });

  const worldSetup = createWorld(config);
  const { scene } = createScene(worldSetup.world, config);
  applySceneInitPlugins(scenePlugins, {
    scene,
    world: worldSetup.world,
    mainShip: worldSetup.mainShip,
    config,
  });
  const pilotViewId: SceneViewId = "pilot";
  const topViewId: SceneViewId = "top";
  const pilotObjectsFilter = buildSceneObjectsFilter(scenePlugins, {
    viewId: pilotViewId,
    scene,
    world: worldSetup.world,
    mainShip: worldSetup.mainShip,
    config,
  });
  const topObjectsFilter = buildSceneObjectsFilter(scenePlugins, {
    viewId: topViewId,
    scene,
    world: worldSetup.world,
    mainShip: worldSetup.mainShip,
    config,
  });
  const worldAndScene: WorldAndScene = {
    ...worldSetup,
    scene,
  };
  const tickInto: TickCallback = createTickHandler(
    gravityEngine,
    config.thrustLevel,
    worldAndScene,
    controlPlugins,
  );

  const sceneControlState: SceneControlState = {
    pilotLookState: config.render.pilotLookState,
    pilotCameraOffset: config.render.pilotCameraOffset,
    topCameraOffset: config.render.topCameraOffset,
  };

  const sceneState: SceneState = {
    pilotCamera: worldAndScene.pilotCamera,
    topCamera: worldAndScene.topCamera,
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
    objectsFilter: pilotObjectsFilter,
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
    objectsFilter: topObjectsFilter,
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
    currentRcsLevel: 0,
    fps: 0,
    hudCells: [],
    orbitReadout: null,
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
  let profilingEnabled: boolean;
  let fps: number;
  let simTimeMillis = 0;
  const loopState: LoopState = {
    framePolicy: createDefaultFramePolicy(),
  };
  const loopUpdateParams: Parameters<
    NonNullable<LoopPlugin["updateLoopState"]>
  >[0] = {
    envInput,
    controlInput,
    dtMillis: 0,
    nowMs: 0,
    state: loopState,
  };

  const loop = (nowMs: number) => {
    dtMillis = nowMs - lastTimeMs;
    lastTimeMs = nowMs;

    loopUpdateParams.dtMillis = dtMillis;
    loopUpdateParams.nowMs = nowMs;
    applyLoopPlugins(loopPlugins, loopUpdateParams);
    profilingEnabled = handleProfilingToggle(envInput.profilingToggle);
    profilerController.setEnabled(profilingEnabled);
    profilerController.setPaused(!loopState.framePolicy.advanceSim);
    profilerController.check();

    const framePolicy = loopState.framePolicy;
    const dtSimMillis = framePolicy.simDtMillis ?? dtMillis;

    if (framePolicy.advanceSim) {
      tickParams.dtMillis = dtMillis;
      tickParams.dtMillisSim = dtSimMillis;
      tickInto(tickOutput, tickParams);
      simTimeMillis += tickParams.dtMillisSim;
    }

    if (framePolicy.advanceScene) {
      updateSceneGraph(
        dtMillis,
        sceneState,
        sceneControlState,
        worldAndScene.mainShip,
        controlInput,
      );
      applyScenePlugins(scenePlugins, {
        dtMillis,
        dtSimMillis,
        scene: worldAndScene.scene,
        world: worldAndScene.world,
        mainShip: worldAndScene.mainShip,
      });
    }

    pilotViewRenderer.renderInto(renderedPilotView, pilotViewRenderParams);
    topViewRenderer.renderInto(renderedTopView, topViewRenderParams);

    fps = updateFps(dtMillis);

    const shouldRenderHud = nowMs - lastHudTimeMs > 100;

    if (shouldRenderHud && framePolicy.advanceHud) {
      hudRenderParams.currentThrustLevel = tickOutput.currentThrustLevel;
      hudRenderParams.currentRcsLevel = tickOutput.currentRcsLevel;
      hudRenderParams.fps = fps;
      hudRenderParams.orbitReadout = computeShipOrbitReadout(
        worldAndScene.world,
        worldAndScene.mainShip,
      );
      hudRenderParams.pilotCameraLocalOffset =
        sceneControlState.pilotCameraOffset;
      hudRenderParams.profilingEnabled = profilingEnabled;
      hudRenderParams.simTimeMillis = simTimeMillis;
      hudRenderParams.speedMps = vec3.length(worldAndScene.mainShip.velocity);
      hudRenderParams.hudCells.length = 0;
      applyHudPlugins(hudPlugins, hudRenderParams, {
        controlInput,
        mainShip: worldAndScene.mainShip,
        nowMs,
        world: worldAndScene.world,
      });

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

function collectHudPlugins(plugins: GamePlugin[]): HudPlugin[] {
  const hudPlugins: HudPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.hud) {
      hudPlugins.push(plugin.hud);
    }
  }
  return hudPlugins;
}

function collectScenePlugins(plugins: GamePlugin[]): ScenePlugin[] {
  const scenePlugins: ScenePlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.scene) {
      scenePlugins.push(plugin.scene);
    }
  }
  return scenePlugins;
}

function collectLoopPlugins(plugins: GamePlugin[]): LoopPlugin[] {
  const loopPlugins: LoopPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.loop) {
      loopPlugins.push(plugin.loop);
    }
  }
  return loopPlugins;
}

function collectControlPlugins(plugins: GamePlugin[]): ControlPlugin[] {
  const controlPlugins: ControlPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.controls) {
      controlPlugins.push(plugin.controls);
    }
  }
  return controlPlugins;
}

function applyLoopInitPlugins(
  plugins: LoopPlugin[],
  params: Parameters<NonNullable<LoopPlugin["initLoop"]>>[0],
): void {
  for (const plugin of plugins) {
    plugin.initLoop?.(params);
  }
}

function applySceneInitPlugins(
  plugins: ScenePlugin[],
  params: Parameters<NonNullable<ScenePlugin["initScene"]>>[0],
): void {
  for (const plugin of plugins) {
    plugin.initScene?.(params);
  }
}

function buildSceneObjectsFilter(
  plugins: ScenePlugin[],
  params: SceneViewFilterParams,
): SceneObjectFilter | undefined {
  const filters: SceneObjectFilter[] = [];
  for (const plugin of plugins) {
    const filter = plugin.getViewObjectsFilter?.(params);
    if (filter) {
      filters.push(filter);
    }
  }
  if (!filters.length) return undefined;
  return (obj) => {
    for (const filter of filters) {
      if (!filter(obj)) return false;
    }
    return true;
  };
}

function applyLoopPlugins(
  plugins: LoopPlugin[],
  params: Parameters<NonNullable<LoopPlugin["updateLoopState"]>>[0],
): void {
  const state = params.state;
  for (const plugin of plugins) {
    const next = plugin.updateLoopState?.(params);
    if (!next) continue;
    if (next.framePolicy) {
      const policy = next.framePolicy;
      if (policy.advanceSim !== undefined) {
        state.framePolicy.advanceSim = policy.advanceSim;
      }
      if (policy.advanceScene !== undefined) {
        state.framePolicy.advanceScene = policy.advanceScene;
      }
      if (policy.advanceHud !== undefined) {
        state.framePolicy.advanceHud = policy.advanceHud;
      }
      if (policy.simDtMillis !== undefined) {
        state.framePolicy.simDtMillis = policy.simDtMillis;
      }
    }
  }
}

function createDefaultFramePolicy(): FramePolicy {
  return {
    advanceSim: true,
    advanceScene: true,
    advanceHud: true,
  };
}

function applyScenePlugins(
  plugins: ScenePlugin[],
  params: Parameters<NonNullable<ScenePlugin["updateScene"]>>[0],
): void {
  for (const plugin of plugins) {
    plugin.updateScene?.(params);
  }
}

function applyHudPlugins(
  plugins: HudPlugin[],
  hudParams: HudRenderParams,
  context: HudContext,
): void {
  for (const plugin of plugins) {
    plugin.updateHudParams?.(hudParams, context);
  }
}
