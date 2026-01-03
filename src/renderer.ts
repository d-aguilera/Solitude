import { clear, draw } from "./draw.js";
import { fps } from "./fps.js";
import { vec } from "./math.js";
import { makePilotView, makeTopView } from "./projection.js";
import {
  Camera,
  PilotState,
  Plane,
  Profiler,
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
  pilotContext: CanvasRenderingContext2D,
  state: PilotViewState,
  scene: Scene,
  profiler: Profiler
): void {
  clear(pilotContext);

  const { plane, pilot, airplanes } = state;

  const projection = makePilotView({
    planePosition: { x: plane.x, y: plane.y, z: plane.z },
    planeOrientation: plane.orientation,
    pilotAzimuth: pilot.azimuth,
    pilotElevation: pilot.elevation,
  });

  draw(pilotContext, scene.planetGrid, {
    projection,
    cameraPos: { x: plane.x, y: plane.y, z: plane.z },
    lightDir: scene.sunDirection,
    profiler,
  });

  draw(pilotContext, airplanes, {
    projection,
    cameraPos: { x: plane.x, y: plane.y, z: plane.z },
    lightDir: scene.sunDirection,
    profiler,
  });
}

export function renderTopView(
  topContext: CanvasRenderingContext2D,
  state: TopViewState,
  scene: Scene,
  profiler: Profiler
): void {
  clear(topContext);

  const { topCamera, airplanes } = state;

  const cameraPosition = { x: topCamera.x, y: topCamera.y, z: topCamera.z };

  const projection = makeTopView({
    cameraPosition,
    cameraOrientation: topCamera.orientation,
  });

  draw(topContext, scene.planetGrid, {
    projection,
    cameraPos: cameraPosition,
    lightDir: scene.sunDirection,
    profiler,
  });

  draw(topContext, airplanes, {
    projection,
    cameraPos: cameraPosition,
    lightDir: scene.sunDirection,
    profiler,
  });
}

export function renderHUD(
  topContext: CanvasRenderingContext2D,
  plane: Plane,
  profilingEnabled: boolean
): void {
  topContext.fillStyle = "rgba(0, 0, 0, 0.6)";
  topContext.fillRect(0, 0, 360, 80);
  topContext.fillStyle = "white";
  topContext.font = "16px monospace";

  const distFromOrigin = vec.length({ x: plane.x, y: plane.y, z: plane.z });
  topContext.fillText(`|pos|: ${distFromOrigin.toFixed(1)} m`, 10, 20);

  const speedKnots = plane.speed * 1.94384;
  topContext.fillText(
    `Spd: ${plane.speed.toFixed(1)} m/s (${speedKnots.toFixed(0)} kt)`,
    10,
    40
  );

  topContext.fillText(`FPS: ${fps.toFixed(1)}`, 200, 20);

  if (profilingEnabled) topContext.fillText("PROFILING", 250, 60);
}
