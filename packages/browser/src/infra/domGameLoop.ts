import type { FramePolicy } from "@solitude/engine/plugin";
import type { RenderedView, ViewRenderParams } from "@solitude/engine/render";
import type { SceneOverlayRasterizer } from "@solitude/engine/render/ports";
import type { GamePipelineView, WorldAndScene } from "@solitude/engine/runtime";
import {
  createConfiguredGamePipeline,
  profiler,
} from "@solitude/engine/runtime";
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

type LoopView = RunLoopView & {
  pipelineView: GamePipelineView;
  renderedView: RenderedView;
  renderParams: ViewRenderParams;
};

const defaultRenderPassDebug: RenderPassDebug = {
  polylines: true,
  sceneLabels: true,
  segments: true,
};

export function runLoop({
  config,
  views,
  gravityEngine,
  controlInput,
  plugins,
}: RunLoopParams): void {
  const pipeline = createConfiguredGamePipeline({
    config,
    controlInput,
    gravityEngine,
    plugins,
    viewDefinitions: views.map((view) => view.definition),
  });
  const worldAndScene = pipeline.worldAndScene;
  const loopViews = createLoopViews(views, pipeline.views, worldAndScene);
  const primaryOverlayRasterizer = getPrimaryOverlayRasterizer(loopViews);
  const overlayProviders = collectBrowserOverlayProviders(
    pipeline.capabilityRegistry,
  );
  const overlayContext: BrowserOverlayContext = {
    advanceOverlay: false,
    controlInput,
    framePolicy: createOverlayFramePolicy(),
    mainFocus: worldAndScene.mainFocus,
    nowMs: 0,
    primaryOverlayRasterizer,
    simTimeMillis: 0,
    world: worldAndScene.world,
  };
  const renderDebug = getRenderDebug(loopViews);
  let lastTimeMs = 0;
  let lastOverlayTimeMs = 0;

  const loop = (nowMs: number) => {
    const dtMillis = nowMs - lastTimeMs;
    lastTimeMs = nowMs;
    const frame = pipeline.beginFrame(nowMs, dtMillis);
    primaryOverlayRasterizer?.beginFrame();
    renderViews(loopViews, pipeline.prepareView, renderDebug);

    const shouldAdvanceOverlay = nowMs - lastOverlayTimeMs > 100;
    for (const view of loopViews) {
      if (!isViewEnabled(renderDebug, view.definition.id)) continue;
      rasterizeView(view.renderedView, view.sceneOverlayRasterizer);
    }
    if (renderDebug.hud) {
      overlayContext.advanceOverlay =
        shouldAdvanceOverlay && frame.framePolicy.advancePresentation;
      overlayContext.framePolicy = frame.framePolicy;
      overlayContext.nowMs = nowMs;
      overlayContext.simTimeMillis = frame.simTimeMillis;
      applyBrowserOverlayProviders(
        overlayProviders,
        overlayContext,
        pipeline.capabilityRegistry,
      );
      if (shouldAdvanceOverlay) lastOverlayTimeMs = nowMs;
    }
    pipeline.endFrame();
    requestAnimationFrame(loop);
  };

  requestAnimationFrame((nowMs) => {
    lastTimeMs = nowMs;
    lastOverlayTimeMs = nowMs;
    requestAnimationFrame(loop);
  });
}

function createLoopViews(
  views: RunLoopView[],
  pipelineViews: GamePipelineView[],
  worldAndScene: WorldAndScene,
): LoopView[] {
  return views.map((view, index) => {
    const pipelineView = pipelineViews[index];
    const renderedView = createRenderedView();
    return {
      ...view,
      pipelineView,
      renderedView,
      renderParams: {
        camera: pipelineView.sceneView.camera,
        objectsFilter: pipelineView.objectsFilter,
        renderPolylines: true,
        renderSceneLabels: true,
        renderSegments: true,
        scene: worldAndScene.scene,
        sceneLabelCandidates: pipelineView.sceneLabelCandidates,
        surface: view.surface,
        worldMarkerCount: pipelineView.worldMarkerCount,
        worldMarkers: pipelineView.worldMarkers,
        worldSegmentCount: pipelineView.worldSegmentCount,
        worldSegments: pipelineView.worldSegments,
      },
    };
  });
}

function renderViews(
  views: LoopView[],
  prepareView: (
    view: GamePipelineView,
    includeLabels: boolean,
    includeSegments: boolean,
  ) => void,
  debug: RenderDebug,
): void {
  for (const view of views) {
    if (!isViewEnabled(debug, view.definition.id)) continue;
    const passes = debug.passes;
    prepareView(view.pipelineView, passes.sceneLabels, passes.segments);
    view.renderParams.renderPolylines = passes.polylines;
    view.renderParams.renderSceneLabels = passes.sceneLabels;
    view.renderParams.renderSegments = passes.segments;
    view.renderParams.worldMarkerCount = view.pipelineView.worldMarkerCount;
    view.renderParams.worldSegmentCount = view.pipelineView.worldSegmentCount;
    if (profiler.begin("viewRender", view.definition.id)) {
      try {
        view.renderer.renderInto(view.renderedView, view.renderParams);
      } finally {
        profiler.end("viewRender", view.definition.id);
      }
    } else {
      view.renderer.renderInto(view.renderedView, view.renderParams);
    }
  }
}

function rasterizeView(view: RenderedView, rasterizer: SceneOverlayRasterizer) {
  rasterizer.clear();
  rasterizer.drawMarkers(view.markers, view.markerCount);
  rasterizer.drawSceneLabels(view.sceneLabels, view.sceneLabelCount);
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

function getRenderDebug(views: readonly LoopView[]): RenderDebug {
  const root = globalThis as typeof globalThis & {
    __solitudeRenderDebug?: Partial<RenderDebug>;
  };
  const defaultViews = Object.fromEntries(
    views.map((view) => [view.definition.id, true]),
  );
  if (!root.__solitudeRenderDebug) {
    root.__solitudeRenderDebug = {
      hud: true,
      passes: { ...defaultRenderPassDebug },
      views: defaultViews,
    };
  } else {
    root.__solitudeRenderDebug.views = {
      ...defaultViews,
      ...root.__solitudeRenderDebug.views,
    };
    root.__solitudeRenderDebug.passes = {
      ...defaultRenderPassDebug,
      ...root.__solitudeRenderDebug.passes,
    };
    root.__solitudeRenderDebug.hud ??= true;
  }
  return root.__solitudeRenderDebug as RenderDebug;
}

function isViewEnabled(renderDebug: RenderDebug, viewId: string): boolean {
  return renderDebug.views[viewId] !== false;
}

function createOverlayFramePolicy(): FramePolicy {
  return {
    advancePresentation: true,
    advanceScene: true,
    advanceSim: true,
  };
}
