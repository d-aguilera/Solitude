import { createTickHandler } from "../app/game";
import type { HudGrid } from "../app/hudPorts";
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
  SegmentPlugin,
  SegmentProviderParams,
  WorldSegment,
} from "../app/pluginPorts";
import type {
  TickCallback,
  TickOutput,
  TickParams,
  WorldAndScene,
} from "../app/runtimePorts";
import { updateSceneGraph } from "../app/scene";
import type { SceneControlState, SceneState } from "../app/scenePorts";
import type { SceneViewState } from "../app/viewPorts";
import {
  createSceneViewStates,
  getRequiredPrimaryViewState,
} from "../app/viewRegistry";
import {
  createRenderFrameCache,
  updateRenderFrameCache,
} from "../render/renderFrameCache";
import type {
  Rasterizer,
  RenderedView,
  ViewRenderParams,
} from "../render/renderPorts";
import { createScene } from "../setup/sceneSetup";
import { createWorld } from "../setup/setup";
import { updateFps } from "./fps";
import type { RunLoopParams, RunLoopView } from "./infraPorts";

type RenderDebug = {
  views: Record<string, boolean | undefined>;
  passes: {
    faces: boolean;
    facesBuild: boolean;
    facesRaster: boolean;
    facesSort: boolean;
    polylines: boolean;
    segments: boolean;
    bodyLabels: boolean;
  };
  hud: boolean;
};

const defaultRenderDebug: RenderDebug = {
  views: {},
  passes: {
    faces: true,
    facesBuild: true,
    facesRaster: true,
    facesSort: true,
    polylines: true,
    segments: true,
    bodyLabels: true,
  },
  hud: true,
};

type LoopView = RunLoopView & {
  objectsFilter?: SceneObjectFilter;
  renderedView: RenderedView;
  renderParams: ViewRenderParams;
  segmentParams: SegmentProviderParams;
  worldSegments: WorldSegment[];
};

function getRenderDebug(): RenderDebug {
  const root = globalThis as typeof globalThis & {
    __solitudeRenderDebug?: RenderDebug;
  };
  if (!root.__solitudeRenderDebug) {
    root.__solitudeRenderDebug = {
      views: { ...defaultRenderDebug.views },
      passes: { ...defaultRenderDebug.passes },
      hud: defaultRenderDebug.hud,
    };
    return root.__solitudeRenderDebug;
  }

  const existing = root.__solitudeRenderDebug;
  existing.views = { ...defaultRenderDebug.views, ...existing.views };
  existing.passes = { ...defaultRenderDebug.passes, ...existing.passes };
  if (existing.hud === undefined) {
    existing.hud = defaultRenderDebug.hud;
  }
  return existing;
}

/**
 * DOM-level game loop (depends on requestAnimationFrame).
 */
export function runLoop({
  config,
  views,
  hudRenderer,
  hudRasterizer,
  gravityEngine,
  controlInput,
  plugins,
}: RunLoopParams): void {
  const controlPlugins = collectControlPlugins(plugins);
  const hudPlugins = collectHudPlugins(plugins);
  const loopPlugins = collectLoopPlugins(plugins);
  const scenePlugins = collectScenePlugins(plugins);
  const segmentPlugins = collectSegmentPlugins(plugins);

  applyLoopInitPlugins(loopPlugins, { config });

  const worldSetup = createWorld(config);
  const { scene } = createScene(worldSetup.world, config);
  applySceneInitPlugins(scenePlugins, {
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
  };
  const sceneViews = createSceneViewStates(
    views.map((view) => view.definition),
  );

  const sceneState: SceneState = {
    primaryView: getRequiredPrimaryViewState(sceneViews),
    views: sceneViews,
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

  const renderCache = createRenderFrameCache();
  updateSceneGraph(
    0,
    sceneState,
    sceneControlState,
    worldAndScene.mainShip,
    controlInput,
  );
  updateRenderFrameCache(renderCache, worldAndScene.scene);
  const loopViews = createLoopViews(
    views,
    sceneViews,
    scenePlugins,
    renderCache,
    worldAndScene,
    config,
  );

  const renderedHud: HudGrid = createHudGrid();

  let lastTimeMs: number;
  let lastHudTimeMs: number;
  let dtMillis: number;
  let fps: number;
  let simTimeMillis = getInitialSimTimeMillis(loopPlugins);
  const loopState: LoopState = {
    framePolicy: createDefaultFramePolicy(),
  };
  const loopUpdateParams: Parameters<
    NonNullable<LoopPlugin["updateLoopState"]>
  >[0] = {
    controlInput,
    dtMillis: 0,
    mainShip: worldAndScene.mainShip,
    nowMs: 0,
    simTimeMillis: 0,
    state: loopState,
    world: worldAndScene.world,
  };
  const renderDebug = getRenderDebug();

  const loop = (nowMs: number) => {
    dtMillis = nowMs - lastTimeMs;
    lastTimeMs = nowMs;

    resetFramePolicy(loopState.framePolicy);
    loopUpdateParams.dtMillis = dtMillis;
    loopUpdateParams.nowMs = nowMs;
    loopUpdateParams.simTimeMillis = simTimeMillis;
    applyLoopPlugins(loopPlugins, loopUpdateParams);
    const framePolicy = loopState.framePolicy;
    const dtTickMillis = framePolicy.tickDtMillis ?? dtMillis;
    const dtSimMillis = framePolicy.simDtMillis ?? dtTickMillis;

    if (framePolicy.advanceSim) {
      tickParams.dtMillis = dtTickMillis;
      tickParams.dtMillisSim = dtSimMillis;
      tickInto(tickOutput, tickParams);
      simTimeMillis += tickParams.dtMillisSim;
    }

    if (framePolicy.advanceScene) {
      updateSceneGraph(
        dtTickMillis,
        sceneState,
        sceneControlState,
        worldAndScene.mainShip,
        controlInput,
      );
      applyScenePlugins(scenePlugins, {
        dtMillis: dtTickMillis,
        dtSimMillis,
        scene: worldAndScene.scene,
        world: worldAndScene.world,
        mainShip: worldAndScene.mainShip,
      });
    }

    if (framePolicy.advanceSim || framePolicy.advanceScene) {
      updateRenderFrameCache(renderCache, worldAndScene.scene);
    }

    const { passes } = renderDebug;
    const facesBuild = passes.faces && passes.facesBuild;
    const facesRaster = passes.faces && passes.facesRaster;
    const facesSort = passes.faces && passes.facesSort;
    const polylines = passes.polylines;
    const segments = passes.segments;
    const bodyLabels = passes.bodyLabels;

    for (const view of loopViews) {
      const renderParams = view.renderParams;
      renderParams.renderFaces = facesBuild;
      renderParams.sortFaces = facesSort;
      renderParams.renderPolylines = polylines;
      renderParams.renderSegments = segments;
      renderParams.renderBodyLabels = bodyLabels;

      if (!isViewEnabled(renderDebug, view.definition.id)) continue;

      if (segments) {
        applySegmentPlugins(
          segmentPlugins,
          view.worldSegments,
          view.segmentParams,
        );
      } else {
        view.worldSegments.length = 0;
      }
      view.renderer.renderInto(view.renderedView, renderParams);
    }

    fps = updateFps(dtMillis);

    const shouldRenderHud = nowMs - lastHudTimeMs > 100;

    if (shouldRenderHud && framePolicy.advanceHud && renderDebug.hud) {
      clearHudGrid(renderedHud);
      applyHudPlugins(hudPlugins, renderedHud, {
        controlInput,
        currentRcsLevel: tickOutput.currentRcsLevel,
        currentThrustLevel: tickOutput.currentThrustLevel,
        fps,
        mainShip: worldAndScene.mainShip,
        nowMs,
        simTimeMillis,
        world: worldAndScene.world,
      });

      hudRenderer.renderInto(renderedHud, renderedHud);
      lastHudTimeMs = nowMs;
    }

    for (const view of loopViews) {
      if (!isViewEnabled(renderDebug, view.definition.id)) continue;
      rasterizeView(view.renderedView, view.rasterizer, facesRaster);
    }
    if (renderDebug.hud) rasterizeHud(renderedHud, hudRasterizer);
    loopUpdateParams.simTimeMillis = simTimeMillis;
    applyLoopPostPlugins(loopPlugins, loopUpdateParams);

    requestAnimationFrame(loop);
  };

  const first = (nowMs: number) => {
    lastTimeMs = nowMs;
    lastHudTimeMs = nowMs;
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(first);
}

function rasterizeView(
  view: RenderedView,
  rasterizer: Rasterizer,
  drawFaces: boolean,
) {
  rasterizer.clear("#000000");
  if (drawFaces) {
    rasterizer.drawFaces(view.faces, view.faceCount);
  }
  rasterizer.drawPolylines(view.polylines, view.polylineCount);
  rasterizer.drawSegments(view.segments, view.segmentCount);
  rasterizer.drawBodyLabels(view.bodyLabels, view.bodyLabelCount);
}

function createLoopViews(
  views: RunLoopView[],
  sceneViews: SceneViewState[],
  scenePlugins: ScenePlugin[],
  renderCache: ReturnType<typeof createRenderFrameCache>,
  worldAndScene: WorldAndScene,
  config: RunLoopParams["config"],
): LoopView[] {
  const result: LoopView[] = [];
  for (let i = 0; i < views.length; i++) {
    const view = views[i];
    const sceneView = sceneViews[i];
    const viewId = view.definition.id;
    const objectsFilter = buildSceneObjectsFilter(scenePlugins, {
      viewId,
      scene: worldAndScene.scene,
      world: worldAndScene.world,
      mainShip: worldAndScene.mainShip,
      config,
    });
    const worldSegments: WorldSegment[] = [];

    result.push({
      ...view,
      objectsFilter,
      renderedView: createRenderedView(),
      renderParams: {
        camera: sceneView.camera,
        mainShip: worldAndScene.mainShip,
        objectsFilter,
        renderCache,
        scene: worldAndScene.scene,
        surface: view.surface,
        worldSegments,
      },
      segmentParams: {
        viewId,
        scene: worldAndScene.scene,
        world: worldAndScene.world,
        mainShip: worldAndScene.mainShip,
        config,
      },
      worldSegments,
    });
  }
  return result;
}

function createRenderedView(): RenderedView {
  return {
    bodyLabels: [],
    bodyLabelCount: 0,
    faces: [],
    faceCount: 0,
    polylines: [],
    polylineCount: 0,
    segments: [],
    segmentCount: 0,
  };
}

function isViewEnabled(renderDebug: RenderDebug, viewId: string): boolean {
  return renderDebug.views[viewId] !== false;
}

function rasterizeHud(hud: HudGrid, rasterizer: Rasterizer) {
  rasterizer.drawHud(hud);
}

function createHudGrid(): HudGrid {
  return [
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
    ["", "", "", "", ""],
  ];
}

function clearHudGrid(grid: HudGrid): void {
  for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
    const row = grid[rowIndex];
    row[0] = "";
    row[1] = "";
    row[2] = "";
    row[3] = "";
    row[4] = "";
  }
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

function collectSegmentPlugins(plugins: GamePlugin[]): SegmentPlugin[] {
  const segmentPlugins: SegmentPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.segments) {
      segmentPlugins.push(plugin.segments);
    }
  }
  return segmentPlugins;
}

function applyLoopInitPlugins(
  plugins: LoopPlugin[],
  params: Parameters<NonNullable<LoopPlugin["initLoop"]>>[0],
): void {
  for (const plugin of plugins) {
    plugin.initLoop?.(params);
  }
}

function getInitialSimTimeMillis(plugins: LoopPlugin[]): number {
  for (const plugin of plugins) {
    const simTimeMillis = plugin.getInitialSimTimeMillis?.();
    if (simTimeMillis != null) return simTimeMillis;
  }
  return 0;
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
      if (policy.tickDtMillis !== undefined) {
        state.framePolicy.tickDtMillis = policy.tickDtMillis;
      }
      if (policy.simDtMillis !== undefined) {
        state.framePolicy.simDtMillis = policy.simDtMillis;
      }
    }
  }
}

function applyLoopPostPlugins(
  plugins: LoopPlugin[],
  params: Parameters<NonNullable<LoopPlugin["updateLoopState"]>>[0],
): void {
  for (const plugin of plugins) {
    plugin.afterFrame?.(params);
  }
}

function createDefaultFramePolicy(): FramePolicy {
  return {
    advanceSim: true,
    advanceScene: true,
    advanceHud: true,
  };
}

function resetFramePolicy(policy: FramePolicy): void {
  policy.advanceSim = true;
  policy.advanceScene = true;
  policy.advanceHud = true;
  policy.tickDtMillis = undefined;
  policy.simDtMillis = undefined;
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
  grid: HudGrid,
  context: HudContext,
): void {
  for (const plugin of plugins) {
    plugin.updateHudParams(grid, context);
  }
}

function applySegmentPlugins(
  plugins: SegmentPlugin[],
  segments: WorldSegment[],
  params: SegmentProviderParams,
): void {
  segments.length = 0;
  for (const plugin of plugins) {
    plugin.appendSegments?.(segments, params);
  }
}
