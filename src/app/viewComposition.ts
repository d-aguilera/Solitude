import { getDomainCameraById } from "../domain/worldLookup.js";
import type { DebugPlane } from "../projection/projectionPorts.js";
import { buildViewConfig } from "../projection/viewSetup.js";
import type {
  RenderPlane,
  DrawMode,
  ViewConfig,
} from "../render/renderPorts.js";
import type { Scene } from "../render/scenePorts.js";
import type { Plane, AppWorld } from "./appInternals.js";

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
  world: AppWorld,
  scene: Scene,
  pilotCameraId: string,
  referencePlane: Plane,
  drawMode: DrawMode,
  canvasWidth: number,
  canvasHeight: number,
): { viewConfig: ViewConfig; scene: Scene } {
  const pilotCamera = getDomainCameraById(world, pilotCameraId);
  const adjustedScene = makePilotViewScene(scene);
  const refDebug = toDebugPlane(referencePlane);

  const { view, debugOverlay } = buildViewConfig(
    pilotCamera,
    canvasWidth,
    canvasHeight,
    refDebug,
    drawMode,
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
  world: AppWorld,
  scene: Scene,
  topCameraId: string,
  referencePlane: Plane,
  drawMode: DrawMode,
  canvasWidth: number,
  canvasHeight: number,
): { viewConfig: ViewConfig; scene: Scene } {
  const topCamera = getDomainCameraById(world, topCameraId);
  const adjustedScene = makeTopViewScene(scene);
  const refDebug = toDebugPlane(referencePlane);

  const { view, debugOverlay } = buildViewConfig(
    topCamera,
    canvasWidth,
    canvasHeight,
    refDebug,
    drawMode,
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
