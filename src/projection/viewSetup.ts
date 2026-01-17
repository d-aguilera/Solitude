import { DomainCameraPose, Vec3 } from "../domain/domainPorts.js";
import { NdcPoint } from "../render/renderInternals.js";
import { DrawMode, View, ViewDebugOverlay } from "../render/renderPorts.js";
import { drawPlaneVelocityLine, drawBodyLabels } from "../scene/debugDraw.js";
import {
  Camera,
  makeCamera,
  projectWorldPointToNdcWithCamera,
} from "../scene/camera.js";
import { DebugPlane } from "./projectionPorts.js";

function makeBaseView(
  cameraPose: DomainCameraPose,
  canvasWidth: number,
  canvasHeight: number,
  drawMode: DrawMode,
): View {
  const camera: Camera = makeCamera(
    cameraPose.position,
    cameraPose.frame,
    canvasWidth,
    canvasHeight,
  );

  const projection = (p: Vec3): NdcPoint | null => {
    return projectWorldPointToNdcWithCamera(p, camera);
  };

  return {
    camera,
    projection,
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
  const view = makeBaseView(pose, canvasWidth, canvasHeight, drawMode);
  const debugOverlay = makeStandardViewDebugOverlay({
    projection: view.projection,
    referencePlane,
  });

  return { view, debugOverlay };
}
