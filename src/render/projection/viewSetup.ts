import { drawPlaneVelocityLine } from "../scene/debugDraw.js";
import {
  makePilotView,
  makeTopView,
  ScreenPoint,
} from "../projection/projection.js";
import type { Camera, WorldState, DrawMode, Vec3 } from "../../world/types.js";
import type { View } from "./viewTypes.js";

function makeBaseView(
  world: WorldState,
  camera: Camera,
  projection: (p: Vec3) => ScreenPoint | null,
  drawMode: DrawMode
): View {
  return {
    projection,
    cameraPos: camera.position,
    cameraFrame: camera.frame,
    drawMode,
    debugDraw: (ctx) => {
      for (const plane of world.planes) {
        drawPlaneVelocityLine(ctx, projection, plane);
      }
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

  return makeBaseView(world, pilotCamera, projection, drawMode);
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

  return makeBaseView(world, topCamera, projection, drawMode);
}
