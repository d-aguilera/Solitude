import { getDomainCameraById } from "../domain/worldLookup.js";
import type { DebugPlane } from "../projection/projectionPorts.js";
import { buildViewConfig } from "../projection/viewSetup.js";
import type { RenderPlane, ViewConfig } from "../render/renderPorts.js";
import type { DrawMode } from "./appPorts.js";
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

/**
 * Build the pilot view configuration for the given camera and reference plane.
 */
export function buildPilotView(
  world: AppWorld,
  cameraId: string,
  referencePlane: Plane,
  drawMode: DrawMode,
  canvasWidth: number,
  canvasHeight: number,
): ViewConfig {
  const camera = getDomainCameraById(world, cameraId);
  const plane = toDebugPlane(referencePlane);

  const { view, debugOverlay } = buildViewConfig(
    camera,
    canvasWidth,
    canvasHeight,
    plane,
    drawMode,
  );

  return {
    view,
    debugOverlay,
    referencePlane: toRenderPlane(referencePlane),
    drawMode,
  };
}

/**
 * Build the top view configuration for the given camera and reference plane.
 */
export function buildTopView(
  world: AppWorld,
  cameraId: string,
  referencePlane: Plane,
  drawMode: DrawMode,
  canvasWidth: number,
  canvasHeight: number,
): ViewConfig {
  const camera = getDomainCameraById(world, cameraId);
  const plane = toDebugPlane(referencePlane);

  const { view, debugOverlay } = buildViewConfig(
    camera,
    canvasWidth,
    canvasHeight,
    plane,
    drawMode,
  );

  return {
    view,
    debugOverlay,
    referencePlane: toRenderPlane(referencePlane),
    drawMode,
  };
}
