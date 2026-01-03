import { clear, draw } from "./draw.js";
import { fps } from "./fps.js";
import { vec } from "./math.js";
import { makePilotView, makeTopView } from "./projection.js";
import type { Plane, Profiler, Scene, WorldState } from "./types.js";

interface PilotViewRenderParams {
  scene: Scene;
  world: WorldState;
  pilotViewId: string;
  profiler: Profiler;
}

interface TopViewRenderParams {
  scene: Scene;
  world: WorldState;
  topCameraId: string;
  profiler: Profiler;
}

export function renderPilotView(
  pilotContext: CanvasRenderingContext2D,
  params: PilotViewRenderParams
): void {
  clear(pilotContext);

  const pilotView = params.world.pilotViews.find(
    (p) => p.id === params.pilotViewId
  );
  if (!pilotView) return;

  const plane = params.world.planes.find((p) => p.id === pilotView.planeId);
  if (!plane) return;

  const projection = makePilotView({
    planePosition: { ...plane.position },
    planeOrientation: plane.orientation,
    pilotAzimuth: pilotView.azimuth,
    pilotElevation: pilotView.elevation,
  });

  draw(pilotContext, {
    objects: params.scene.objects,
    projection,
    cameraPos: { ...plane.position },
    lightDir: params.scene.sunDirection,
    profiler: params.profiler,
  });
}

export function renderTopView(
  topContext: CanvasRenderingContext2D,
  params: TopViewRenderParams
): void {
  clear(topContext);

  const camera = params.world.cameras.find((c) => c.id === params.topCameraId);
  if (!camera) return;

  const cameraPosition = { ...camera.position };

  const projection = makeTopView({
    cameraPosition,
    cameraOrientation: camera.orientation,
  });

  draw(topContext, {
    objects: params.scene.objects,
    projection,
    cameraPos: cameraPosition,
    lightDir: params.scene.sunDirection,
    profiler: params.profiler,
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

  const distFromOrigin = vec.length(plane.position);
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
