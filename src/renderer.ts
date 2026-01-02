import { clear, draw } from "./draw.js";
import { fps } from "./fps.js";
import { altitudeAboveSurface } from "./planet.js";
import { makePilotView, makeTopView } from "./projection.js";
import {
  Camera,
  InstrumentationAdapter,
  PilotState,
  Plane,
  Scene,
  SceneObject,
} from "./types.js";

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

export function renderPilotView(
  ctxPilot: CanvasRenderingContext2D,
  state: PilotViewState,
  scene: Scene,
  instrument: InstrumentationAdapter
): void {
  clear(ctxPilot);

  const { plane, pilot, airplanes } = state;

  const projection = makePilotView({
    planePosition: { x: plane.x, y: plane.y, z: plane.z },
    planeOrientation: plane.orientation,
    pilotAzimuth: pilot.azimuth,
    pilotElevation: pilot.elevation,
  });

  draw(ctxPilot, scene.planetGrid, {
    projection,
    cameraPos: { x: plane.x, y: plane.y, z: plane.z },
    lightDir: scene.sunDirection,
    instrument: instrument,
  });

  draw(ctxPilot, airplanes, {
    projection,
    cameraPos: { x: plane.x, y: plane.y, z: plane.z },
    lightDir: scene.sunDirection,
    instrument: instrument,
  });
}

export function renderTopView(
  ctxTop: CanvasRenderingContext2D,
  state: TopViewState,
  scene: Scene,
  instrument: InstrumentationAdapter
): void {
  clear(ctxTop);

  const { topCamera, airplanes } = state;

  // At this point, topCamera is already positioned and oriented by the caller.
  const cameraPosition = { x: topCamera.x, y: topCamera.y, z: topCamera.z };

  const projection = makeTopView({
    cameraPosition,
    cameraOrientation: topCamera.orientation,
  });

  draw(ctxTop, scene.planetGrid, {
    projection,
    cameraPos: cameraPosition,
    lightDir: scene.sunDirection,
    instrument: instrument,
  });

  draw(ctxTop, airplanes, {
    projection,
    cameraPos: cameraPosition,
    lightDir: scene.sunDirection,
    instrument: instrument,
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
