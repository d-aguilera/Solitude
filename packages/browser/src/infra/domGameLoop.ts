import { createTickHandler } from "@solitude/engine/app/game";
import { createPluginCapabilityRegistry } from "@solitude/engine/app/pluginCapabilities";
import { validatePluginRequirements } from "@solitude/engine/app/pluginRequirements";
import type {
  TickCallback,
  TickParams,
  WorldAndScene,
} from "@solitude/engine/app/runtimePorts";
import { profiler } from "@solitude/engine/global/profiling";
import type {
  ControlPlugin,
  FramePolicy,
  GamePlugin,
  LoopPlugin,
  LoopState,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
  SceneObjectFilter,
  ScenePlugin,
  SceneViewFilterParams,
  SegmentPlugin,
  SegmentProviderParams,
  SimulationPlugin,
  WorldSegment,
} from "@solitude/engine/plugin";
import type {
  Rasterizer,
  RenderedView,
  SceneControlState,
  SceneState,
  SceneViewState,
  ViewRenderParams,
} from "@solitude/engine/render";
import {
  createRenderFrameCache,
  createSceneViewStates,
  getRequiredPrimaryViewState,
  updateRenderFrameCache,
  updateSceneGraph,
} from "@solitude/engine/render";
import {
  createScene,
  createWorld,
  getMainViewLookState,
} from "@solitude/engine/world";
import type { RunLoopParams, RunLoopView } from "./infraPorts";
import {
  browserOverlayCapability,
  type BrowserOverlayContext,
  type BrowserOverlayProvider,
  type OverlayRasterizer,
} from "./overlayPorts";

type RenderPassDebug = {
  faces: boolean;
  facesBuild: boolean;
  facesRaster: boolean;
  facesSort: boolean;
  polylines: boolean;
  segments: boolean;
  bodyLabels: boolean;
};

type RenderDebug = {
  views: Record<string, boolean>;
  passes: RenderPassDebug;
  hud: boolean;
};

const defaultRenderPassDebug: RenderPassDebug = {
  faces: true,
  facesBuild: true,
  facesRaster: true,
  facesSort: true,
  polylines: true,
  segments: true,
  bodyLabels: true,
};

const defaultRenderDebug = {
  hud: true,
};

type LoopView = RunLoopView & {
  objectsFilter?: SceneObjectFilter;
  renderedView: RenderedView;
  renderParams: ViewRenderParams;
  segmentParams: SegmentProviderParams;
  worldSegments: WorldSegment[];
};

function getRenderDebug(views: readonly LoopView[]): RenderDebug {
  const root = globalThis as typeof globalThis & {
    __solitudeRenderDebug?: Partial<RenderDebug>;
  };

  const defaultViews = createDefaultViewDebug(views);
  if (!root.__solitudeRenderDebug) {
    root.__solitudeRenderDebug = {
      views: defaultViews,
      passes: { ...defaultRenderPassDebug },
      hud: defaultRenderDebug.hud,
    };
    return root.__solitudeRenderDebug as RenderDebug;
  }

  const existing = root.__solitudeRenderDebug;
  existing.views = { ...defaultViews, ...existing.views };
  existing.passes = { ...defaultRenderPassDebug, ...existing.passes };
  if (existing.hud === undefined) {
    existing.hud = defaultRenderDebug.hud;
  }
  return existing as RenderDebug;
}

function createDefaultViewDebug(
  views: readonly LoopView[],
): Record<string, boolean> {
  const viewDebug: Record<string, boolean> = {};
  for (const view of views) {
    viewDebug[view.definition.id] = true;
  }
  return viewDebug;
}

/**
 * DOM-level game loop (depends on requestAnimationFrame).
 */
export function runLoop({
  config,
  views,
  gravityEngine,
  controlInput,
  plugins,
}: RunLoopParams): void {
  const controlPlugins = collectControlPlugins(plugins);
  const capabilityRegistry = createPluginCapabilityRegistry(
    collectCapabilityProviders(plugins),
  );
  const loopPlugins = collectLoopPlugins(plugins);
  const scenePlugins = collectScenePlugins(plugins);
  const segmentPlugins = collectSegmentPlugins(plugins);
  const simulationPlugins = collectSimulationPlugins(
    plugins,
    controlPlugins,
    capabilityRegistry,
  );
  const overlayProviders = collectBrowserOverlayProviders(capabilityRegistry);

  const worldSetup = createWorld(config);
  validatePluginRequirements({
    mainFocus: worldSetup.mainFocus,
    plugins,
    world: worldSetup.world,
  });
  const { scene } = createScene(worldSetup.world, config);

  applyLoopInitPlugins(loopPlugins, { config });

  applySceneInitPlugins(scenePlugins, {
    scene,
    world: worldSetup.world,
    mainFocus: worldSetup.mainFocus,
    config,
  });

  const worldAndScene: WorldAndScene = {
    ...worldSetup,
    scene,
  };

  const tick: TickCallback = createTickHandler(
    gravityEngine,
    worldAndScene,
    simulationPlugins,
  );

  const sceneControlState: SceneControlState = {
    mainViewLookState: getMainViewLookState(config.render),
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

  const renderCache = createRenderFrameCache();

  updateSceneGraph(
    0,
    sceneState,
    sceneControlState,
    worldAndScene.mainFocus,
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
  const primaryOverlayRasterizer = getPrimaryOverlayRasterizer(loopViews);

  let lastTimeMs: number;
  let lastOverlayTimeMs: number;
  let dtMillis: number;
  let simTimeMillis = getInitialSimTimeMillis(loopPlugins);
  const loopState: LoopState = {
    framePolicy: createDefaultFramePolicy(),
  };
  const loopUpdateParams: Parameters<
    NonNullable<LoopPlugin["updateLoopState"]>
  >[0] = {
    controlInput,
    dtMillis: 0,
    mainFocus: worldAndScene.mainFocus,
    nowMs: 0,
    simTimeMillis: 0,
    state: loopState,
    world: worldAndScene.world,
  };
  const sceneUpdateParams: Parameters<
    NonNullable<ScenePlugin["updateScene"]>
  >[0] = {
    dtMillis: 0,
    dtSimMillis: 0,
    scene: worldAndScene.scene,
    world: worldAndScene.world,
    mainFocus: worldAndScene.mainFocus,
  };
  const overlayContext: BrowserOverlayContext = {
    advanceOverlay: false,
    controlInput,
    framePolicy: loopState.framePolicy,
    mainFocus: worldAndScene.mainFocus,
    nowMs: 0,
    primaryOverlayRasterizer,
    simTimeMillis: 0,
    world: worldAndScene.world,
  };
  const renderDebug = getRenderDebug(loopViews);

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
      tick(tickParams);
      simTimeMillis += tickParams.dtMillisSim;
    }

    if (framePolicy.advanceScene) {
      updateSceneGraph(
        dtTickMillis,
        sceneState,
        sceneControlState,
        worldAndScene.mainFocus,
        controlInput,
      );
      sceneUpdateParams.dtMillis = dtTickMillis;
      sceneUpdateParams.dtSimMillis = dtSimMillis;
      applyScenePlugins(scenePlugins, sceneUpdateParams);
    }

    if (framePolicy.advanceSim || framePolicy.advanceScene) {
      if (profiler.begin("render", "frameCacheUpdate")) {
        try {
          updateRenderFrameCache(renderCache, worldAndScene.scene);
        } finally {
          profiler.end("render", "frameCacheUpdate");
        }
      } else {
        updateRenderFrameCache(renderCache, worldAndScene.scene);
      }
    }

    const passes = renderDebug.passes;
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
      if (profiler.begin("viewRender", view.definition.id)) {
        try {
          view.renderer.renderInto(view.renderedView, renderParams);
        } finally {
          profiler.end("viewRender", view.definition.id);
        }
      } else {
        view.renderer.renderInto(view.renderedView, renderParams);
      }
    }

    const shouldAdvanceOverlay = nowMs - lastOverlayTimeMs > 100;

    for (const view of loopViews) {
      if (!isViewEnabled(renderDebug, view.definition.id)) continue;
      rasterizeView(view.renderedView, view.rasterizer, facesRaster);
    }
    if (renderDebug.hud) {
      overlayContext.advanceOverlay =
        shouldAdvanceOverlay && framePolicy.advanceOverlay;
      overlayContext.framePolicy = framePolicy;
      overlayContext.nowMs = nowMs;
      overlayContext.simTimeMillis = simTimeMillis;
      applyBrowserOverlayProviders(
        overlayProviders,
        overlayContext,
        capabilityRegistry,
      );
      if (shouldAdvanceOverlay) {
        lastOverlayTimeMs = nowMs;
      }
    }
    loopUpdateParams.simTimeMillis = simTimeMillis;
    applyLoopPostPlugins(loopPlugins, loopUpdateParams);

    requestAnimationFrame(loop);
  };

  const first = (nowMs: number) => {
    lastTimeMs = nowMs;
    lastOverlayTimeMs = nowMs;
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
      mainFocus: worldAndScene.mainFocus,
      config,
    });
    const worldSegments: WorldSegment[] = [];

    result.push({
      ...view,
      objectsFilter,
      renderedView: createRenderedView(),
      renderParams: {
        camera: sceneView.camera,
        mainFocus: worldAndScene.mainFocus,
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
        mainFocus: worldAndScene.mainFocus,
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

function getPrimaryOverlayRasterizer(
  views: LoopView[],
): OverlayRasterizer | null {
  for (const view of views) {
    if (view.definition.layout.kind === "primary") {
      return view.overlayRasterizer;
    }
  }
  throw new Error("Required primary overlay rasterizer not registered");
}

function isViewEnabled(renderDebug: RenderDebug, viewId: string): boolean {
  return renderDebug.views[viewId] !== false;
}

function collectBrowserOverlayProviders(
  capabilityRegistry: PluginCapabilityRegistry,
): BrowserOverlayProvider[] {
  return capabilityRegistry
    .getAll(browserOverlayCapability)
    .filter(isBrowserOverlayProvider);
}

function isBrowserOverlayProvider(
  value: unknown,
): value is BrowserOverlayProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "renderOverlay" in value &&
    typeof value.renderOverlay === "function"
  );
}

function applyBrowserOverlayProviders(
  providers: BrowserOverlayProvider[],
  context: Parameters<BrowserOverlayProvider["renderOverlay"]>[0],
  capabilityRegistry: PluginCapabilityRegistry,
): void {
  for (const provider of providers) {
    provider.renderOverlay(context, capabilityRegistry);
  }
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

function collectCapabilityProviders(
  plugins: GamePlugin[],
): PluginCapabilityProvider[] {
  const providers: PluginCapabilityProvider[] = [];
  for (const plugin of plugins) {
    if (plugin.capabilities) {
      providers.push(...plugin.capabilities);
    }
  }
  return providers;
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

function collectSimulationPlugins(
  plugins: GamePlugin[],
  controlPlugins: ControlPlugin[],
  capabilityRegistry: PluginCapabilityRegistry,
): SimulationPlugin[] {
  const simulationPlugins: SimulationPlugin[] = [];
  for (const plugin of plugins) {
    if (!plugin.simulation) continue;
    simulationPlugins.push(
      typeof plugin.simulation === "function"
        ? plugin.simulation({ capabilityRegistry, controlPlugins })
        : plugin.simulation,
    );
  }
  return simulationPlugins;
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
      if (policy.advanceOverlay !== undefined) {
        state.framePolicy.advanceOverlay = policy.advanceOverlay;
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
    advanceOverlay: true,
  };
}

function resetFramePolicy(policy: FramePolicy): void {
  policy.advanceSim = true;
  policy.advanceScene = true;
  policy.advanceOverlay = true;
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
