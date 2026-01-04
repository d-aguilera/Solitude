import { HEIGHT, WIDTH } from "./config.js";
import { mat3, vec } from "./math.js";
import { airplaneModel } from "./models.js";
import {
  generatePlanetMesh,
  makeLocalFrame,
  makePolylineMesh,
} from "./planet.js";
import type {
  Camera,
  Mesh,
  PilotView,
  Plane,
  Polar2D,
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

const initialPos: Vec3 = { x: 0, y: 0, z: 0 }; // origin
const initialUp: Vec3 = { x: 0, y: 0, z: 1 };
const initialFrame = makeLocalFrame(initialUp);
const initialForward: Vec3 = { ...initialFrame.forward };

interface PlanetConfig {
  id: string;
  pathId: string;
  objectType: string;
  orbit: Polar2D;
  radius: number; // physical radius in meters
  tangentialSpeed: number; // m/s along initial tangential direction
  color: { r: number; g: number; b: number };
}

// Example: three evenly spaced planets, but angles are explicit now.
const twoPi = 2 * Math.PI;

const planetConfigs: PlanetConfig[] = [
  {
    id: "planet:earth",
    pathId: "path:planet:earth",
    objectType: "planet-earth",
    orbit: {
      angleRad: 0 * (twoPi / 3),
      radius: 50_000,
    },
    radius: 1_000,
    tangentialSpeed: 400,
    color: { r: 0, g: 0, b: 255 },
  },
  {
    id: "planet:mars",
    pathId: "path:planet:mars",
    objectType: "planet-mars",
    orbit: {
      angleRad: 1 * (twoPi / 3),
      radius: 100_000,
    },
    radius: 5_000,
    tangentialSpeed: 300,
    color: { r: 255, g: 0, b: 0 },
  },
  {
    id: "planet:venus",
    pathId: "path:planet:venus",
    objectType: "planet-venus",
    orbit: {
      angleRad: 2 * (twoPi / 3),
      radius: 150_000,
    },
    radius: 25_000,
    tangentialSpeed: 200,
    color: { r: 0, g: 255, b: 0 },
  },
];

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
    speed: 0, // start from rest; actual motion comes from velocity in gravity.ts
    scale: 15,
    velocity: { x: 0, y: 0, z: 0 },
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
    id: `sceneobj:${plane.id}`,
    mesh: airplaneModel,
    position: { ...plane.position },
    orientation: plane.orientation,
    scale: plane.scale,
    color: airplaneModel.color,
    lineWidth: airplaneModel.lineWidth,
    applyTransform: true,
  });
}

function createPlanetPathObject(
  id: string,
  color: { r: number; g: number; b: number }
): SceneObject {
  const mesh = makePolylineMesh("orbit-path", color, 1);

  return {
    id,
    mesh,
    position: { x: 0, y: 0, z: 0 },
    orientation: mat3.identity,
    scale: 1,
    color: mesh.color,
    lineWidth: mesh.lineWidth,
    wireframeOnly: true,
    applyTransform: false, // polyline points are in world space
  };
}

function addPlanetGrid(objects: SceneObject[]): void {
  const planetMeshTemplate: Mesh = generatePlanetMesh(3);

  const radialAxis1 = vec.normalize(initialForward);
  const radialAxis2 = vec.normalize(initialUp);

  const radialDirAtAngle = (theta: number): Vec3 => {
    return vec.normalize({
      x: radialAxis1.x * Math.cos(theta) + radialAxis2.x * Math.sin(theta),
      y: radialAxis1.y * Math.cos(theta) + radialAxis2.y * Math.sin(theta),
      z: radialAxis1.z * Math.cos(theta) + radialAxis2.z * Math.sin(theta),
    });
  };

  const tangentialDirAtAngle = (theta: number): Vec3 => {
    const t = {
      x: -radialAxis1.x * Math.sin(theta) + radialAxis2.x * Math.cos(theta),
      y: -radialAxis1.y * Math.sin(theta) + radialAxis2.y * Math.cos(theta),
      z: -radialAxis1.z * Math.sin(theta) + radialAxis2.z * Math.cos(theta),
    };
    return vec.normalize(t);
  };

  for (const cfg of planetConfigs) {
    const theta = cfg.orbit.angleRad;
    const radial = radialDirAtAngle(theta);
    const tangential = tangentialDirAtAngle(theta);

    const center: Vec3 = vec.scale(radial, cfg.orbit.radius);

    const planetMesh: Mesh = { ...planetMeshTemplate };
    planetMesh.objectType = cfg.objectType;
    planetMesh.color = cfg.color;

    objects.push({
      id: cfg.id,
      mesh: planetMesh,
      position: center,
      orientation: mat3.identity,
      scale: cfg.radius,
      color: planetMesh.color,
      lineWidth: planetMesh.lineWidth,
      initialVelocity: {
        x: tangential.x * cfg.tangentialSpeed,
        y: tangential.y * cfg.tangentialSpeed,
        z: tangential.z * cfg.tangentialSpeed,
      },
      applyTransform: true,
    });

    objects.push(createPlanetPathObject(cfg.pathId, planetMesh.color));
  }
}

const sunDirection = vec.scaleToUnit({ x: 0.3, y: 0.5, z: 1.0 });

function createInitialPilotCamera(id: string, plane: Plane): Camera {
  return {
    id,
    position: { ...plane.position }, // will be offset in game loop
    orientation: mat3.identity,
  };
}

function createEmptyOrbitPathObject(id: string): SceneObject {
  const emptyPoints: Vec3[] = [];
  const mesh: Mesh = {
    objectType: "orbit-path",
    points: emptyPoints,
    faces: [],
    color: { r: 255, g: 255, b: 0 },
    lineWidth: 1,
  };

  return {
    id,
    mesh,
    position: { x: 0, y: 0, z: 0 },
    orientation: mat3.identity,
    scale: 1,
    color: mesh.color,
    lineWidth: mesh.lineWidth,
    wireframeOnly: true,
    applyTransform: false, // polyline points are in world space
  };
}

export function createInitialSceneAndWorld(): {
  scene: Scene;
  world: WorldState;
  mainPlaneId: string;
  mainPilotViewId: string;
  topCameraId: string;
  pilotCameraId: string;
} {
  const mainPlane = createInitialPlane("plane:main");

  const objects: SceneObject[] = [];
  addAirplaneObject(mainPlane, objects);
  addPlanetGrid(objects);

  // Add an empty trajectory object for plane
  const mainPlanePath = createEmptyOrbitPathObject("path:plane:main");
  objects.push(mainPlanePath);

  const scene: Scene = {
    objects,
    sunDirection,
  };

  const topCamera = createInitialTopCamera("camera:top", mainPlane);
  const pilotCamera = createInitialPilotCamera("camera:pilot", mainPlane);

  const pilotView = createInitialPilotView("pilot:main", mainPlane.id);

  const world: WorldState = {
    planes: [mainPlane],
    cameras: [topCamera, pilotCamera],
    pilotViews: [pilotView],
  };

  return {
    scene,
    world,
    mainPlaneId: mainPlane.id,
    mainPilotViewId: pilotView.id,
    topCameraId: topCamera.id,
    pilotCameraId: pilotCamera.id,
  };
}
