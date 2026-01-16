import { drawPlaneVelocityLine, drawBodyLabels } from "../scene/debugDraw.js";
import {
  worldPointToCameraPoint,
  projectCameraPointToNdc,
  NEAR,
} from "./projection.js";
import type { NdcPoint } from "./NdcPoint.js";
import type { DomainCameraPose, Vec3 } from "../../domain/domainPorts.js";
import type { DrawMode, ViewDebugOverlay } from "./ViewDebugOverlay.js";
import type { View } from "./View.js";

export interface DebugPlane {
  id: string;
  position: Vec3;
  velocity: Vec3;
}

function makeBaseView(
  camera: DomainCameraPose,
  projection: (p: Vec3) => NdcPoint | null,
  drawMode: DrawMode,
): View {
  return {
    projection,
    cameraPos: camera.position,
    cameraFrame: camera.frame,
    drawMode,
  };
}

/**
 * Build the default debug overlay used by pilot/top views.
 *
 * The overlay works with a minimal DebugPlane DTO so it does not depend
 * on any app-level world types.
 */
export function makeStandardViewDebugOverlay(options: {
  projection: (p: Vec3) => NdcPoint | null;
  referencePlane: DebugPlane;
  debugPlanes: DebugPlane[];
}): ViewDebugOverlay {
  const { projection, referencePlane, debugPlanes } = options;

  return {
    draw: (ctx, scene) => {
      for (const plane of debugPlanes) {
        drawPlaneVelocityLine(ctx, projection, plane);
      }

      drawBodyLabels(ctx, projection, scene, referencePlane);
    },
  };
}

export function buildPilotViewConfig(
  pilotCamera: DomainCameraPose,
  canvasWidth: number,
  canvasHeight: number,
  referencePlane: DebugPlane,
  drawMode: DrawMode,
  debugPlanes: DebugPlane[],
): { view: View; debugOverlay: ViewDebugOverlay } {
  const projection = (worldPoint: Vec3): NdcPoint | null => {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      pilotCamera.position,
      pilotCamera.frame,
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

export function buildTopViewConfig(
  topCamera: DomainCameraPose,
  canvasWidth: number,
  canvasHeight: number,
  referencePlane: DebugPlane,
  drawMode: DrawMode,
  debugPlanes: DebugPlane[],
): { view: View; debugOverlay: ViewDebugOverlay } {
  const projection = (worldPoint: Vec3): NdcPoint | null => {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      topCamera.position,
      topCamera.frame,
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
