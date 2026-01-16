import type { Plane, WorldState } from "./worldState.js";
import type { Scene, SceneObject } from "../render/scene/scenePorts.js";
import { getDomainCameraById } from "../domain/worldLookup.js";
import {
  buildPilotViewConfig,
  buildTopViewConfig,
} from "../render/projection/viewSetup.js";
import type { ViewConfig } from "./appPorts.js";
import { DrawMode } from "../render/projection/ViewDebugOverlay.js";

export function buildPilotView(
  world: WorldState,
  scene: Scene,
  pilotCameraId: string,
  referencePlane: Plane,
  drawMode: DrawMode,
  debugPlanes: Plane[],
  canvasWidth: number,
  canvasHeight: number,
): { viewConfig: ViewConfig; scene: Scene } {
  const pilotCamera = getDomainCameraById(world, pilotCameraId);
  const adjustedScene = makePilotViewScene(scene);

  const { view, debugOverlay } = buildPilotViewConfig(
    pilotCamera,
    canvasWidth,
    canvasHeight,
    referencePlane,
    drawMode,
    debugPlanes,
  );

  return {
    viewConfig: {
      view,
      debugOverlay,
      referencePlane,
      drawMode,
    },
    scene: adjustedScene,
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
  canvasHeight: number,
): { viewConfig: ViewConfig; scene: Scene } {
  const topCamera = getDomainCameraById(world, topCameraId);
  const adjustedScene = makeTopViewScene(scene);

  const { view, debugOverlay } = buildTopViewConfig(
    topCamera,
    canvasWidth,
    canvasHeight,
    referencePlane,
    drawMode,
    debugPlanes,
  );

  return {
    viewConfig: {
      view,
      debugOverlay,
      referencePlane,
      drawMode,
    },
    scene: adjustedScene,
  };
}

/**
 * Adjust the scene for the pilot view.
 */
function makePilotViewScene(base: Scene): Scene {
  return base;
}

/**
 * Adjust the scene for the top‑down view.
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
