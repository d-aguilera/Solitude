import { DomainCameraPose, Vec3, LocalFrame } from "../domain/domainPorts.js";
import { mat3FromLocalFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import { NdcPoint } from "../render/renderInternals.js";
import { DrawMode, View, ViewDebugOverlay } from "../render/renderPorts.js";
import { drawPlaneVelocityLine, drawBodyLabels } from "../scene/debugDraw.js";
import { NEAR, projectCameraPointToNdc } from "./projection.js";
import { DebugPlane } from "./projectionPorts.js";

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
function makeStandardViewDebugOverlay(options: {
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

/**
 * Pure: world-space -> camera-space.
 */
export function worldPointToCameraPoint(
  worldPoint: Vec3,
  cameraPosition: Vec3,
  cameraFrame: LocalFrame,
): Vec3 {
  const R_worldFromLocal = mat3FromLocalFrame(cameraFrame);
  const R_localFromWorld = mat3.transpose(R_worldFromLocal);
  const d = vec3.sub(worldPoint, cameraPosition);
  return mat3.mulVec3(R_localFromWorld, d);
}
