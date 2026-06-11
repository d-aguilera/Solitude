import type {
  GamePlugin,
  SceneLabelCandidate,
  SceneLabelPlugin,
  SceneObjectFilter,
  ScenePlugin,
  SceneViewFilterParams,
  SegmentPlugin,
  SegmentProviderParams,
  WorldSegment,
} from "@solitude/engine/plugin";
import type {
  Rasterizer,
  RenderedView,
  RenderSurface2D,
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
  createRenderFrameCache,
  createSceneViewStates,
  DefaultViewRenderer,
  getRequiredPrimaryViewState,
  updateRenderFrameCache,
  updateSceneViewCameras,
} from "@solitude/engine/render";
import type { RuntimeWorldSnapshot } from "@solitude/engine/runtime";
import { validatePluginRequirements } from "@solitude/engine/runtime";
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
  dtMillis?: number;
  dtSimMillis?: number;
  renderFaces?: boolean;
  renderPolylines?: boolean;
  renderSceneLabels?: boolean;
  renderSegments?: boolean;
  sortFaces?: boolean;
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
  measureText: (text: string, font: string) => TextMetrics;
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
  const renderCache = createRenderFrameCache();
  const sceneLabelCandidates: SceneLabelCandidate[] = [];
  const worldSegments: WorldSegment[] = [];
  const objectsFilter = buildSceneObjectsFilter(scenePlugins, {
    config,
    mainFocus: worldAndScene.mainFocus,
    scene: worldAndScene.scene,
    viewId: viewDefinition.id,
    world: worldAndScene.world,
  });
  const renderedView = createRenderedView();
  const renderer: ViewRenderer = new DefaultViewRenderer(
    measureText,
    viewDefinition.labelMode,
  );
  const renderParams: ViewRenderParams = {
    camera: sceneView.camera,
    mainFocus: worldAndScene.mainFocus,
    objectsFilter,
    renderCache,
    scene: worldAndScene.scene,
    sceneLabelCandidates,
    surface,
    worldSegments,
  };

  const renderCurrent = (options: RemoteWorldRenderOptions = {}) => {
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
    updateRenderFrameCache(renderCache, worldAndScene.scene);
    applySegmentPlugins(segmentPlugins, worldSegments, {
      config,
      mainFocus: worldAndScene.mainFocus,
      scene: worldAndScene.scene,
      viewId: viewDefinition.id,
      world: worldAndScene.world,
    });
    applyLabelPlugins(labelPlugins, sceneLabelCandidates, {
      config,
      labelMode: viewDefinition.labelMode,
      mainFocus: worldAndScene.mainFocus,
      scene: worldAndScene.scene,
      viewId: viewDefinition.id,
      world: worldAndScene.world,
    });

    renderParams.renderFaces = options.renderFaces ?? true;
    renderParams.renderPolylines = options.renderPolylines ?? true;
    renderParams.renderSceneLabels = options.renderSceneLabels ?? true;
    renderParams.renderSegments = options.renderSegments ?? true;
    renderParams.sortFaces = options.sortFaces ?? true;
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
  const renderCache = createRenderFrameCache();
  const renderedViews = createRemoteRenderedViews({
    config,
    mirror,
    renderCache,
    scene: worldAndScene.scene,
    scenePlugins,
    sceneViews,
    views,
  });
  const primaryView = requirePrimaryRenderedView(renderedViews);

  const renderCurrent = (options: RemoteWorldRenderOptions = {}) => {
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
    updateRenderFrameCache(renderCache, worldAndScene.scene);

    for (const view of renderedViews) {
      const definition = view.sceneView.definition;
      applySegmentPlugins(segmentPlugins, view.worldSegments, {
        config,
        mainFocus: worldAndScene.mainFocus,
        scene: worldAndScene.scene,
        viewId: definition.id,
        world: worldAndScene.world,
      });
      applyLabelPlugins(labelPlugins, view.sceneLabelCandidates, {
        config,
        labelMode: definition.labelMode,
        mainFocus: worldAndScene.mainFocus,
        scene: worldAndScene.scene,
        viewId: definition.id,
        world: worldAndScene.world,
      });

      view.renderParams.renderFaces = options.renderFaces ?? true;
      view.renderParams.renderPolylines = options.renderPolylines ?? true;
      view.renderParams.renderSceneLabels = options.renderSceneLabels ?? true;
      view.renderParams.renderSegments = options.renderSegments ?? true;
      view.renderParams.sortFaces = options.sortFaces ?? true;
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

export function rasterizeRenderedView(
  view: RenderedView,
  rasterizer: Rasterizer,
  drawFaces = true,
): void {
  rasterizer.clear("#000000");
  if (drawFaces) {
    rasterizer.drawFaces(view.faces, view.faceCount);
  }
  rasterizer.drawPolylines(view.polylines, view.polylineCount);
  rasterizer.drawSegments(view.segments, view.segmentCount);
  rasterizer.drawSceneLabels(view.sceneLabels, view.sceneLabelCount);
}

type InternalRemoteWorldRenderedView = RemoteWorldRenderedView & {
  readonly renderer: ViewRenderer;
  readonly sceneLabelCandidates: SceneLabelCandidate[];
  readonly sceneView: SceneViewState;
  readonly worldSegments: WorldSegment[];
};

function createRemoteRenderedViews({
  config,
  mirror,
  renderCache,
  scene,
  scenePlugins,
  sceneViews,
  views,
}: {
  config: WorldAndSceneConfig;
  mirror: RemoteWorldMirror;
  renderCache: ReturnType<typeof createRenderFrameCache>;
  scene: ReturnType<typeof createScene>["scene"];
  scenePlugins: ScenePlugin[];
  sceneViews: SceneViewState[];
  views: RemoteWorldMultiViewOptions[];
}): InternalRemoteWorldRenderedView[] {
  return sceneViews.map((sceneView, index) => {
    const view = views[index];
    const sceneLabelCandidates: SceneLabelCandidate[] = [];
    const worldSegments: WorldSegment[] = [];
    const objectsFilter = buildSceneObjectsFilter(scenePlugins, {
      config,
      mainFocus: mirror.worldSetup.mainFocus,
      scene,
      viewId: sceneView.definition.id,
      world: mirror.world,
    });
    const renderedView = createRenderedView();
    const renderer: ViewRenderer = new DefaultViewRenderer(
      view.measureText,
      sceneView.definition.labelMode,
    );
    return {
      renderedView,
      renderer,
      renderParams: {
        camera: sceneView.camera,
        mainFocus: mirror.worldSetup.mainFocus,
        objectsFilter,
        renderCache,
        scene,
        sceneLabelCandidates,
        surface: view.surface,
        worldSegments,
      },
      sceneLabelCandidates,
      sceneView,
      viewId: sceneView.definition.id,
      worldSegments,
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
    faces: [],
    faceCount: 0,
    polylines: [],
    polylineCount: 0,
    sceneLabels: [],
    sceneLabelCount: 0,
    segments: [],
    segmentCount: 0,
  };
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
  into: SceneLabelCandidate[],
  params: Parameters<NonNullable<SceneLabelPlugin["appendLabels"]>>[1],
): void {
  into.length = 0;
  for (const plugin of plugins) {
    plugin.appendLabels?.(into, params);
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
