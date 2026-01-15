import type { Scene, WorldState, Plane, SceneObject } from "../world/types.js";
import { getCameraById } from "../world/worldLookup.js";
import {
  buildPilotViewConfig,
  buildTopViewConfig,
} from "../render/projection/viewSetup.js";
import type { ViewConfig } from "./viewConfig.js";
import { DrawMode } from "../render/projection/viewTypes.js";

/**
 * Filter the scene for the top‑down view (e.g., remove trajectory polylines).
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

export function buildPilotView(
  world: WorldState,
  pilotCameraId: string,
  referencePlane: Plane,
  drawMode: DrawMode,
  debugPlanes: Plane[],
  canvasWidth: number,
  canvasHeight: number
): ViewConfig {
  const pilotCamera = getCameraById(world, pilotCameraId);

  const { view, debugOverlay } = buildPilotViewConfig(
    pilotCamera,
    canvasWidth,
    canvasHeight,
    referencePlane,
    drawMode,
    debugPlanes
  );

  return {
    view,
    debugOverlay,
    referencePlane,
    drawMode,
  };
}

export function buildTopView(
  world: WorldState,
  scene: Scene,
  topCameraId: string,
  referencePlane: Plane,
  drawMode: DrawMode,
  debugPlanes: Plane[],
  canvasWidth: number,
  canvasHeight: number
): { viewConfig: ViewConfig; scene: Scene } {
  const topCamera = getCameraById(world, topCameraId);
  const filteredScene = makeTopViewScene(scene);

  const { view, debugOverlay } = buildTopViewConfig(
    topCamera,
    canvasWidth,
    canvasHeight,
    referencePlane,
    drawMode,
    debugPlanes
  );

  return {
    viewConfig: {
      view,
      debugOverlay,
      referencePlane,
      drawMode,
    },
    scene: filteredScene,
  };
}
