import { HEIGHT, WIDTH } from "./config.js";
import { mat3, vec } from "./math.js";
import { airplaneModel } from "./models.js";
import {
  PLANET_RADIUS,
  generatePlanetMesh,
  makeLocalFrame,
  planetCenter,
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
  speed: 2500,
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
  // Home planet
  const planetMesh = generatePlanetMesh(planetCenter, PLANET_RADIUS, 3);
  planetMesh.objectType = "planet-home";
  planetMesh.color = { r: 0, g: 0, b: 255 };
  planetGridInternal.push(planetMesh);

  // Distance between planet centers along the tangent plane at the north pole
  const secondsApart = 10;
  const distanceApart = plane.speed * secondsApart;

  // Initial "up" and forward directions in world space
  const initialUp: Vec3 = { x: 0, y: 0, z: 1 };
  const initialForward: Vec3 = { ...initialFrame.forward }; // tangent at north pole

  // Helper: rotate a vector v around axis 'axis' by 'angle' radians
  const rotateAroundAxis = (v: Vec3, axis: Vec3, angle: number): Vec3 => {
    const R = mat3.rotAxis(axis, angle);
    return {
      x: R[0][0] * v.x + R[0][1] * v.y + R[0][2] * v.z,
      y: R[1][0] * v.x + R[1][1] * v.y + R[1][2] * v.z,
      z: R[2][0] * v.x + R[2][1] * v.y + R[2][2] * v.z,
    };
  };

  // Planet 2: along initial forward from the home planet
  const planet2Radius = PLANET_RADIUS * 1.5;
  const planet2Center: Vec3 = vec.add(
    planetCenter,
    vec.scale(initialForward, distanceApart)
  );
  const planet2Mesh = generatePlanetMesh(planet2Center, planet2Radius, 3);
  planet2Mesh.objectType = "planet-mars";
  planet2Mesh.color = { r: 255, g: 0, b: 0 };
  planetGridInternal.push(planet2Mesh);

  // Planet 3: same distance from home, but rotated 60° around the up axis
  const angle = Math.PI / 3; // 60 degrees
  const rotatedForward: Vec3 = rotateAroundAxis(
    initialForward,
    initialUp,
    angle
  );

  const planet3Radius = planet2Radius * 1.5;
  const planet3Center: Vec3 = vec.add(
    planetCenter,
    vec.scale(rotatedForward, distanceApart)
  );
  const planet3Mesh = generatePlanetMesh(planet3Center, planet3Radius, 3);
  planet3Mesh.objectType = "planet-venus";
  planet3Mesh.color = { r: 0, g: 255, b: 0 };
  planetGridInternal.push(planet3Mesh);
}

addPlanetGrid();
addAirplane();

const sunDirection = vec.scaleToUnit({ x: 0.3, y: 0.5, z: 1.0 });

export const scene: Scene = {
  planetGrid: planetGridInternal,
  airplanes: airplanesInternal,
  sunDirection,
};
