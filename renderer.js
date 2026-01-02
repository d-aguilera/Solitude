import { clear, draw } from "./draw.js";
import { fps } from "./fps.js";
import { altitudeAboveSurface } from "./planet.js";
import { enabled } from "./profiling.js";
import { pilotView, topView } from "./projection.js";
import { airplanes, plane, planetGrid, topCamera } from "./setup.js";

export function renderPilotView(ctxPilot) {
  clear(ctxPilot);
  // Draw planet grid first (wireframe lat/long)
  draw(ctxPilot, planetGrid, pilotView);

  // Draw the plane (aircraft model in airplanes[0])
  draw(ctxPilot, airplanes, pilotView);
}

import { planetCenter, vecSub, vecNormalize } from "./planet.js";

export function renderTopView(ctxTop) {
  clear(ctxTop);

  // Exact radial up from planet center to plane
  const radial = vecNormalize({
    x: plane.x - planetCenter.x,
    y: plane.y - planetCenter.y,
    z: plane.z - planetCenter.z,
  });

  const distanceAbovePlane = 500;
  topCamera.x = plane.x + radial.x * distanceAbovePlane;
  topCamera.y = plane.y + radial.y * distanceAbovePlane;
  topCamera.z = plane.z + radial.z * distanceAbovePlane;

  // Draw planet grid
  draw(ctxTop, planetGrid, topView);

  // Draw the plane
  draw(ctxTop, airplanes, topView);
}

export function renderHUD(ctxTop) {
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

  if (enabled) ctxTop.fillText("PROFILING", 250, 60);
}
