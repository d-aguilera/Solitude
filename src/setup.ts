import { HEIGHT, WIDTH } from "./config.js";
import { vec } from "./math.js";
import { airplaneModel } from "./models.js";
import {
  PLANET_RADIUS,
  planetCenter,
  makeLocalFrame,
  generateIcosahedronSphere,
} from "./planet.js";
import type {
  Model,
  PilotState,
  Plane,
  Scene,
  SceneObject,
  Vec3,
} from "./types.js";

export function initRenderingContexts(
  pilotCanvas: HTMLCanvasElement,
  topCanvas: HTMLCanvasElement
): {
  pilotContext: CanvasRenderingContext2D;
  topContext: CanvasRenderingContext2D;
} {
  pilotCanvas.width = WIDTH;
  pilotCanvas.height = HEIGHT;

  const pilotContext = pilotCanvas.getContext("2d");
  if (!pilotContext) {
    throw new Error("Failed to get 2D context for pilot view canvas");
  }

  topCanvas.width = WIDTH;
  topCanvas.height = HEIGHT;

  const topContext = topCanvas.getContext("2d");
  if (!topContext) {
    throw new Error("Failed to get 2D context for top view canvas");
  }

  return { pilotContext, topContext };
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

const airplanesInternal: SceneObject[] = [];
const planetGridInternal: Model[] = [];

function addAirplane(): void {
  airplanesInternal.push({
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
  planetGridInternal.push(planetMesh);
}

addPlanetGrid();
addAirplane();

const sunDirection = vec.scaleToUnit({ x: 0.3, y: 0.5, z: 1.0 });

export const scene: Scene = {
  planetGrid: planetGridInternal,
  airplanes: airplanesInternal,
  sunDirection,
};
