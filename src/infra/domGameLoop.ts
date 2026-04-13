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
import { computeShipOrbitReadout } from "../domain/orbit";
import { vec3 } from "../domain/vec3";
import {
  createRenderFrameCache,
  updateRenderFrameCache,
} from "../render/renderFrameCache";
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

type RenderDebug = {
  views: {
    pilot: boolean;
    top: boolean;
    left: boolean;
    right: boolean;
    rear: boolean;
  };
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
  views: {
    pilot: true,
    top: true,
    left: true,
    right: true,
    rear: true,
  },
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
  pilotViewRenderer,
  pilotRasterizer,
  topViewRenderer,
  topRasterizer,
  leftViewRenderer,
  leftRasterizer,
  rightViewRenderer,
  rightRasterizer,
  rearViewRenderer,
  rearRasterizer,
  hudRenderer,
  hudRasterizer,
  gravityEngine,
  pilotSurface,
  topSurface,
  leftSurface,
  rightSurface,
  rearSurface,
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
  const pilotViewId: SceneViewId = "pilot";
  const topViewId: SceneViewId = "top";
  const leftViewId: SceneViewId = "left";
  const rightViewId: SceneViewId = "right";
  const rearViewId: SceneViewId = "rear";
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
  const leftObjectsFilter = buildSceneObjectsFilter(scenePlugins, {
    viewId: leftViewId,
    scene,
    world: worldSetup.world,
    mainShip: worldSetup.mainShip,
    config,
  });
  const rightObjectsFilter = buildSceneObjectsFilter(scenePlugins, {
    viewId: rightViewId,
    scene,
    world: worldSetup.world,
    mainShip: worldSetup.mainShip,
    config,
  });
  const rearObjectsFilter = buildSceneObjectsFilter(scenePlugins, {
    viewId: rearViewId,
    scene,
    world: worldSetup.world,
    mainShip: worldSetup.mainShip,
    config,
  });
  const worldAndScene: WorldAndScene = {
    ...worldSetup,
    scene,
  };
  const pilotSegmentParams: SegmentProviderParams = {
    viewId: pilotViewId,
    scene: worldAndScene.scene,
    world: worldAndScene.world,
    mainShip: worldAndScene.mainShip,
    config,
  };
  const topSegmentParams: SegmentProviderParams = {
    viewId: topViewId,
    scene: worldAndScene.scene,
    world: worldAndScene.world,
    mainShip: worldAndScene.mainShip,
    config,
  };
  const leftSegmentParams: SegmentProviderParams = {
    viewId: leftViewId,
    scene: worldAndScene.scene,
    world: worldAndScene.world,
    mainShip: worldAndScene.mainShip,
    config,
  };
  const rightSegmentParams: SegmentProviderParams = {
    viewId: rightViewId,
    scene: worldAndScene.scene,
    world: worldAndScene.world,
    mainShip: worldAndScene.mainShip,
    config,
  };
  const rearSegmentParams: SegmentProviderParams = {
    viewId: rearViewId,
    scene: worldAndScene.scene,
    world: worldAndScene.world,
    mainShip: worldAndScene.mainShip,
    config,
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
    leftCameraOffset: config.render.leftCameraOffset,
    rightCameraOffset: config.render.rightCameraOffset,
    rearCameraOffset: config.render.rearCameraOffset,
  };

  const sceneState: SceneState = {
    pilotCamera: worldAndScene.pilotCamera,
    topCamera: worldAndScene.topCamera,
    leftCamera: worldAndScene.leftCamera,
    rightCamera: worldAndScene.rightCamera,
    rearCamera: worldAndScene.rearCamera,
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
  const pilotWorldSegments: WorldSegment[] = [];
  const topWorldSegments: WorldSegment[] = [];
  const leftWorldSegments: WorldSegment[] = [];
  const rightWorldSegments: WorldSegment[] = [];
  const rearWorldSegments: WorldSegment[] = [];

  const pilotViewRenderParams: ViewRenderParams = {
    camera: worldAndScene.pilotCamera,
    mainShip: worldAndScene.mainShip,
    objectsFilter: pilotObjectsFilter,
    renderCache,
    scene: worldAndScene.scene,
    surface: pilotSurface,
    worldSegments: pilotWorldSegments,
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
    objectsFilter: topObjectsFilter,
    renderCache,
    scene: worldAndScene.scene,
    surface: topSurface,
    worldSegments: topWorldSegments,
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

  const leftViewRenderParams: ViewRenderParams = {
    camera: worldAndScene.leftCamera,
    mainShip: worldAndScene.mainShip,
    objectsFilter: leftObjectsFilter,
    renderCache,
    scene: worldAndScene.scene,
    surface: leftSurface,
    worldSegments: leftWorldSegments,
  };

  const renderedLeftView: RenderedView = {
    bodyLabels: [],
    bodyLabelCount: 0,
    faces: [],
    faceCount: 0,
    polylines: [],
    polylineCount: 0,
    segments: [],
    segmentCount: 0,
  };

  const rightViewRenderParams: ViewRenderParams = {
    camera: worldAndScene.rightCamera,
    mainShip: worldAndScene.mainShip,
    objectsFilter: rightObjectsFilter,
    renderCache,
    scene: worldAndScene.scene,
    surface: rightSurface,
    worldSegments: rightWorldSegments,
  };

  const renderedRightView: RenderedView = {
    bodyLabels: [],
    bodyLabelCount: 0,
    faces: [],
    faceCount: 0,
    polylines: [],
    polylineCount: 0,
    segments: [],
    segmentCount: 0,
  };

  const rearViewRenderParams: ViewRenderParams = {
    camera: worldAndScene.rearCamera,
    mainShip: worldAndScene.mainShip,
    objectsFilter: rearObjectsFilter,
    renderCache,
    scene: worldAndScene.scene,
    surface: rearSurface,
    worldSegments: rearWorldSegments,
  };

  const renderedRearView: RenderedView = {
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
  let fps: number;
  let simTimeMillis = 0;
  const loopState: LoopState = {
    framePolicy: createDefaultFramePolicy(),
  };
  const loopUpdateParams: Parameters<
    NonNullable<LoopPlugin["updateLoopState"]>
  >[0] = {
    controlInput,
    dtMillis: 0,
    nowMs: 0,
    state: loopState,
  };
  const renderDebug = getRenderDebug();

  const loop = (nowMs: number) => {
    dtMillis = nowMs - lastTimeMs;
    lastTimeMs = nowMs;

    loopUpdateParams.dtMillis = dtMillis;
    loopUpdateParams.nowMs = nowMs;
    applyLoopPlugins(loopPlugins, loopUpdateParams);
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

    if (framePolicy.advanceSim || framePolicy.advanceScene) {
      updateRenderFrameCache(renderCache, worldAndScene.scene);
    }

    const { passes, views } = renderDebug;
    const facesBuild = passes.faces && passes.facesBuild;
    const facesRaster = passes.faces && passes.facesRaster;
    const facesSort = passes.faces && passes.facesSort;
    const polylines = passes.polylines;
    const segments = passes.segments;
    const bodyLabels = passes.bodyLabels;
    pilotViewRenderParams.renderFaces = facesBuild;
    pilotViewRenderParams.sortFaces = facesSort;
    pilotViewRenderParams.renderPolylines = polylines;
    pilotViewRenderParams.renderSegments = segments;
    pilotViewRenderParams.renderBodyLabels = bodyLabels;
    topViewRenderParams.renderFaces = facesBuild;
    topViewRenderParams.sortFaces = facesSort;
    topViewRenderParams.renderPolylines = polylines;
    topViewRenderParams.renderSegments = segments;
    topViewRenderParams.renderBodyLabels = bodyLabels;
    leftViewRenderParams.renderFaces = facesBuild;
    leftViewRenderParams.sortFaces = facesSort;
    leftViewRenderParams.renderPolylines = polylines;
    leftViewRenderParams.renderSegments = segments;
    leftViewRenderParams.renderBodyLabels = bodyLabels;
    rightViewRenderParams.renderFaces = facesBuild;
    rightViewRenderParams.sortFaces = facesSort;
    rightViewRenderParams.renderPolylines = polylines;
    rightViewRenderParams.renderSegments = segments;
    rightViewRenderParams.renderBodyLabels = bodyLabels;
    rearViewRenderParams.renderFaces = facesBuild;
    rearViewRenderParams.sortFaces = facesSort;
    rearViewRenderParams.renderPolylines = polylines;
    rearViewRenderParams.renderSegments = segments;
    rearViewRenderParams.renderBodyLabels = bodyLabels;

    if (views.pilot) {
      if (segments) {
        applySegmentPlugins(
          segmentPlugins,
          pilotWorldSegments,
          pilotSegmentParams,
        );
      } else {
        pilotWorldSegments.length = 0;
      }
      pilotViewRenderer.renderInto(renderedPilotView, pilotViewRenderParams);
    }

    if (views.top) {
      if (segments) {
        applySegmentPlugins(segmentPlugins, topWorldSegments, topSegmentParams);
      } else {
        topWorldSegments.length = 0;
      }
      topViewRenderer.renderInto(renderedTopView, topViewRenderParams);
    }

    if (views.left) {
      if (segments) {
        applySegmentPlugins(
          segmentPlugins,
          leftWorldSegments,
          leftSegmentParams,
        );
      } else {
        leftWorldSegments.length = 0;
      }
      leftViewRenderer.renderInto(renderedLeftView, leftViewRenderParams);
    }

    if (views.right) {
      if (segments) {
        applySegmentPlugins(
          segmentPlugins,
          rightWorldSegments,
          rightSegmentParams,
        );
      } else {
        rightWorldSegments.length = 0;
      }
      rightViewRenderer.renderInto(renderedRightView, rightViewRenderParams);
    }

    if (views.rear) {
      if (segments) {
        applySegmentPlugins(
          segmentPlugins,
          rearWorldSegments,
          rearSegmentParams,
        );
      } else {
        rearWorldSegments.length = 0;
      }
      rearViewRenderer.renderInto(renderedRearView, rearViewRenderParams);
    }

    fps = updateFps(dtMillis);

    const shouldRenderHud = nowMs - lastHudTimeMs > 100;

    if (shouldRenderHud && framePolicy.advanceHud && renderDebug.hud) {
      hudRenderParams.currentThrustLevel = tickOutput.currentThrustLevel;
      hudRenderParams.currentRcsLevel = tickOutput.currentRcsLevel;
      hudRenderParams.fps = fps;
      hudRenderParams.orbitReadout = computeShipOrbitReadout(
        worldAndScene.world,
        worldAndScene.mainShip,
      );
      hudRenderParams.pilotCameraLocalOffset =
        sceneControlState.pilotCameraOffset;
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

    if (views.pilot)
      rasterizeView(renderedPilotView, pilotRasterizer, facesRaster);
    if (views.top) rasterizeView(renderedTopView, topRasterizer, facesRaster);
    if (views.left)
      rasterizeView(renderedLeftView, leftRasterizer, facesRaster);
    if (views.right)
      rasterizeView(renderedRightView, rightRasterizer, facesRaster);
    if (views.rear)
      rasterizeView(renderedRearView, rearRasterizer, facesRaster);
    if (renderDebug.hud) rasterizeHud(renderedHud, hudRasterizer);
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
