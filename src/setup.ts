import { vec } from "./math.js";
import { airplaneModel } from "./models.js";
import {
  PLANET_RADIUS,
  planetCenter,
  makeLocalFrame,
  generateIcosahedronSphere,
} from "./planet.js";
import type { Mat3, Model, Vec3 } from "./types.js";

// --- SETUP CONTEXTS ---
export const WIDTH = 600;
export const HEIGHT = 600;

export function initRenderingContexts(
  pilotCanvas: HTMLCanvasElement,
  topCanvas: HTMLCanvasElement
): { ctxPilot: CanvasRenderingContext2D; ctxTop: CanvasRenderingContext2D } {
  pilotCanvas.width = WIDTH;
  pilotCanvas.height = HEIGHT;
  const pilotCtx = pilotCanvas.getContext("2d");
  if (!pilotCtx) {
    throw new Error("Failed to get 2D context for pilot view canvas");
  }

  topCanvas.width = WIDTH;
  topCanvas.height = HEIGHT;
  const topCtx = topCanvas.getContext("2d");
  if (!topCtx) {
    throw new Error("Failed to get 2D context for top view canvas");
  }

  return { ctxPilot: pilotCtx, ctxTop: topCtx };
}

// --- GLOBAL PARAMETERS ---
export const FIELD_OF_VIEW = 90;
export const FOCAL_LENGTH = 1 / Math.tan((FIELD_OF_VIEW * Math.PI) / 180 / 2);

// Rates in radians per second
export const lookSpeed = 1.5;
export const rotSpeedRoll = 1.0;
export const rotSpeedPitch = 0.8;
export const rotSpeedYaw = 0.5;

export interface Plane {
  x: number;
  y: number;
  z: number;
  orientation: Mat3;
  right: Vec3;
  forward: Vec3;
  up: Vec3;
  speed: number;
  scale: number;
}

export interface Camera {
  x: number;
  y: number;
  z: number;
  orientation: Mat3;
}

export interface PilotState {
  azimuth: number;
  elevation: number;
}

export interface SceneObject {
  model: Model;
  x: number;
  y: number;
  z: number;
  orientation: Mat3;
  scale: number;
  color?: string | { r: number; g: number; b: number };
  lineWidth?: number;
  width?: number;
  depth?: number;
  height?: number;
}

// Start plane above some point on the planet
const initialUp: Vec3 = { x: 0, y: 0, z: 1 };
const initialAltitude = 100;
const initialPos = vec.add(
  planetCenter,
  vec.scale(initialUp, PLANET_RADIUS + initialAltitude)
);
const initialFrame = makeLocalFrame(initialUp);

export const plane: Plane = {
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
  speed: 250,
  scale: 15,
};

export const pilot: PilotState = {
  azimuth: 0,
  elevation: 0,
};

export const topCamera: Camera = {
  x: plane.x,
  y: plane.y,
  z: plane.z + 200,
  orientation: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
};

export const sun: Vec3 = vec.scaleToUnit({ x: 0.3, y: 0.5, z: 1.0 });

export const airplanes: SceneObject[] = [];
export const planetGrid: Model[] = [];

function addAirplane(): void {
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

function addPlanetGrid(): void {
  const planetMesh = generateIcosahedronSphere(3);
  planetGrid.push(planetMesh);
}

addPlanetGrid();
addAirplane();
