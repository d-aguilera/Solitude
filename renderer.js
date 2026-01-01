import { fps } from "./fps.js";
import { enabled } from "./profiling.js";
import { pilotView, topView } from "./projection.js";
import { clear, draw } from "./draw.js";
import { plane, buildings, cubes, airplanes, topCamera } from "./setup.js";
import { getVisibleObjects } from "./visibility.js";

let pilotSortFrameCounter = 0;
let cachedBuildingsSortedPilot = [];

export function renderPilotView(visibleGround, ctxPilot) {
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

export function renderTopView(visibleGround, ctxTop) {
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

export function renderHUD(ctxTop) {
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

  // Profiling
  if (enabled) ctxTop.fillText("PROFILING", 250, 60);
}

function getObjectDepthForSort(obj, projection) {
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
    return dx * dx + dy * dy;
  } else {
    const dx = cx - plane.x;
    const dy = cy - plane.y;
    const dz = cz - plane.z;
    return dx * dx + dy * dy + dz * dz;
  }
}
