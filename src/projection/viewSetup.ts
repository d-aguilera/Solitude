import type { DrawMode } from "../app/appPorts.js";
import type { DomainCameraPose, Vec3 } from "../domain/domainPorts.js";
import type { View, ViewDebugOverlay } from "../render/renderPorts.js";
import type { Camera } from "../scene/camera.js";
import {
  projectCameraPointToNdc,
  worldPointToCameraPoint,
} from "../scene/camera.js";
import type { NdcPoint } from "../scene/scenePorts.js";
import { drawPlaneVelocityLine, drawBodyLabels } from "./debugDraw.js";
import type { DebugPlane } from "./projectionPorts.js";

/**
 * Build the default debug overlay used by pilot/top views.
 *
 * The overlay works with a minimal DebugPlane DTO so it does not depend
 * on any app-level world types.
 */
function makeStandardViewDebugOverlay(options: {
  projection: (p: Vec3) => NdcPoint | null;
  referencePlane: DebugPlane;
}): ViewDebugOverlay {
  const { projection, referencePlane } = options;

  return {
    draw: (ctx, scene) => {
      drawPlaneVelocityLine(ctx, projection, referencePlane);
      drawBodyLabels(ctx, projection, scene, referencePlane.position);
    },
  };
}

export function buildViewConfig(
  pose: DomainCameraPose,
  canvasWidth: number,
  canvasHeight: number,
  referencePlane: DebugPlane,
  drawMode: DrawMode,
): { view: View; debugOverlay: ViewDebugOverlay } {
  const camera: Camera = {
    position: pose.position,
    frame: pose.frame,
  };

  const projection = (p: Vec3): NdcPoint | null => {
    return projectWorldPointToNdc(p, camera, canvasWidth, canvasHeight);
  };

  const view: View = {
    camera,
    projection,
    drawMode,
  };

  const debugOverlay = makeStandardViewDebugOverlay({
    projection,
    referencePlane,
  });

  return { view, debugOverlay };
}

/**
 * Full world-space -> NDC projection with near-plane rejection,
 * parameterized by pose and canvas size.
 *
 * Returns null when the point lies behind the near plane in camera space.
 */
function projectWorldPointToNdc(
  worldPoint: Vec3,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number,
): NdcPoint | null {
  const cameraPoint: Vec3 | null = worldPointToCameraPoint(
    worldPoint,
    camera.position,
    camera.frame,
  );
  return cameraPoint === null
    ? null
    : projectCameraPointToNdc(cameraPoint, canvasWidth, canvasHeight);
}
