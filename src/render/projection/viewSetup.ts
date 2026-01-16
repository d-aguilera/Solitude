import { drawPlaneVelocityLine, drawBodyLabels } from "../scene/debugDraw.js";
import {
  worldPointToCameraPoint,
  projectCameraPointToNdc,
  NEAR,
} from "../projection/projection.js";
import { NdcPoint } from "./NdcPoint.js";
import type { CameraPose, Plane, Vec3 } from "../../domain/domainPorts.js";
import type { DrawMode, ViewDebugOverlay } from "./ViewDebugOverlay.js";
import type { View } from "./View.js";

function makeBaseView(
  camera: CameraPose,
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
 *
 * The pilot camera's LocalFrame is expected to already encode any pilot‑look
 * yaw/pitch adjustments. This function does not apply additional rotations.
 */
export function buildPilotViewConfig(
  pilotCamera: CameraPose,
  canvasWidth: number,
  canvasHeight: number,
  referencePlane: Plane,
  drawMode: DrawMode,
  debugPlanes: Plane[]
): { view: View; debugOverlay: ViewDebugOverlay } {
  const projection = (worldPoint: Vec3): NdcPoint | null => {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      pilotCamera.position,
      pilotCamera.frame
    );

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
  topCamera: CameraPose,
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
