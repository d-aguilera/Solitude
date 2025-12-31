import { mat3RotAxis, mat3Mul } from "./math.js";
import { keys } from "./input.js";
import { updateFPS, fps } from "./fps.js";
import { profilingCheck, profilingFlush, profilingState } from "./profiling.js";
import { pilotView, topView } from "./projection.js";
import { clear, draw } from "./draw.js";
import {
  lookSpeed,
  rotSpeedRoll,
  rotSpeedPitch,
  rotSpeedYaw,
  plane,
  pilot,
  topCamera,
  ground,
  buildings,
  cubes,
  airplanes,
  FOCAL_LENGTH,
  MAX_TILE_DIST,
} from "./setup.js";

let paused = false;
let spaceKeyDown = false;
let pausing = false;

let lastTimeMs = 0;

// --- PHYSICS ---

// Pilot Look (apply azimuth/elevation changes over time)
function pilotLookAround(dtSeconds) {
  if (keys.ArrowLeft) pilot.azimuth += lookSpeed * dtSeconds;
  if (keys.ArrowRight) pilot.azimuth -= lookSpeed * dtSeconds;
  if (keys.ArrowUp) pilot.elevation += lookSpeed * dtSeconds;
  if (keys.ArrowDown) pilot.elevation -= lookSpeed * dtSeconds;
}

// Extract current local axes from orientation (columns)
function updatePlaneAxes() {
  const R = plane.orientation;
  const [R0, R1, R2] = R;
  plane.right = { x: R0[0], y: R1[0], z: R2[0] };
  plane.forward = { x: R0[1], y: R1[1], z: R2[1] };
  plane.up = { x: R0[2], y: R1[2], z: R2[2] };
}

// Roll (A/D) around local forward axis
function roll(Rlocal, dtSeconds) {
  if ((!keys.KeyA && !keys.KeyD) || (keys.KeyA && keys.KeyD)) {
    return Rlocal;
  }

  if (keys.KeyA) {
    const Rr = mat3RotAxis(plane.forward, -rotSpeedRoll * dtSeconds);
    return Rlocal ? mat3Mul(Rr, Rlocal) : Rr;
  }

  const Rr = mat3RotAxis(plane.forward, rotSpeedRoll * dtSeconds);
  return Rlocal ? mat3Mul(Rr, Rlocal) : Rr;
}

// Pitch (W/S): S = pull nose up, W = nose down
function pitch(Rlocal, dtSeconds) {
  let pitchInput = 0;
  if (keys.KeyS) pitchInput += 1; // pull back: nose up
  if (keys.KeyW) pitchInput -= 1; // push forward: nose down
  if (pitchInput !== 0) {
    const Rp = mat3RotAxis(plane.right, pitchInput * rotSpeedPitch * dtSeconds);
    Rlocal = Rlocal ? mat3Mul(Rp, Rlocal) : Rp;
  }
  return Rlocal;
}

// Yaw (Q/E) around local up axis
function yaw(Rlocal, dtSeconds) {
  if ((!keys.KeyQ && !keys.KeyE) || (keys.KeyQ && keys.KeyE)) {
    return Rlocal;
  }

  if (keys.KeyQ) {
    const Ry = mat3RotAxis(plane.up, rotSpeedYaw * dtSeconds); // yaw left
    return Rlocal ? mat3Mul(Ry, Rlocal) : Ry;
  }

  const Ry = mat3RotAxis(plane.up, -rotSpeedYaw * dtSeconds); // yaw right
  return Rlocal ? mat3Mul(Ry, Rlocal) : Ry;
}

// Move plane forward
function moveForward(dtSeconds) {
  // Forward vector for movement = 2nd column (index 1)
  const forward = {
    x: plane.orientation[0][1],
    y: plane.orientation[1][1],
    z: plane.orientation[2][1],
  };

  const speed = plane.speed; // m/s

  // Move plane forward: x += v * dt
  plane.x += forward.x * speed * dtSeconds;
  plane.y += forward.y * speed * dtSeconds;
  plane.z += forward.z * speed * dtSeconds;
}

function pauseControl() {
  if (keys.Space) {
    if (!spaceKeyDown) {
      if (!paused) {
        pausing = true;
        paused = true;
      }
      spaceKeyDown = true;
    }
  } else {
    if (spaceKeyDown) {
      if (pausing) {
        pausing = false;
      } else {
        paused = false;
      }
      spaceKeyDown = false;
    }
  }
}

function updatePhysics(dtSeconds) {
  pauseControl();
  pilotLookAround(dtSeconds);
  updatePlaneAxes();

  let Rlocal = yaw(pitch(roll(null, dtSeconds), dtSeconds), dtSeconds);

  // Apply local rotation on the left
  if (Rlocal) {
    plane.orientation = mat3Mul(Rlocal, plane.orientation);
  }

  moveForward(dtSeconds);

  airplanes[0].x = plane.x;
  airplanes[0].y = plane.y;
  airplanes[0].z = plane.z;
  airplanes[0].orientation = plane.orientation;
  airplanes[0].scale = plane.scale;
}

function getCenterOfMass(obj) {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (let p of obj.points) {
    sumX += p.x;
    sumY += p.y;
    sumZ += p.z;
  }
  const n = obj.points.length;
  return {
    x: sumX / n,
    y: sumY / n,
    z: sumZ / n,
  };
}

export function getObjectDepthForSort(obj, projection) {
  // Use center if available, else approximate by first point or position
  let cx, cy, cz;

  if (obj.center) {
    cx = obj.center.x;
    cy = obj.center.y;
    cz = obj.center.z;
  } else if (obj.x !== undefined) {
    cx = obj.x;
    cy = obj.y;
    cz = obj.z;
  } else if (obj.points && obj.points.length > 0) {
    // static model like ground tile
    const p0 = obj.points[0];
    cx = p0.x;
    cy = p0.y;
    cz = p0.z;
  } else {
    return 0;
  }

  if (projection === topView) {
    const dx = cx - topCamera.x;
    const dy = cy - topCamera.y;
    return Math.hypot(dx, dy);
  } else {
    const dx = cx - plane.x;
    const dy = cy - plane.y;
    const dz = cz - plane.z;
    return Math.hypot(dx, dy, dz);
  }
}

function updateTopCamera(objectsToKeepInView) {
  // Camera is always directly above the airplane in X/Y (meters)
  topCamera.x = plane.x;
  topCamera.y = plane.y;

  // If no objects, just keep a simple camera height above the plane
  if (objectsToKeepInView.length == 0) {
    const offsetAbovePlane = 30; // m
    topCamera.z = Math.max(50, plane.z + offsetAbovePlane); // at least 50 m AGL-ish
    return;
  }

  let maxHorizDist = 0; // max horizontal distance from plane to any object
  let avgObjZ = 0; // average object altitude (for a ground reference)

  for (let obj of objectsToKeepInView) {
    const c = obj.center || getCenterOfMass(obj);
    const dx = c.x - plane.x;
    const dy = c.y - plane.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxHorizDist) maxHorizDist = dist;
    avgObjZ += c.z;
  }
  avgObjZ /= objectsToKeepInView.length;

  // Compute how far above the objects the camera must be so all objects fit
  const margin = 1.3;

  // from topView: |(dx * FOCAL_LENGTH) / dist| <= 0.5
  // => dist >= maxHorizDist * FOCAL_LENGTH / 0.5
  const baseDist = (maxHorizDist * FOCAL_LENGTH) / 0.5;
  const distToObjects = baseDist * margin;

  const minHeightAboveObjects = 20;
  const heightFromObjects = Math.max(
    avgObjZ + distToObjects,
    avgObjZ + minHeightAboveObjects
  );

  // Ensure the camera is never below the airplane
  const minOffsetAbovePlane = 50; // small buffer so we're always above the plane
  const heightFromPlane = plane.z + minOffsetAbovePlane;

  // Final camera height:
  topCamera.z = Math.max(heightFromObjects, heightFromPlane);
}

function getVisibleObjects(group) {
  const px = plane.x;
  const py = plane.y;
  const max2 = MAX_TILE_DIST * MAX_TILE_DIST;
  const out = [];
  for (let i = 0; i < group.length; i++) {
    const obj = group[i];
    const center = obj.center ?? obj;
    const dx = center.x - px;
    const dy = center.y - py;
    if (dx * dx + dy * dy <= max2) out.push(obj);
  }
  return out;
}

let pilotSortFrameCounter = 0;
let cachedBuildingsSortedPilot = [];

function renderPilotView(visibleGround, ctxPilot) {
  pilotSortFrameCounter++;

  const visibleBuildings = getVisibleObjects(buildings);

  if (pilotSortFrameCounter % 4 === 0) {
    cachedBuildingsSortedPilot = visibleBuildings.sort(
      (a, b) =>
        getObjectDepthForSort(b, pilotView) -
        getObjectDepthForSort(a, pilotView)
    );
  }

  const cubesSortedPilot = [...cubes].sort(
    (a, b) =>
      getObjectDepthForSort(b, pilotView) - getObjectDepthForSort(a, pilotView)
  );
  const airplanesSortedPilot = [...airplanes].sort(
    (a, b) =>
      getObjectDepthForSort(b, pilotView) - getObjectDepthForSort(a, pilotView)
  );

  clear(ctxPilot);
  draw(ctxPilot, visibleGround, pilotView);
  draw(ctxPilot, cachedBuildingsSortedPilot, pilotView);
  draw(ctxPilot, cubesSortedPilot, pilotView);
  draw(ctxPilot, airplanesSortedPilot, pilotView);
}

function renderTopView(visibleGround, ctxTop) {
  /*
  const buildingsSortedTop = [...buildings].sort(
    (a, b) =>
      getObjectDepthForSort(b, topView) - getObjectDepthForSort(a, topView)
  );
  */
  const cubesSortedTop = [...cubes].sort(
    (a, b) =>
      getObjectDepthForSort(b, topView) - getObjectDepthForSort(a, topView)
  );
  const airplanesSortedTop = [...airplanes].sort(
    (a, b) =>
      getObjectDepthForSort(b, topView) - getObjectDepthForSort(a, topView)
  );
  clear(ctxTop);
  draw(ctxTop, visibleGround, topView);
  // draw(ctxTop, buildingsSortedTop, topView);
  draw(ctxTop, cubesSortedTop, topView);
  draw(ctxTop, airplanesSortedTop, topView);
}

function renderHUD(ctxTop) {
  ctxTop.fillRect(0, 0, 360, 80);
  ctxTop.fillStyle = "white";
  ctxTop.font = "16px monospace";

  // Absolute altitude (same as before)
  ctxTop.fillText(`Alt: ${plane.z.toFixed(1)} m MSL`, 10, 20);

  // Altitude above ground
  const altAGL = plane.z; // ground is z=0, so AGL = z
  ctxTop.fillText(`AGL: ${altAGL.toFixed(1)} m`, 10, 40);

  // Speed line
  const speedKnots = plane.speed * 1.94384;
  ctxTop.fillText(
    `Spd: ${plane.speed.toFixed(1)} m/s (${speedKnots.toFixed(0)} kt)`,
    10,
    60
  );

  const mach = plane.speed / 343;
  ctxTop.fillText(`Mach: ${mach.toFixed(2)}`, 200, 40);

  // FPS
  ctxTop.fillText(`FPS: ${fps.toFixed(1)}`, 200, 20);
}

export function startGame(ctxPilot, ctxTop) {
  requestAnimationFrame((nowMs) => {
    lastTimeMs = nowMs;
    requestAnimationFrame(renderFrame.bind(null, ctxPilot, ctxTop));
  });
}

function renderFrame(ctxPilot, ctxTop, nowMs) {
  const dtMs = nowMs - lastTimeMs;
  lastTimeMs = nowMs;

  const dtSeconds = paused ? 0 : dtMs / 1000;

  updateFPS(nowMs);
  profilingCheck(paused);

  updatePhysics(dtSeconds);
  if (profilingState.doProfile)
    profilingState.physicsTimestamp = performance.now();

  updateTopCamera(cubes);
  if (profilingState.doProfile)
    profilingState.cameraTimestamp = performance.now();

  const visibleGround = getVisibleObjects(ground);
  if (profilingState.doProfile)
    profilingState.groundTimestamp = performance.now();

  renderPilotView(visibleGround, ctxPilot);
  if (profilingState.doProfile)
    profilingState.pilotViewTimestamp = performance.now();

  renderTopView(visibleGround, ctxTop);
  if (profilingState.doProfile)
    profilingState.topViewTimestamp = performance.now();

  renderHUD(ctxTop);

  if (profilingState.doProfile) {
    profilingState.hudTimestamp = performance.now();
    profilingFlush();
  }

  requestAnimationFrame(renderFrame.bind(null, ctxPilot, ctxTop));
}
