import { drawPlaneVelocityLine, drawBodyLabels } from "../scene/debugDraw.js";
import {
  NdcPoint,
  worldPointToCameraPoint,
  applyPilotLook,
  projectCameraPointToNdc,
} from "../projection/projection.js";
import type {
  Camera,
  WorldState,
  DrawMode,
  Vec3,
  Plane,
} from "../../world/types.js";
import type { View, ViewDebugOverlay } from "./viewTypes.js";

const NEAR = 0.01; // must match projection.ts

function makeBaseView(
  camera: Camera,
  projection: (p: Vec3) => NdcPoint | null,
  drawMode: DrawMode
): View {
  return {
    projection,
    cameraPos: camera.position,
    cameraFrame: camera.frame,
    drawMode,
  };
}

/**
 * Build the default debug overlay used by pilot/top views:
 *  - Velocity lines for the chosen debug planes (typically all planes).
 *  - Planet/star labels for all relevant bodies in the scene, measured
 *    relative to the chosen referencePlane.
 *
 * Kept separate from `View` so that debug policy does not leak into
 * camera/projection setup.
 *
 * NOTE:
 *  The overlay takes an NDC projection; it is responsible for mapping NDC
 *  to pixel coordinates using the canvas it is drawing into.
 */
export function makeStandardViewDebugOverlay(options: {
  projection: (p: Vec3) => NdcPoint | null;
  referencePlane: Plane;
  debugPlanes: Plane[];
}): ViewDebugOverlay {
  const { projection, referencePlane, debugPlanes } = options;

  return {
    draw: (ctx, scene) => {
      // Velocity lines for the chosen debug planes (typically all planes).
      for (const plane of debugPlanes) {
        drawPlaneVelocityLine(ctx, projection, plane);
      }

      // Planet/star labels for all relevant bodies in the scene.
      drawBodyLabels(ctx, projection, scene, referencePlane);
    },
  };
}

/**
 * Build the View configuration for the pilot view, given world state.
 */
export function buildPilotViewConfig(
  world: WorldState,
  pilotCamera: Camera,
  mainPilotViewId: string,
  canvasWidth: number,
  canvasHeight: number,
  referencePlane: Plane,
  drawMode: DrawMode,
  debugPlanes: Plane[]
): { view: View; debugOverlay: ViewDebugOverlay } {
  const pilotView = world.pilotViews.find((p) => p.id === mainPilotViewId);
  if (!pilotView) throw new Error(`Pilot view not found: ${mainPilotViewId}`);

  const projection = (worldPoint: Vec3): NdcPoint | null => {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      pilotCamera.position,
      pilotCamera.frame
    );

    applyPilotLook(cameraPoint, pilotView.azimuth, pilotView.elevation);

    const depth = cameraPoint.y;
    if (depth < NEAR) return null;

    return projectCameraPointToNdc(cameraPoint, canvasWidth, canvasHeight);
  };

  const view = makeBaseView(pilotCamera, projection, drawMode);
  const debugOverlay = makeStandardViewDebugOverlay({
    projection,
    referencePlane,
    debugPlanes,
  });

  return { view, debugOverlay };
}

/**
 * Build the View configuration for the top-down view, given a camera.
 */
export function buildTopViewConfig(
  topCamera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  referencePlane: Plane,
  drawMode: DrawMode,
  debugPlanes: Plane[]
): { view: View; debugOverlay: ViewDebugOverlay } {
  const projection = (worldPoint: Vec3): NdcPoint | null => {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      topCamera.position,
      topCamera.frame
    );

    const depth = cameraPoint.y;
    if (depth < NEAR) return null;

    return projectCameraPointToNdc(cameraPoint, canvasWidth, canvasHeight);
  };

  const view = makeBaseView(topCamera, projection, drawMode);
  const debugOverlay = makeStandardViewDebugOverlay({
    projection,
    referencePlane,
    debugPlanes,
  });

  return { view, debugOverlay };
}
