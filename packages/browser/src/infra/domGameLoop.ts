import type {
  ControlPlugin,
  FramePolicy,
  GamePlugin,
  LoopPlugin,
  LoopState,
  PluginCapabilityProvider,
  PluginCapabilityRegistry,
  SceneLabelCandidate,
  SceneLabelPlugin,
  SceneLabelProviderParams,
  SceneObjectFilter,
  ScenePlugin,
  SceneViewFilterParams,
  SegmentPlugin,
  SegmentProviderParams,
  SimulationPlugin,
  ViewControlPlugin,
  WorldSegment,
} from "@solitude/engine/plugin";
import type {
  RenderedView,
  SceneControlState,
  SceneState,
  SceneViewState,
  ViewRenderParams,
} from "@solitude/engine/render";
import {
  createSceneViewStates,
  getRequiredPrimaryViewState,
  updateSceneViewCameras,
} from "@solitude/engine/render";
import type { SceneOverlayRasterizer } from "@solitude/engine/render/ports";
import type {
  TickCallback,
  TickParams,
  WorldAndScene,
} from "@solitude/engine/runtime";
import {
  createPluginCapabilityRegistry,
  createTickHandler,
  profiler,
  validatePluginRequirements,
} from "@solitude/engine/runtime";
import {
  createScene,
  createWorld,
  getMainViewLookState,
} from "@solitude/engine/world";
import type { RunLoopParams, RunLoopView } from "./infraPorts";
import {
  applyBrowserOverlayProviders,
  collectBrowserOverlayProviders,
  type BrowserOverlayContext,
  type OverlayRasterizer,
} from "./overlayPorts";

type RenderPassDebug = {
  polylines: boolean;
  segments: boolean;
  sceneLabels: boolean;
};

type RenderDebug = {
  views: Record<string, boolean>;
  passes: RenderPassDebug;
  hud: boolean;
};

const defaultRenderPassDebug: RenderPassDebug = {
  polylines: true,
  segments: true,
  sceneLabels: true,
};

const defaultRenderDebug = {
  hud: true,
};

const EMPTY_ENTITY_CONTROL_INPUTS = new Map();

type LoopView = RunLoopView & {
  labelParams: SceneLabelProviderParams;
  objectsFilter?: SceneObjectFilter;
  renderedView: RenderedView;
  renderParams: ViewRenderParams;
  sceneLabelCandidates: SceneLabelCandidate[];
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
  const labelPlugins = collectLabelPlugins(plugins);
  const segmentPlugins = collectSegmentPlugins(plugins);
  const viewControlPlugins = collectViewControlPlugins(plugins);
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
    controlInputsByEntityId: EMPTY_ENTITY_CONTROL_INPUTS,
  };

  const tick: TickCallback = createTickHandler(
    gravityEngine,
    worldAndScene,
    tickParams,
    simulationPlugins,
  );

  updateSceneViewCameras(
    sceneState,
    worldAndScene.mainFocus,
    sceneControlState.mainViewLookState,
  );

  const loopViews = createLoopViews(
    views,
    sceneViews,
    scenePlugins,
    capabilityRegistry,
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
  const viewControlUpdateParams: Parameters<
    NonNullable<ViewControlPlugin["updateViewControls"]>
  >[0] = {
    controlInput,
    dtMillis: 0,
    mainFocus: worldAndScene.mainFocus,
    sceneControlState,
    sceneState,
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
      tick();
      simTimeMillis += tickParams.dtMillisSim;
    }

    if (framePolicy.advanceScene) {
      viewControlUpdateParams.dtMillis = dtTickMillis;
      applyViewControlPlugins(viewControlPlugins, viewControlUpdateParams);
      updateSceneViewCameras(
        sceneState,
        worldAndScene.mainFocus,
        sceneControlState.mainViewLookState,
      );
      sceneUpdateParams.dtMillis = dtTickMillis;
      sceneUpdateParams.dtSimMillis = dtSimMillis;
      applyScenePlugins(scenePlugins, sceneUpdateParams);
    }

    const passes = renderDebug.passes;
    const polylines = passes.polylines;
    const segments = passes.segments;
    const sceneLabels = passes.sceneLabels;
    primaryOverlayRasterizer?.beginFrame();

    for (const view of loopViews) {
      const renderParams = view.renderParams;
      renderParams.renderPolylines = polylines;
      renderParams.renderSegments = segments;
      renderParams.renderSceneLabels = sceneLabels;

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
      if (sceneLabels) {
        applyLabelPlugins(
          labelPlugins,
          view.sceneLabelCandidates,
          view.labelParams,
        );
      } else {
        view.sceneLabelCandidates.length = 0;
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
      rasterizeView(view.renderedView, view.sceneOverlayRasterizer);
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

function rasterizeView(view: RenderedView, rasterizer: SceneOverlayRasterizer) {
  rasterizer.clear();
  rasterizer.drawPolylines(view.polylines, view.polylineCount);
  rasterizer.drawSegments(view.segments, view.segmentCount);
  rasterizer.drawSceneLabels(view.sceneLabels, view.sceneLabelCount);
}

function createLoopViews(
  views: RunLoopView[],
  sceneViews: SceneViewState[],
  scenePlugins: ScenePlugin[],
  capabilityRegistry: PluginCapabilityRegistry,
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
    const sceneLabelCandidates: SceneLabelCandidate[] = [];
    const worldSegments: WorldSegment[] = [];

    result.push({
      ...view,
      labelParams: {
        capabilityRegistry,
        viewId,
        labelMode: view.definition.labelMode,
        mainFocus: worldAndScene.mainFocus,
        scene: worldAndScene.scene,
        world: worldAndScene.world,
        config,
      },
      objectsFilter,
      renderedView: createRenderedView(),
      renderParams: {
        camera: sceneView.camera,
        objectsFilter,
        renderPolylines: true,
        renderSceneLabels: true,
        renderSegments: true,
        scene: worldAndScene.scene,
        sceneLabelCandidates,
        surface: view.surface,
        worldSegments,
      },
      sceneLabelCandidates,
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
    polylines: [],
    polylineCount: 0,
    sceneLabels: [],
    sceneLabelCount: 0,
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

function collectScenePlugins(plugins: GamePlugin[]): ScenePlugin[] {
  const scenePlugins: ScenePlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.scene) {
      scenePlugins.push(plugin.scene);
    }
  }
  return scenePlugins;
}

function collectLabelPlugins(plugins: GamePlugin[]): SceneLabelPlugin[] {
  const labelPlugins: SceneLabelPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.labels) {
      labelPlugins.push(plugin.labels);
    }
  }
  return labelPlugins;
}

function collectViewControlPlugins(plugins: GamePlugin[]): ViewControlPlugin[] {
  const viewControlPlugins: ViewControlPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.viewControls) {
      viewControlPlugins.push(plugin.viewControls);
    }
  }
  return viewControlPlugins;
}

function applyLabelPlugins(
  plugins: SceneLabelPlugin[],
  into: SceneLabelCandidate[],
  params: SceneLabelProviderParams,
): void {
  into.length = 0;
  for (const plugin of plugins) {
    plugin.appendLabels?.(into, params);
  }
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

function applyViewControlPlugins(
  plugins: ViewControlPlugin[],
  params: Parameters<NonNullable<ViewControlPlugin["updateViewControls"]>>[0],
): void {
  for (const plugin of plugins) {
    plugin.updateViewControls?.(params);
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
