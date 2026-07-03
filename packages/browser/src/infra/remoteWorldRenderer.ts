import type {
  ControlInput,
  GamePlugin,
  MarkerPlugin,
  SceneLabelCandidate,
  SceneLabelPlugin,
  SceneLabelSink,
  SceneObjectFilter,
  ScenePlugin,
  SceneViewFilterParams,
  SegmentPlugin,
  SegmentProviderParams,
  ViewControlPlugin,
  WorldMarker,
  WorldMarkerSink,
  WorldSegment,
  WorldSegmentSink,
} from "@solitude/engine/plugin";
import type {
  RenderedView,
  RenderSurface2D,
  SceneControlState,
  SceneState,
  SceneViewId,
  SceneViewState,
  TextMetrics,
  ViewDefinition,
  ViewRenderer,
  ViewRenderParams,
} from "@solitude/engine/render";
import {
  buildViewDefinitions,
  createSceneViewStates,
  getRequiredPrimaryViewState,
  updateSceneViewCameras,
} from "@solitude/engine/render";
import type { SceneOverlayRasterizer } from "@solitude/engine/render/ports";
import { SceneOverlayRenderer } from "@solitude/engine/render/sceneOverlayRenderer";
import type { RuntimeWorldSnapshot } from "@solitude/engine/runtime";
import {
  createPluginCapabilityRegistry,
  createSceneLabelBuffer,
  createWorldMarkerBuffer,
  createWorldSegmentBuffer,
  validatePluginRequirements,
} from "@solitude/engine/runtime";
import type { WorldAndSceneConfig } from "@solitude/engine/world";
import { createScene, getMainViewLookState } from "@solitude/engine/world";
import {
  createRemoteWorldMirror,
  type RemoteWorldMirror,
} from "./remoteWorldMirror";

export interface RemoteWorldRendererOptions {
  config: WorldAndSceneConfig;
  measureText: (text: string, font: string) => TextMetrics;
  plugins: GamePlugin[];
  surface: RenderSurface2D;
  viewId?: SceneViewId;
}

export interface RemoteWorldRenderOptions {
  controlInput?: ControlInput;
  dtMillis?: number;
  dtSimMillis?: number;
  renderPolylines?: boolean;
  renderSceneLabels?: boolean;
  renderSegments?: boolean;
}

export interface RemoteWorldRenderer {
  readonly mirror: RemoteWorldMirror;
  readonly renderedView: RenderedView;
  readonly renderParams: ViewRenderParams;
  readonly sceneState: SceneState;
  readonly viewId: SceneViewId;
  renderCurrent: (options?: RemoteWorldRenderOptions) => void;
  renderSnapshot: (
    snapshot: RuntimeWorldSnapshot,
    options?: RemoteWorldRenderOptions,
  ) => boolean;
  setFocusEntityId: (entityId: string) => boolean;
}

export interface RemoteWorldMultiViewOptions {
  renderer: ViewRenderer;
  surface: RenderSurface2D;
  viewId: SceneViewId;
}

export interface RemoteWorldRenderedView {
  readonly renderedView: RenderedView;
  readonly renderParams: ViewRenderParams;
  readonly viewId: SceneViewId;
}

export interface RemoteWorldMultiRenderer {
  readonly mirror: RemoteWorldMirror;
  readonly primaryView: RemoteWorldRenderedView;
  readonly sceneState: SceneState;
  readonly views: readonly RemoteWorldRenderedView[];
  renderCurrent: (options?: RemoteWorldRenderOptions) => void;
  renderSnapshot: (
    snapshot: RuntimeWorldSnapshot,
    options?: RemoteWorldRenderOptions,
  ) => boolean;
  setFocusEntityId: (entityId: string) => boolean;
}

export interface RemoteWorldMultiRendererOptions {
  config: WorldAndSceneConfig;
  plugins: GamePlugin[];
  views: RemoteWorldMultiViewOptions[];
}

export function createRemoteWorldRenderer({
  config,
  measureText,
  plugins,
  surface,
  viewId,
}: RemoteWorldRendererOptions): RemoteWorldRenderer {
  const mirror = createRemoteWorldMirror(config);
  validatePluginRequirements({
    mainFocus: mirror.worldSetup.mainFocus,
    plugins,
    world: mirror.world,
  });

  const sceneSetup = createScene(mirror.world, config);
  const worldAndScene = {
    ...mirror.worldSetup,
    scene: sceneSetup.scene,
  };
  const scenePlugins = collectScenePlugins(plugins);
  const labelPlugins = collectLabelPlugins(plugins);
  const segmentPlugins = collectSegmentPlugins(plugins);
  const markerPlugins = collectMarkerPlugins(plugins);
  const viewControlPlugins = collectViewControlPlugins(plugins);
  const capabilityRegistry = createPluginCapabilityRegistry(
    plugins.flatMap((plugin) => plugin.capabilities ?? []),
  );

  applySceneInitPlugins(scenePlugins, {
    config,
    mainFocus: worldAndScene.mainFocus,
    scene: worldAndScene.scene,
    world: worldAndScene.world,
  });

  const viewDefinitions = buildViewDefinitions(config, plugins);
  const viewDefinition =
    viewId === undefined
      ? getRequiredPrimaryViewState(createSceneViewStates(viewDefinitions))
          .definition
      : requireViewDefinition(viewDefinitions, viewId);
  const sceneViews = createSceneViewStates([viewDefinition]);
  const sceneState: SceneState = {
    primaryView: getRequiredPrimaryViewState(sceneViews),
    views: sceneViews,
  };
  const sceneView = sceneViews[0];
  const mainViewLookState = getMainViewLookState(config.render);
  const sceneControlState: SceneControlState = { mainViewLookState };
  const sceneLabelBuffer = createSceneLabelBuffer();
  const sceneLabelCandidates = sceneLabelBuffer.items as SceneLabelCandidate[];
  const worldSegmentBuffer = createWorldSegmentBuffer();
  const worldMarkerBuffer = createWorldMarkerBuffer();
  const worldSegments = worldSegmentBuffer.items as WorldSegment[];
  const worldMarkers = worldMarkerBuffer.items as WorldMarker[];
  const objectsFilter = buildSceneObjectsFilter(scenePlugins, {
    config,
    mainFocus: worldAndScene.mainFocus,
    scene: worldAndScene.scene,
    viewId: viewDefinition.id,
    world: worldAndScene.world,
  });
  const renderedView = createRenderedView();
  const renderer: ViewRenderer = new SceneOverlayRenderer(
    measureText,
    viewDefinition.labelMode,
  );
  const renderParams: ViewRenderParams = {
    camera: sceneView.camera,
    objectsFilter,
    renderPolylines: true,
    renderSceneLabels: true,
    renderSegments: true,
    scene: worldAndScene.scene,
    sceneLabelCandidateCount: 0,
    sceneLabelCandidates,
    surface,
    worldMarkerCount: 0,
    worldSegments,
    worldSegmentCount: 0,
    worldMarkers,
  };

  const renderCurrent = (options: RemoteWorldRenderOptions = {}) => {
    applyViewControlPlugins(viewControlPlugins, {
      controlInput: options.controlInput,
      dtMillis: options.dtMillis ?? 0,
      mainFocus: worldAndScene.mainFocus,
      sceneControlState,
      sceneState,
    });
    updateSceneViewCameras(
      sceneState,
      worldAndScene.mainFocus,
      mainViewLookState,
    );
    applyScenePlugins(scenePlugins, {
      dtMillis: options.dtMillis ?? 0,
      dtSimMillis: options.dtSimMillis ?? options.dtMillis ?? 0,
      mainFocus: worldAndScene.mainFocus,
      scene: worldAndScene.scene,
      world: worldAndScene.world,
    });
    applySegmentPlugins(segmentPlugins, worldSegmentBuffer, {
      config,
      mainFocus: worldAndScene.mainFocus,
      scene: worldAndScene.scene,
      viewId: viewDefinition.id,
      world: worldAndScene.world,
    });
    applyMarkerPlugins(markerPlugins, worldMarkerBuffer, {
      config,
      mainFocus: worldAndScene.mainFocus,
      scene: worldAndScene.scene,
      viewId: viewDefinition.id,
      world: worldAndScene.world,
    });
    applyLabelPlugins(labelPlugins, sceneLabelBuffer, {
      capabilityRegistry,
      config,
      labelMode: viewDefinition.labelMode,
      mainFocus: worldAndScene.mainFocus,
      scene: worldAndScene.scene,
      viewId: viewDefinition.id,
      world: worldAndScene.world,
    });

    renderParams.renderPolylines = options.renderPolylines ?? true;
    renderParams.renderSceneLabels = options.renderSceneLabels ?? true;
    renderParams.renderSegments = options.renderSegments ?? true;
    renderParams.sceneLabelCandidateCount = sceneLabelBuffer.count;
    renderParams.worldMarkerCount = worldMarkerBuffer.count;
    renderParams.worldSegmentCount = worldSegmentBuffer.count;
    renderer.renderInto(renderedView, renderParams);
  };

  return {
    mirror,
    renderedView,
    renderParams,
    sceneState,
    viewId: viewDefinition.id,
    renderCurrent,
    renderSnapshot: (snapshot, options) => {
      if (!mirror.applySnapshot(snapshot)) return false;
      renderCurrent(options);
      return true;
    },
    setFocusEntityId: (entityId) => setFocusEntityId(mirror, entityId),
  };
}

export function createRemoteWorldMultiRenderer({
  config,
  plugins,
  views,
}: RemoteWorldMultiRendererOptions): RemoteWorldMultiRenderer {
  if (!views.length) {
    throw new Error("At least one remote render view is required");
  }

  const mirror = createRemoteWorldMirror(config);
  validatePluginRequirements({
    mainFocus: mirror.worldSetup.mainFocus,
    plugins,
    world: mirror.world,
  });

  const sceneSetup = createScene(mirror.world, config);
  const worldAndScene = {
    ...mirror.worldSetup,
    scene: sceneSetup.scene,
  };
  const scenePlugins = collectScenePlugins(plugins);
  const labelPlugins = collectLabelPlugins(plugins);
  const segmentPlugins = collectSegmentPlugins(plugins);
  const markerPlugins = collectMarkerPlugins(plugins);
  const viewControlPlugins = collectViewControlPlugins(plugins);
  const capabilityRegistry = createPluginCapabilityRegistry(
    plugins.flatMap((plugin) => plugin.capabilities ?? []),
  );

  applySceneInitPlugins(scenePlugins, {
    config,
    mainFocus: worldAndScene.mainFocus,
    scene: worldAndScene.scene,
    world: worldAndScene.world,
  });

  const viewDefinitions = buildViewDefinitions(config, plugins);
  const configuredDefinitions = views.map((view) =>
    requireViewDefinition(viewDefinitions, view.viewId),
  );
  const sceneViews = createSceneViewStates(configuredDefinitions);
  const sceneState: SceneState = {
    primaryView: getRequiredPrimaryViewState(sceneViews),
    views: sceneViews,
  };
  const mainViewLookState = getMainViewLookState(config.render);
  const sceneControlState: SceneControlState = { mainViewLookState };
  const renderedViews = createRemoteRenderedViews({
    config,
    mirror,
    scene: worldAndScene.scene,
    scenePlugins,
    sceneViews,
    views,
  });
  const primaryView = requirePrimaryRenderedView(renderedViews);

  const renderCurrent = (options: RemoteWorldRenderOptions = {}) => {
    applyViewControlPlugins(viewControlPlugins, {
      controlInput: options.controlInput,
      dtMillis: options.dtMillis ?? 0,
      mainFocus: worldAndScene.mainFocus,
      sceneControlState,
      sceneState,
    });
    updateSceneViewCameras(
      sceneState,
      worldAndScene.mainFocus,
      mainViewLookState,
    );
    applyScenePlugins(scenePlugins, {
      dtMillis: options.dtMillis ?? 0,
      dtSimMillis: options.dtSimMillis ?? options.dtMillis ?? 0,
      mainFocus: worldAndScene.mainFocus,
      scene: worldAndScene.scene,
      world: worldAndScene.world,
    });
    for (const view of renderedViews) {
      const definition = view.sceneView.definition;
      applySegmentPlugins(segmentPlugins, view.worldSegmentBuffer, {
        config,
        mainFocus: worldAndScene.mainFocus,
        scene: worldAndScene.scene,
        viewId: definition.id,
        world: worldAndScene.world,
      });
      applyMarkerPlugins(markerPlugins, view.worldMarkerBuffer, {
        config,
        mainFocus: worldAndScene.mainFocus,
        scene: worldAndScene.scene,
        viewId: definition.id,
        world: worldAndScene.world,
      });
      applyLabelPlugins(labelPlugins, view.sceneLabelBuffer, {
        capabilityRegistry,
        config,
        labelMode: definition.labelMode,
        mainFocus: worldAndScene.mainFocus,
        scene: worldAndScene.scene,
        viewId: definition.id,
        world: worldAndScene.world,
      });

      view.renderParams.renderPolylines = options.renderPolylines ?? true;
      view.renderParams.renderSceneLabels = options.renderSceneLabels ?? true;
      view.renderParams.renderSegments = options.renderSegments ?? true;
      view.renderParams.sceneLabelCandidateCount = view.sceneLabelBuffer.count;
      view.renderParams.worldMarkerCount = view.worldMarkerBuffer.count;
      view.renderParams.worldSegmentCount = view.worldSegmentBuffer.count;
      view.renderer.renderInto(view.renderedView, view.renderParams);
    }
  };

  return {
    mirror,
    primaryView,
    sceneState,
    views: renderedViews,
    renderCurrent,
    renderSnapshot: (snapshot, options) => {
      if (!mirror.applySnapshot(snapshot)) return false;
      renderCurrent(options);
      return true;
    },
    setFocusEntityId: (entityId) => setFocusEntityId(mirror, entityId),
  };
}

export function rasterizeSceneOverlay(
  view: RenderedView,
  rasterizer: SceneOverlayRasterizer,
): void {
  rasterizer.clear();
  rasterizer.drawMarkers(view.markers, view.markerCount);
  rasterizer.drawSceneLabels(view.sceneLabels, view.sceneLabelCount);
}

type InternalRemoteWorldRenderedView = RemoteWorldRenderedView & {
  readonly renderer: ViewRenderer;
  readonly sceneLabelCandidates: SceneLabelCandidate[];
  readonly sceneLabelBuffer: SceneLabelSink;
  readonly sceneView: SceneViewState;
  readonly worldSegments: WorldSegment[];
  readonly worldSegmentBuffer: WorldSegmentSink;
  readonly worldMarkers: WorldMarker[];
  readonly worldMarkerBuffer: WorldMarkerSink;
};

function createRemoteRenderedViews({
  config,
  mirror,
  scene,
  scenePlugins,
  sceneViews,
  views,
}: {
  config: WorldAndSceneConfig;
  mirror: RemoteWorldMirror;
  scene: ReturnType<typeof createScene>["scene"];
  scenePlugins: ScenePlugin[];
  sceneViews: SceneViewState[];
  views: RemoteWorldMultiViewOptions[];
}): InternalRemoteWorldRenderedView[] {
  return sceneViews.map((sceneView, index) => {
    const view = views[index];
    const sceneLabelBuffer = createSceneLabelBuffer();
    const sceneLabelCandidates =
      sceneLabelBuffer.items as SceneLabelCandidate[];
    const worldSegmentBuffer = createWorldSegmentBuffer();
    const worldMarkerBuffer = createWorldMarkerBuffer();
    const worldSegments = worldSegmentBuffer.items as WorldSegment[];
    const worldMarkers = worldMarkerBuffer.items as WorldMarker[];
    const objectsFilter = buildSceneObjectsFilter(scenePlugins, {
      config,
      mainFocus: mirror.worldSetup.mainFocus,
      scene,
      viewId: sceneView.definition.id,
      world: mirror.world,
    });
    const renderedView = createRenderedView();
    return {
      renderedView,
      renderer: view.renderer,
      renderParams: {
        camera: sceneView.camera,
        objectsFilter,
        renderPolylines: true,
        renderSceneLabels: true,
        renderSegments: true,
        scene,
        sceneLabelCandidateCount: 0,
        sceneLabelCandidates,
        surface: view.surface,
        worldMarkerCount: 0,
        worldSegments,
        worldSegmentCount: 0,
        worldMarkers,
      },
      sceneLabelCandidates,
      sceneLabelBuffer,
      sceneView,
      viewId: sceneView.definition.id,
      worldSegments,
      worldSegmentBuffer,
      worldMarkers,
      worldMarkerBuffer,
    };
  });
}

function requirePrimaryRenderedView(
  views: readonly InternalRemoteWorldRenderedView[],
): InternalRemoteWorldRenderedView {
  for (const view of views) {
    if (view.sceneView.definition.layout.kind === "primary") return view;
  }
  throw new Error("Required primary remote render view not found");
}

function requireViewDefinition(
  definitions: ReturnType<typeof buildViewDefinitions>,
  viewId: SceneViewId,
): ViewDefinition {
  for (const definition of definitions) {
    if (definition.id === viewId) return definition;
  }
  throw new Error(`Remote render view not found: ${viewId}`);
}

function setFocusEntityId(
  mirror: RemoteWorldMirror,
  entityId: string,
): boolean {
  for (const controlledBody of mirror.world.controllableBodies) {
    if (controlledBody.id !== entityId) continue;
    mirror.worldSetup.mainFocus.entityId = entityId;
    mirror.worldSetup.mainFocus.controlledBody = controlledBody;
    return true;
  }
  return false;
}

function createRenderedView(): RenderedView {
  return {
    markers: [],
    markerCount: 0,
    sceneLabels: [],
    sceneLabelCount: 0,
    segments: [],
    segmentCount: 0,
  };
}

function collectMarkerPlugins(plugins: GamePlugin[]): MarkerPlugin[] {
  const markerPlugins: MarkerPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.markers) markerPlugins.push(plugin.markers);
  }
  return markerPlugins;
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

function collectSegmentPlugins(plugins: GamePlugin[]): SegmentPlugin[] {
  const segmentPlugins: SegmentPlugin[] = [];
  for (const plugin of plugins) {
    if (plugin.segments) {
      segmentPlugins.push(plugin.segments);
    }
  }
  return segmentPlugins;
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

function applySceneInitPlugins(
  plugins: ScenePlugin[],
  params: Parameters<NonNullable<ScenePlugin["initScene"]>>[0],
): void {
  for (const plugin of plugins) {
    plugin.initScene?.(params);
  }
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
  params: Omit<
    Parameters<NonNullable<ViewControlPlugin["updateViewControls"]>>[0],
    "controlInput"
  > & { controlInput?: ControlInput },
): void {
  const controlInput = params.controlInput;
  if (!controlInput) return;
  for (const plugin of plugins) {
    plugin.updateViewControls?.({
      controlInput,
      dtMillis: params.dtMillis,
      mainFocus: params.mainFocus,
      sceneControlState: params.sceneControlState,
      sceneState: params.sceneState,
    });
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

function applyLabelPlugins(
  plugins: SceneLabelPlugin[],
  into: SceneLabelSink,
  params: Parameters<NonNullable<SceneLabelPlugin["appendLabels"]>>[1],
): void {
  into.reset();
  for (const plugin of plugins) {
    plugin.appendLabels?.(into, params);
  }
}

function applySegmentPlugins(
  plugins: SegmentPlugin[],
  segments: WorldSegmentSink,
  params: SegmentProviderParams,
): void {
  segments.reset();
  for (const plugin of plugins) {
    plugin.appendSegments?.(segments, params);
  }
}

function applyMarkerPlugins(
  plugins: MarkerPlugin[],
  markers: WorldMarkerSink,
  params: SegmentProviderParams,
): void {
  markers.reset();
  for (const plugin of plugins) {
    plugin.appendMarkers?.(markers, params);
  }
}
