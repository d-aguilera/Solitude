import type { WorldState, Plane } from "./worldState.js";
import { getDomainCameraById } from "../domain/worldLookup.js";
import {
  buildPilotViewConfig,
  buildTopViewConfig,
} from "../render/projection/viewSetup.js";
import type { DebugPlane } from "../render/projection/projectionPorts.js";
import type {
  ViewConfig as RenderViewConfig,
  RenderPlane,
} from "../render/renderPorts.js";
import type { DrawMode } from "../render/renderPorts.js";
import type { Scene } from "../render/scenePorts.js";

/**
 * Convert an app-layer Plane into the minimal RenderPlane DTO.
 */
function toRenderPlane(plane: Plane): RenderPlane {
  return {
    id: plane.id,
    position: plane.position,
    velocity: plane.velocity,
  };
}

function toDebugPlane(plane: Plane): DebugPlane {
  return {
    id: plane.id,
    position: plane.position,
    velocity: plane.velocity,
  };
}

export function buildPilotView(
  world: WorldState,
  scene: Scene,
  pilotCameraId: string,
  referencePlane: Plane,
  drawMode: DrawMode,
  debugPlanes: Plane[],
  canvasWidth: number,
  canvasHeight: number,
): { viewConfig: RenderViewConfig; scene: Scene } {
  const pilotCamera = getDomainCameraById(world, pilotCameraId);
  const adjustedScene = makePilotViewScene(scene);

  const refDebug = toDebugPlane(referencePlane);
  const debugDebugPlanes = debugPlanes.map(toDebugPlane);

  const { view, debugOverlay } = buildPilotViewConfig(
    pilotCamera,
    canvasWidth,
    canvasHeight,
    refDebug,
    drawMode,
    debugDebugPlanes,
  );

  return {
    viewConfig: {
      view,
      debugOverlay,
      referencePlane: toRenderPlane(referencePlane),
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
): { viewConfig: RenderViewConfig; scene: Scene } {
  const topCamera = getDomainCameraById(world, topCameraId);
  const adjustedScene = makeTopViewScene(scene);

  const refDebug = toDebugPlane(referencePlane);
  const debugDebugPlanes = debugPlanes.map(toDebugPlane);

  const { view, debugOverlay } = buildTopViewConfig(
    topCamera,
    canvasWidth,
    canvasHeight,
    refDebug,
    drawMode,
    debugDebugPlanes,
  );

  return {
    viewConfig: {
      view,
      debugOverlay,
      referencePlane: toRenderPlane(referencePlane),
      drawMode,
    },
    scene: adjustedScene,
  };
}

function makePilotViewScene(base: Scene): Scene {
  return base;
}

function makeTopViewScene(base: Scene): Scene {
  const filteredObjects = base.objects.filter((obj) => {
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
