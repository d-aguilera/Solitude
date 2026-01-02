import { clear, draw } from "./draw.js";
import { fps } from "./fps.js";
import { vec } from "./math.js";
import { altitudeAboveSurface, planetCenter } from "./planet.js";
import { profile } from "./profilingFacade.js";
import {
  makePilotView,
  makeTopView,
  updateTopCameraFrame,
  type TopCameraFrameState,
} from "./projection.js";

import {
  planetGrid,
  sun,
  type Plane,
  type PilotState,
  type Camera,
  type SceneObject,
} from "./setup.js";

interface PilotViewState {
  plane: Plane;
  pilot: PilotState;
  airplanes: SceneObject[];
}

interface TopViewState {
  plane: Plane;
  topCamera: Camera;
  airplanes: SceneObject[];
}

// Keep this module responsible for rendering only; the caller provides
// all mutable state (plane, pilot, cameras, airplanes).
export function renderPilotView(
  ctxPilot: CanvasRenderingContext2D,
  state: PilotViewState
): void {
  clear(ctxPilot);

  const { plane, pilot, airplanes } = state;

  const projection = makePilotView({
    planePosition: { x: plane.x, y: plane.y, z: plane.z },
    planeOrientation: plane.orientation,
    pilotAzimuth: pilot.azimuth,
    pilotElevation: pilot.elevation,
  });

  draw(ctxPilot, planetGrid, {
    projection,
    cameraPos: { x: plane.x, y: plane.y, z: plane.z },
    lightDir: sun,
    profile,
  });
  draw(ctxPilot, airplanes, {
    projection,
    cameraPos: { x: plane.x, y: plane.y, z: plane.z },
    lightDir: sun,
    profile,
  });
}

let topCameraFrameState: TopCameraFrameState | null = null;

export function renderTopView(
  ctxTop: CanvasRenderingContext2D,
  state: TopViewState
): void {
  clear(ctxTop);

  const { plane, topCamera, airplanes } = state;

  const radial = vec.normalize({
    x: plane.x - planetCenter.x,
    y: plane.y - planetCenter.y,
    z: plane.z - planetCenter.z,
  });

  const distanceAbovePlane = 100;
  topCamera.x = plane.x + radial.x * distanceAbovePlane;
  topCamera.y = plane.y + radial.y * distanceAbovePlane;
  topCamera.z = plane.z + radial.z * distanceAbovePlane;

  const { orientation, state: nextState } = updateTopCameraFrame(
    radial,
    topCameraFrameState
  );
  topCameraFrameState = nextState;

  topCamera.orientation = orientation;

  const topCamPos = { x: topCamera.x, y: topCamera.y, z: topCamera.z };

  const projection = makeTopView({
    cameraPosition: topCamPos,
    cameraOrientation: topCamera.orientation,
  });

  draw(ctxTop, planetGrid, {
    projection,
    cameraPos: topCamPos,
    lightDir: sun,
    profile,
  });
  draw(ctxTop, airplanes, {
    projection,
    cameraPos: topCamPos,
    lightDir: sun,
    profile,
  });
}

export function renderHUD(
  ctxTop: CanvasRenderingContext2D,
  plane: Plane,
  profilingEnabled: boolean
): void {
  ctxTop.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctxTop.fillRect(0, 0, 360, 80);
  ctxTop.fillStyle = "white";
  ctxTop.font = "16px monospace";

  const alt = altitudeAboveSurface({ x: plane.x, y: plane.y, z: plane.z });
  ctxTop.fillText(`Alt: ${alt.toFixed(1)} m`, 10, 20);

  const speedKnots = plane.speed * 1.94384;
  ctxTop.fillText(
    `Spd: ${plane.speed.toFixed(1)} m/s (${speedKnots.toFixed(0)} kt)`,
    10,
    40
  );

  ctxTop.fillText(`FPS: ${fps.toFixed(1)}`, 200, 20);

  if (profilingEnabled) ctxTop.fillText("PROFILING", 250, 60);
}
