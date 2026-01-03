import { HEIGHT, WIDTH } from "./config.js";
import { mat3, vec } from "./math.js";
import { airplaneModel } from "./models.js";
import { generatePlanetMesh, makeLocalFrame } from "./planet.js";
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

const initialPos: Vec3 = { x: 0, y: 0, z: 0 };
const initialUp: Vec3 = { x: 0, y: 0, z: 1 };
const initialFrame = makeLocalFrame(initialUp);
const initialForward: Vec3 = { ...initialFrame.forward };

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
  // Angle between planets
  const angle = Math.PI / 3; // 60 degrees

  // Distance between planet centers
  const secondsApart = 10;
  const distanceApart = plane.speed * secondsApart;

  // Earth
  const planet1Radius = 1000; // meters
  const planet1Center: Vec3 = { x: 0, y: 0, z: 0 };
  const planet1Mesh = generatePlanetMesh(planet1Center, planet1Radius, 3);
  planet1Mesh.objectType = "planet-earth";
  planet1Mesh.color = { r: 0, g: 0, b: 255 };
  planetGridInternal.push(planet1Mesh);

  // Mars: along initial forward from Earth
  const planet2Radius = planet1Radius * 1.5;
  const planet2Center: Vec3 = vec.add(
    planet1Center,
    vec.scale(initialForward, distanceApart)
  );
  const planet2Mesh = generatePlanetMesh(planet2Center, planet2Radius, 3);
  planet2Mesh.objectType = "planet-mars";
  planet2Mesh.color = { r: 255, g: 0, b: 0 };
  planetGridInternal.push(planet2Mesh);

  // Venus: same distance from Earth, but rotated around the up axis
  const rotatedForward: Vec3 = rotateAroundAxis(
    initialForward,
    initialUp,
    angle
  );

  const planet3Radius = planet2Radius * 1.5;
  const planet3Center: Vec3 = vec.add(
    planet1Center,
    vec.scale(rotatedForward, distanceApart)
  );
  const planet3Mesh = generatePlanetMesh(planet3Center, planet3Radius, 3);
  planet3Mesh.objectType = "planet-venus";
  planet3Mesh.color = { r: 0, g: 255, b: 0 };
  planetGridInternal.push(planet3Mesh);
}

function rotateAroundAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const R = mat3.rotAxis(axis, angle);
  const R0 = R[0];
  const R1 = R[1];
  const R2 = R[2];
  return {
    x: R0[0] * v.x + R0[1] * v.y + R0[2] * v.z,
    y: R1[0] * v.x + R1[1] * v.y + R1[2] * v.z,
    z: R2[0] * v.x + R2[1] * v.y + R2[2] * v.z,
  };
}

addPlanetGrid();
addAirplane();

const sunDirection = vec.scaleToUnit({ x: 0.3, y: 0.5, z: 1.0 });

export const scene: Scene = {
  planetGrid: planetGridInternal,
  airplanes: airplanesInternal,
  sunDirection,
};
