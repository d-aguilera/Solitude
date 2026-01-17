import { DomainCameraPose, Vec3 } from "../domain/domainPorts.js";
import { NdcPoint } from "../render/renderInternals.js";
import { DrawMode, View, ViewDebugOverlay } from "../render/renderPorts.js";
import { drawPlaneVelocityLine, drawBodyLabels } from "../scene/debugDraw.js";
import { worldPointToCameraPoint, NEAR } from "../scene/camera.js";
import { projectCameraPointToNdc } from "./projection.js";
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
  const projection = (worldPoint: Vec3): NdcPoint | null => {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      pose.position,
      pose.frame,
    );
    const depth = cameraPoint.y;
    if (depth < NEAR) return null;
    return projectCameraPointToNdc(cameraPoint, canvasWidth, canvasHeight);
  };
  const view = makeBaseView(pose, projection, drawMode);
  const debugOverlay = makeStandardViewDebugOverlay({
    projection,
    referencePlane,
  });

  return { view, debugOverlay };
}
