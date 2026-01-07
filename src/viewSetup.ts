import { drawPlaneVelocityLine } from "./debugDraw.js";
import { makePilotView, makeTopView } from "./projection.js";
import type { Camera, WorldState, DrawMode } from "./types.js";
import type { View } from "./viewTypes.js";

/**
 * Build the View configuration for the pilot view, given world state.
 */
export function buildPilotViewConfig(
  world: WorldState,
  pilotCamera: Camera,
  mainPilotViewId: string,
  canvasWidth: number,
  canvasHeight: number,
  drawMode: DrawMode
): View {
  const pilotView = world.pilotViews.find((p) => p.id === mainPilotViewId);
  if (!pilotView) throw new Error(`Pilot view not found: ${mainPilotViewId}`);

  const projection = makePilotView({
    cameraPosition: pilotCamera.position,
    cameraFrame: pilotCamera.frame,
    pilotAzimuth: pilotView.azimuth,
    pilotElevation: pilotView.elevation,
    canvasWidth,
    canvasHeight,
  });

  return {
    projection,
    cameraPos: pilotCamera.position,
    cameraFrame: pilotCamera.frame,
    drawMode,
    debugDraw: (ctx) => {
      for (const plane of world.planes) {
        drawPlaneVelocityLine(ctx, projection, plane);
      }
    },
  };
}

/**
 * Build the View configuration for the top-down view, given world state.
 */
export function buildTopViewConfig(
  world: WorldState,
  topCamera: Camera,
  canvasWidth: number,
  canvasHeight: number,
  drawMode: DrawMode
): View {
  const projection = makeTopView({
    cameraPosition: topCamera.position,
    cameraFrame: topCamera.frame,
    canvasWidth,
    canvasHeight,
  });

  return {
    projection,
    cameraPos: topCamera.position,
    cameraFrame: topCamera.frame,
    drawMode,
    debugDraw: (ctx) => {
      for (const plane of world.planes) {
        drawPlaneVelocityLine(ctx, projection, plane);
      }
    },
  };
}
