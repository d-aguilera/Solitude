import { clear, draw } from "../scene/renderScene.js";
import type {
  Scene,
  Profiler,
  WorldState,
  Plane,
  Vec3,
} from "../../world/types.js";
import type { View, ViewDebugOverlay } from "./viewTypes.js";
import { buildPilotViewConfig, buildTopViewConfig } from "./viewSetup.js";
import { getCameraById } from "../../world/worldLookup.js";
import type { DrawMode, SceneObject } from "../../world/types.js";

let viewFrameCounter = 0;

/**
 * Render a scene from a given view.
 *
 * Responsibilities:
 *  - Clear the canvas
 *  - Rasterize all scene objects according to the view's camera/projection
 *  - Optionally render a debug overlay
 *
 * Any higher-level policy about which entities are debugged is kept
 * outside this function and provided via ViewDebugOverlay.
 */
export function renderView(
  context: CanvasRenderingContext2D,
  scene: Scene,
  view: View,
  profiler: Profiler,
  debugOverlay?: ViewDebugOverlay
): void {
  const frameId = ++viewFrameCounter;

  clear(context);
  draw(context, {
    objects: scene.objects,
    view,
    lights: scene.lights,
    profiler,
    frameId,
  });

  if (debugOverlay) {
    debugOverlay.draw(context, scene);
  }
}

/**
 * Helper that builds and renders the pilot view.
 *
 * The camera frame is expected to already encode any pilot look
 * adjustments computed elsewhere.
 */
export function renderPilotView(
  context: CanvasRenderingContext2D,
  scene: Scene,
  world: WorldState,
  pilotCameraId: string,
  referencePlane: Plane,
  drawMode: DrawMode,
  debugPlanes: Plane[],
  profiler: Profiler,
  pilotCameraLocalOffset: Vec3,
  thrustPercent: number
): void {
  void pilotCameraLocalOffset;
  void thrustPercent;

  const pilotCamera = getCameraById(world, pilotCameraId);
  const pilotCanvas = context.canvas;

  const { view, debugOverlay } = buildPilotViewConfig(
    pilotCamera,
    pilotCanvas.width,
    pilotCanvas.height,
    referencePlane,
    drawMode,
    debugPlanes
  );

  renderView(context, scene, view, profiler, debugOverlay);
}

/**
 * Helper that builds and renders the top-down view.
 *
 * Scene filtering for this view (e.g., removing trajectory polylines)
 * is handled here before draw() is called.
 */
export function renderTopView(
  context: CanvasRenderingContext2D,
  scene: Scene,
  world: WorldState,
  topCameraId: string,
  referencePlane: Plane,
  drawMode: DrawMode,
  debugPlanes: Plane[],
  profiler: Profiler
): void {
  const topCamera = getCameraById(world, topCameraId);
  const topCanvas = context.canvas;

  const filteredScene = makeTopViewScene(scene);

  const { view, debugOverlay } = buildTopViewConfig(
    topCamera,
    topCanvas.width,
    topCanvas.height,
    referencePlane,
    drawMode,
    debugPlanes
  );

  renderView(context, filteredScene, view, profiler, debugOverlay);
}

/**
 * Filter the scene for the top-down view.
 * Currently removes all polyline path objects (plane + planets).
 */
function makeTopViewScene(base: Scene): Scene {
  const filteredObjects: SceneObject[] = base.objects.filter((obj) => {
    if (obj.kind === "polyline" && obj.id.startsWith("path:")) {
      return false;
    }
    return true;
  });

  return {
    objects: filteredObjects,
    lights: base.lights,
  };
}
