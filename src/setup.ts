import { HEIGHT, WIDTH } from "./config.js";
import { mat3, vec } from "./math.js";
import { airplaneModel } from "./models.js";
import { generatePlanetMesh, makeLocalFrame } from "./planet.js";
import type {
  Camera,
  Mesh,
  PilotView,
  Plane,
  Scene,
  SceneObject,
  Vec3,
  WorldState,
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

function createInitialPlane(id: string): Plane {
  const { right, forward, up } = initialFrame;
  return {
    id,
    position: { ...initialPos },
    orientation: [
      [right.x, forward.x, up.x],
      [right.y, forward.y, up.y],
      [right.z, forward.z, up.z],
    ],
    right: { ...initialFrame.right },
    forward: { ...initialFrame.forward },
    up: { ...initialFrame.up },
    speed: 2500,
    scale: 15,
  };
}

function createInitialPilotView(id: string, planeId: string): PilotView {
  return {
    id,
    planeId,
    azimuth: 0,
    elevation: 0,
  };
}

function createInitialTopCamera(id: string, plane: Plane): Camera {
  return {
    id,
    position: {
      x: plane.position.x,
      y: plane.position.y,
      z: plane.position.z + 50,
    },
    orientation: mat3.identity,
  };
}

function addAirplaneObject(plane: Plane, objects: SceneObject[]): void {
  objects.push({
    mesh: airplaneModel,
    position: { ...plane.position },
    orientation: plane.orientation,
    scale: plane.scale,
    color: airplaneModel.color,
    lineWidth: airplaneModel.lineWidth,
  });
}

function addPlanetGrid(baseSpeed: number, objects: SceneObject[]): void {
  // Angle between planets
  const angle = Math.PI / 3; // 60 degrees

  // Distance between planet centers
  const secondsApart = 10;
  const distanceApart = baseSpeed * secondsApart;

  // Earth
  const planet1Radius = 1000; // meters
  const planet1Center: Vec3 = { x: 0, y: 0, z: 0 };
  const planetMeshTemplate: Mesh = generatePlanetMesh(3);

  const planet1Mesh: Mesh = { ...planetMeshTemplate };
  planet1Mesh.objectType = "planet-earth";
  planet1Mesh.color = { r: 0, g: 0, b: 255 };
  objects.push({
    mesh: planet1Mesh,
    position: planet1Center,
    orientation: mat3.identity,
    scale: planet1Radius,
    color: planet1Mesh.color,
    lineWidth: planet1Mesh.lineWidth,
  });

  // Mars: along initial forward from Earth
  const planet2Radius = planet1Radius * 1.5;
  const planet2Center: Vec3 = vec.add(
    planet1Center,
    vec.scale(initialForward, distanceApart)
  );
  const planet2Mesh: Mesh = { ...planetMeshTemplate };
  planet2Mesh.objectType = "planet-mars";
  planet2Mesh.color = { r: 255, g: 0, b: 0 };
  objects.push({
    mesh: planet2Mesh,
    position: planet2Center,
    orientation: mat3.identity,
    scale: planet2Radius,
    color: planet2Mesh.color,
    lineWidth: planet2Mesh.lineWidth,
  });

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
  const planet3Mesh: Mesh = { ...planetMeshTemplate };
  planet3Mesh.objectType = "planet-venus";
  planet3Mesh.color = { r: 0, g: 255, b: 0 };
  objects.push({
    mesh: planet3Mesh,
    position: planet3Center,
    orientation: mat3.identity,
    scale: planet3Radius,
    color: planet3Mesh.color,
    lineWidth: planet3Mesh.lineWidth,
  });
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

const sunDirection = vec.scaleToUnit({ x: 0.3, y: 0.5, z: 1.0 });

export function createInitialSceneAndWorld(): {
  scene: Scene;
  world: WorldState;
  mainPlaneId: string;
  mainPilotViewId: string;
  topCameraId: string;
} {
  const objects: SceneObject[] = [];

  const mainPlane = createInitialPlane("plane:main");
  addAirplaneObject(mainPlane, objects);
  addPlanetGrid(mainPlane.speed, objects);

  const pilotView = createInitialPilotView("pilot:main", mainPlane.id);
  const topCamera = createInitialTopCamera("camera:top", mainPlane);

  const scene: Scene = {
    objects,
    sunDirection,
  };

  const world: WorldState = {
    planes: [mainPlane],
    cameras: [topCamera],
    pilotViews: [pilotView],
  };

  return {
    scene,
    world,
    mainPlaneId: mainPlane.id,
    mainPilotViewId: pilotView.id,
    topCameraId: topCamera.id,
  };
}
