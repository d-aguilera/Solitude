import { airplaneModel } from "./models.js";
import {
  PLANET_RADIUS,
  planetCenter,
  makeLocalFrame,
  vecAdd,
  vecScale,
  vecScaleToUnit,
  generateIcosahedronSphere,
} from "./planet.js";

// --- SETUP CONTEXTS ---
export const WIDTH = 600;
export const HEIGHT = 600;

const canvas = document.getElementById("pilotViewCanvas");
canvas.width = WIDTH;
canvas.height = HEIGHT;
export const ctxPilot = canvas.getContext("2d");

const canvasTop = document.getElementById("topViewCanvas");
canvasTop.width = WIDTH;
canvasTop.height = HEIGHT;
export const ctxTop = canvasTop.getContext("2d");

// --- GLOBAL PARAMETERS ---
export const FIELD_OF_VIEW = 90;
export const FOCAL_LENGTH = 1 / Math.tan((FIELD_OF_VIEW * Math.PI) / 180 / 2);

// Rates in radians per second
export const lookSpeed = 1.5; // how fast the pilot can look around
export const rotSpeedRoll = 1.0; // roll rate (rad/s)
export const rotSpeedPitch = 0.8; // pitch rate (rad/s)
export const rotSpeedYaw = 0.5; // yaw rate (rad/s)

// --- STATE ---

// Start plane above some point on the planet: "north pole"-ish
const initialUp = { x: 0, y: 0, z: 1 }; // surface normal at north pole
const initialAltitude = 100; // meters
const initialPos = vecAdd(
  planetCenter,
  vecScale(initialUp, PLANET_RADIUS + initialAltitude)
);
const initialFrame = makeLocalFrame(initialUp);

// Orientation as a 3x3 matrix, columns = local axes in world space
// Column 0 = right, Column 1 = forward, Column 2 = up
export const plane = {
  x: initialPos.x,
  y: initialPos.y,
  z: initialPos.z,
  orientation: [
    [initialFrame.right.x, initialFrame.forward.x, initialFrame.up.x],
    [initialFrame.right.y, initialFrame.forward.y, initialFrame.up.y],
    [initialFrame.right.z, initialFrame.forward.z, initialFrame.up.z],
  ],
  right: { ...initialFrame.right },
  forward: { ...initialFrame.forward },
  up: { ...initialFrame.up },
  speed: 250, // m/s, ~485 knots (subsonic “fast jet” cruise)
  scale: 15, // meters, approximate F-16 length
};

export const pilot = {
  azimuth: 0,
  elevation: 0,
};

export const topCamera = {
  x: plane.x,
  y: plane.y,
  z: plane.z + 200, // arbitrary for now
  // orientation: columns = local axes in world space
  // col0 = right, col1 = forward, col2 = up
  orientation: [
    [1, 0, 0], // right.x, forward.x, up.x
    [0, 1, 0], // right.y, forward.y, up.y
    [0, 0, 1], // right.z, forward.z, up.z
  ],
};

export const sun = vecScaleToUnit({ x: 0.3, y: 0.5, z: 1.0 });
export const airplanes = [];
export const planetGrid = [];

function addAirplane() {
  airplanes.push({
    model: airplaneModel,
    x: plane.x,
    y: plane.y,
    z: plane.z,
    orientation: plane.orientation,
    scale: plane.scale,
    color: airplaneModel.color,
    lineWidth: airplaneModel.lineWidth,
  });
}

function addPlanetGrid() {
  const planetMesh = generateIcosahedronSphere(3); // 0..5; 3–4 is usually plenty
  planetGrid.push(planetMesh);
}

addPlanetGrid();
addAirplane();
