import type { FramePolicy } from "@solitude/engine/plugin";
import type { RenderedView, ViewRenderParams } from "@solitude/engine/render";
import type { SceneOverlayRasterizer } from "@solitude/engine/render/ports";
import type { GamePipelineView, WorldAndScene } from "@solitude/engine/runtime";
import {
  createConfiguredGamePipeline,
  profiler,
} from "@solitude/engine/runtime";
import { startAnimationLoop, type AnimationLoopState } from "./animationLoop";
import type { RunLoopParams, RunLoopView } from "./infraPorts";
import {
  applyBrowserOverlayProviders,
  collectBrowserOverlayProviders,
  type BrowserOverlayContext,
  type OverlayRasterizer,
} from "./overlayPorts";
import {
  collectPresentationFrameProviders,
  updatePresentationFrameProviders,
} from "./presentationFrame";

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
  onError,
  views,
  controlInput,
  plugins,
}: RunLoopParams): { dispose: () => void } {
  const pipeline = createConfiguredGamePipeline({
    config,
    controlInput,
    plugins,
    viewDefinitions: views.map((view) => view.definition),
  });
  try {
    const worldAndScene = pipeline.worldAndScene;
    const loopViews = createLoopViews(views, pipeline.views, worldAndScene);
    const primaryOverlayRasterizer = getPrimaryOverlayRasterizer(loopViews);
    const overlayProviders = collectBrowserOverlayProviders(
      pipeline.capabilityRegistry,
    );
    const presentationFrameProviders = collectPresentationFrameProviders(
      pipeline.capabilityRegistry,
    );
    const presentationFrameContext = { dtMillis: 0, nowMs: 0 };
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
    let lastOverlayTimeMs: number | null = null;

    const animation = startAnimationLoop((nowMs, dtMillis, state) => {
      if (lastOverlayTimeMs === null) lastOverlayTimeMs = nowMs;
      presentationFrameContext.dtMillis = dtMillis;
      presentationFrameContext.nowMs = nowMs;
      updatePresentationFrameProviders(
        presentationFrameProviders,
        presentationFrameContext,
      );
      if (!state.running) return;
      const frame = pipeline.beginFrame(nowMs, dtMillis);
      if (!state.running) return;
      primaryOverlayRasterizer?.beginFrame();
      renderViews(loopViews, pipeline.prepareView, renderDebug, state);
      if (!state.running) return;

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
      if (state.running) pipeline.endFrame();
    }, onError);
    return {
      dispose: combineLoopDisposal(animation.dispose, pipeline.dispose),
    };
  } catch (error) {
    pipeline.dispose();
    throw error;
  }
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
        sceneLabelCandidateCount: pipelineView.sceneLabelCandidateCount,
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
  state: AnimationLoopState,
): void {
  for (const view of views) {
    if (!state.running) return;
    if (!isViewEnabled(debug, view.definition.id)) continue;
    const passes = debug.passes;
    prepareView(view.pipelineView, passes.sceneLabels, passes.segments);
    if (!state.running) return;
    view.renderParams.renderPolylines = passes.polylines;
    view.renderParams.renderSceneLabels = passes.sceneLabels;
    view.renderParams.renderSegments = passes.segments;
    view.renderParams.sceneLabelCandidateCount =
      view.pipelineView.sceneLabelCandidateCount;
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

function combineLoopDisposal(
  stop: () => void,
  cleanup: () => void,
): () => void {
  let dispose: (() => void) | null = cleanup;
  return () => {
    stop();
    const pending = dispose;
    dispose = null;
    pending?.();
  };
}
