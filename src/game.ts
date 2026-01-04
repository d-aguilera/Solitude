import { ControlInput, updatePhysics, type FlightContext } from "./controls.js";
import {
  getProfilingEnabledFromEnv,
  setProfilingEnabledInEnv,
} from "./debugEnv.js";
import { updateFPS } from "./fps.js";
import { renderHUD } from "./hud.js";
import { init as initInput, getKeyState } from "./input.js";
import { vec } from "./math.js";
import { pauseControl, paused } from "./pause.js";
import { appendPointToPolylineMesh } from "./planet.js";
import {
  isProfilingEnabled,
  profileCheck,
  profileFlush,
  setPausedForProfiling,
  setProfilingEnabled,
} from "./profilingFacade.js";
import {
  makePilotView,
  makeTopView,
  updateTopCameraFrame,
  type TopCameraFrameState,
} from "./projection.js";
import { createInitialSceneAndWorld } from "./setup.js";
import type {
  Camera,
  Plane,
  Profiler,
  View,
  WorldState,
  GravityState,
  Vec3,
} from "./types.js";
import { renderView } from "./viewRenderer.js";
import { ensureGravityState, applyGravityAndThrust } from "./gravity.js";

let lastTimeMs = 0;
let oKeyDown = false;

let topCameraFrameState: TopCameraFrameState | null = null;

const {
  scene: scene,
  world: world,
  mainPlaneId: mainPlaneId,
  mainPilotViewId: mainPilotViewId,
  topCameraId: topCameraId,
  pilotCameraId,
} = createInitialSceneAndWorld();

// Gravity state
let gravityState: GravityState | null = null;

export function startGame(
  pilotContext: CanvasRenderingContext2D,
  topContext: CanvasRenderingContext2D,
  profiler: Profiler
): void {
  initInput();
  requestAnimationFrame((nowMs) => {
    lastTimeMs = nowMs;
    requestAnimationFrame(
      renderFrame.bind(null, pilotContext, topContext, profiler)
    );
  });
}

// Draw velocity direction for a single plane in a given view
function drawPlaneVelocityLine(
  ctx: CanvasRenderingContext2D,
  project: (p: Vec3) => { x: number; y: number; depth?: number } | null,
  plane: Plane
): void {
  const v = plane.velocity;
  const speed = Math.hypot(v.x, v.y, v.z);
  if (speed === 0) return;

  // Unit direction of motion
  const dir = { x: v.x / speed, y: v.y / speed, z: v.z / speed };

  const center = plane.position;

  // Total segment length in world units, symmetric around plane center
  const len = 5000; // meters

  // Radius of the "transparent sphere" around the plane where we don't draw
  const innerRadius = 8; // meters

  // If the segment would be fully inside the sphere, don't draw anything
  if (len <= innerRadius) return;

  // World-space points:
  //  - forwardInner: where drawing starts in the +velocity direction
  //  - forwardEnd:   far end in +velocity direction
  //  - backwardInner:where drawing starts in the -velocity direction
  //  - backwardEnd:  far end in -velocity direction
  const forwardInner = {
    x: center.x + dir.x * innerRadius,
    y: center.y + dir.y * innerRadius,
    z: center.z + dir.z * innerRadius,
  };
  const forwardEnd = {
    x: center.x + dir.x * len,
    y: center.y + dir.y * len,
    z: center.z + dir.z * len,
  };

  const backwardInner = {
    x: center.x - dir.x * innerRadius,
    y: center.y - dir.y * innerRadius,
    z: center.z - dir.z * innerRadius,
  };
  const backwardEnd = {
    x: center.x - dir.x * len,
    y: center.y - dir.y * len,
    z: center.z - dir.z * len,
  };

  const pForwardInner = project(forwardInner);
  const pForwardEnd = project(forwardEnd);
  const pBackwardInner = project(backwardInner);
  const pBackwardEnd = project(backwardEnd);

  ctx.save();
  ctx.lineWidth = 4;

  // Green: direction of motion (outside the innerRadius sphere)
  if (pForwardInner && pForwardEnd) {
    ctx.strokeStyle = "lime";
    ctx.beginPath();
    ctx.moveTo(pForwardInner.x, pForwardInner.y);
    ctx.lineTo(pForwardEnd.x, pForwardEnd.y);
    ctx.stroke();
  }

  // Red: opposite direction of motion (outside the innerRadius sphere)
  if (pBackwardInner && pBackwardEnd) {
    ctx.strokeStyle = "red";
    ctx.beginPath();
    ctx.moveTo(pBackwardInner.x, pBackwardInner.y);
    ctx.lineTo(pBackwardEnd.x, pBackwardEnd.y);
    ctx.stroke();
  }

  ctx.restore();
}

function renderFrame(
  pilotContext: CanvasRenderingContext2D,
  topContext: CanvasRenderingContext2D,
  profiler: Profiler,
  nowMs: number
): void {
  const dtMs = nowMs - lastTimeMs;
  lastTimeMs = nowMs;

  const dtSeconds = paused ? 0 : dtMs / 1000;

  const keys = getKeyState();

  pauseControl(keys.KeyP);
  handleProfilingToggle(keys.KeyO);

  const input = makeControlInput(keys);

  setPausedForProfiling(paused);
  profileCheck();

  profiler.run("GAME", "total", () => {
    updateFPS(nowMs);

    profiler.run("GAME", "physics", () => {
      const flightCtx: FlightContext = {
        world,
        controlledPlaneId: mainPlaneId,
        pilotViewId: mainPilotViewId,
      };
      updatePhysics(dtSeconds, input, flightCtx);

      gravityState = ensureGravityState(world, scene, gravityState);

      // Simulate gravity at an accelerated timescale so orbits evolve faster.
      const gravityTimeScale = 10; // e.g. 10x real time

      applyGravityAndThrust(
        dtSeconds * gravityTimeScale,
        world,
        scene,
        gravityState,
        mainPlaneId,
        input.burn
      );
    });

    syncPlanesToSceneObjects();

    appendPlaneTrajectoryPoint();
    appendPlanetTrajectories();

    const mainPlane = getPlane(world, mainPlaneId);

    profiler.run("GAME", "pilot-view", () => {
      updatePilotCamera(mainPlane);
      renderPilotView(pilotContext, profiler);
    });

    profiler.run("GAME", "top-view", () => {
      updateTopCamera();
      renderTopView(topContext, profiler);
    });

    profiler.run("GAME", "hud", () => {
      renderHUD(topContext, mainPlane, isProfilingEnabled());
    });
  });

  profileFlush();

  requestAnimationFrame(
    renderFrame.bind(null, pilotContext, topContext, profiler)
  );
}

function handleProfilingToggle(oKeyPressed: boolean): void {
  if (oKeyPressed) {
    if (!oKeyDown) {
      const current = getProfilingEnabledFromEnv();
      const next = !current;
      setProfilingEnabled(next);
      setProfilingEnabledInEnv(next);
      oKeyDown = true;
    }
  } else if (oKeyDown) {
    oKeyDown = false;
  }
}

function updateTopCamera(): void {
  const plane = getPlane(world, mainPlaneId);
  const camera = getTopCamera(world);

  const radial = vec.normalize(plane.up);

  const distanceAbovePlane = 50;
  const camPos = camera.position;
  const planePos = plane.position;
  camPos.x = planePos.x + radial.x * distanceAbovePlane;
  camPos.y = planePos.y + radial.y * distanceAbovePlane;
  camPos.z = planePos.z + radial.z * distanceAbovePlane;

  const { orientation, state: nextState } = updateTopCameraFrame(
    radial,
    topCameraFrameState
  );
  topCameraFrameState = nextState;

  camera.orientation = orientation;
}

// Keep visual representation in sync with simulated plane state.
function syncPlanesToSceneObjects(): void {
  world.planes.forEach((p) => {
    const obj = scene.objects.find(
      (o) => o.mesh.objectType === "plane" && o.scale === p.scale
    );
    if (!obj) return;

    obj.position = { ...p.position };
    obj.orientation = p.orientation;
    obj.scale = p.scale;
  });
}

function renderPilotView(
  pilotContext: CanvasRenderingContext2D,
  profiler: Profiler
) {
  const pilotView = world.pilotViews.find((p) => p.id === mainPilotViewId);
  if (!pilotView) return;

  const pilotCamera = getPilotCamera(world);

  const projection = makePilotView({
    cameraPosition: pilotCamera.position,
    cameraOrientation: pilotCamera.orientation,
    pilotAzimuth: pilotView.azimuth,
    pilotElevation: pilotView.elevation,
  });

  const pilotViewConfig: View = {
    projection,
    cameraPos: pilotCamera.position,
    debugDraw: (ctx, project) => {
      for (const plane of world.planes) {
        drawPlaneVelocityLine(ctx, project, plane);
      }
    },
  };

  renderView(pilotContext, scene, pilotViewConfig, profiler);
}

function renderTopView(
  topContext: CanvasRenderingContext2D,
  profiler: Profiler
) {
  const camera = getTopCamera(world);

  const projection = makeTopView({
    cameraPosition: camera.position,
    cameraOrientation: camera.orientation,
  });

  const topViewConfig: View = {
    projection,
    cameraPos: camera.position,
    debugDraw: (ctx, project) => {
      for (const plane of world.planes) {
        drawPlaneVelocityLine(ctx, project, plane);
      }
    },
  };

  renderView(topContext, scene, topViewConfig, profiler);
}

function makeControlInput(keys: ReturnType<typeof getKeyState>): ControlInput {
  return {
    rollLeft: keys.KeyA,
    rollRight: keys.KeyD,
    pitchUp: keys.KeyW,
    pitchDown: keys.KeyS,
    yawLeft: keys.KeyQ,
    yawRight: keys.KeyE,
    lookLeft: keys.ArrowLeft,
    lookRight: keys.ArrowRight,
    lookUp: keys.ArrowUp,
    lookDown: keys.ArrowDown,
    resetView: keys.Digit0,
    burn: keys.Space,
  };
}

function getTopCamera(world: WorldState): Camera {
  const camera = world.cameras.find((c) => c.id === topCameraId);
  if (!camera) {
    throw new Error(`Top camera not found: ${topCameraId}`);
  }
  return camera;
}

function getPlane(world: WorldState, id: string): Plane {
  const plane = world.planes.find((p) => p.id === id);
  if (!plane) {
    throw new Error(`Plane not found: ${id}`);
  }
  return plane;
}

function getPilotCamera(world: WorldState): Camera {
  const camera = world.cameras.find((c) => c.id === pilotCameraId);
  if (!camera) {
    throw new Error(`Pilot camera not found: ${pilotCameraId}`);
  }
  return camera;
}

// Follow-plane logic for pilot camera, using an offset
function updatePilotCamera(plane: Plane): void {
  const camera = getPilotCamera(world);

  // Offsets in plane-local space:
  const backwardOffset = -20.0; // behind
  const upwardOffset = 5.0; // above

  const forward = plane.forward;
  const up = plane.up;

  const planePos = plane.position;

  // Position camera relative to plane
  camera.position.x =
    planePos.x + forward.x * backwardOffset + up.x * upwardOffset;
  camera.position.y =
    planePos.y + forward.y * backwardOffset + up.y * upwardOffset;
  camera.position.z =
    planePos.z + forward.z * backwardOffset + up.z * upwardOffset;

  // Make camera orientation match plane orientation (so it looks forward)
  camera.orientation = plane.orientation;
}

function appendPlaneTrajectoryPoint(): void {
  const mainPlane = getPlane(world, mainPlaneId);

  const pathObj = scene.objects.find((o) => o.id === "path:plane:main");
  if (!pathObj) return;

  const mesh = pathObj.mesh;

  // Work directly on mesh.points / mesh.faces
  const lastPoint = mesh.points[mesh.points.length - 1];
  const currentPos = mainPlane.position;

  // Only add a point if we've moved some minimal distance
  const minSegmentLength = 100; // meters, tune as needed
  if (
    lastPoint &&
    Math.hypot(
      currentPos.x - lastPoint.x,
      currentPos.y - lastPoint.y,
      currentPos.z - lastPoint.z
    ) < minSegmentLength
  ) {
    return;
  }

  const newIndex = mesh.points.length;
  mesh.points.push({ ...currentPos });

  if (newIndex > 0) {
    // Connect previous point to this one
    mesh.faces.push([newIndex - 1, newIndex]);
  }
}

function appendPlanetTrajectories(): void {
  const minSegmentLength = 1000; // meters; tune per your scale

  const earthObj = scene.objects.find((o) => o.id === "planet:earth");
  const earthPath = scene.objects.find((o) => o.id === "path:planet:earth");
  if (earthObj && earthPath) {
    appendPointToPolylineMesh(
      earthPath.mesh,
      earthObj.position,
      minSegmentLength
    );
  }

  const marsObj = scene.objects.find((o) => o.id === "planet:mars");
  const marsPath = scene.objects.find((o) => o.id === "path:planet:mars");
  if (marsObj && marsPath) {
    appendPointToPolylineMesh(
      marsPath.mesh,
      marsObj.position,
      minSegmentLength
    );
  }

  const venusObj = scene.objects.find((o) => o.id === "planet:venus");
  const venusPath = scene.objects.find((o) => o.id === "path:planet:venus");
  if (venusObj && venusPath) {
    appendPointToPolylineMesh(
      venusPath.mesh,
      venusObj.position,
      minSegmentLength
    );
  }
}
