import { makePilotView, makeTopView } from "./projection.js";
import { drawPlaneVelocityLine } from "./debugDraw.js";
import type { Camera, View, WorldState } from "./types.js";

/**
 * Build the View configuration for the pilot view, given world state.
 */
export function buildPilotViewConfig(
  world: WorldState,
  pilotCamera: Camera,
  mainPilotViewId: string
): View {
  const pilotView = world.pilotViews.find((p) => p.id === mainPilotViewId);
  if (!pilotView) {
    throw new Error(`Pilot view not found: ${mainPilotViewId}`);
  }

  const projection = makePilotView({
    cameraPosition: pilotCamera.position,
    cameraOrientation: pilotCamera.orientation,
    pilotAzimuth: pilotView.azimuth,
    pilotElevation: pilotView.elevation,
  });

  return {
    projection,
    cameraPos: pilotCamera.position,
    debugDraw: (ctx, project) => {
      for (const plane of world.planes) {
        drawPlaneVelocityLine(ctx, project, plane);
      }
    },
  };
}

/**
 * Build the View configuration for the top-down view, given world state.
 */
export function buildTopViewConfig(world: WorldState, topCamera: Camera): View {
  const projection = makeTopView({
    cameraPosition: topCamera.position,
    cameraOrientation: topCamera.orientation,
  });

  return {
    projection,
    cameraPos: topCamera.position,
    debugDraw: (ctx, project) => {
      for (const plane of world.planes) {
        drawPlaneVelocityLine(ctx, project, plane);
      }
    },
  };
}
