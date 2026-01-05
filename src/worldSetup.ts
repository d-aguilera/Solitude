import { mat3, vec } from "./math.js";
import { airplaneModel } from "./models.js";
import {
  generatePlanetMesh,
  makeLocalFrame,
  makePolylineMesh,
} from "./planet.js";
import {
  buildDefaultSolarSystemConfigs,
  radialDirAtAngle,
  tangentialDirAtAngle,
  type PlanetConfig,
} from "./solarSystemConfig.js";
import type {
  AirplaneSceneObject,
  Camera,
  Mesh,
  PilotView,
  Plane,
  PlanetSceneObject,
  PolylineSceneObject,
  RGB,
  Scene,
  SceneObject,
  Vec3,
  WorldState,
} from "./types.js";
import { isPlanetSceneObject } from "./types.js";

const initialUp: Vec3 = { x: 0, y: 0, z: 1 };
const initialFrame = makeLocalFrame(initialUp);
const initialForward: Vec3 = { ...initialFrame.forward };

function createInitialPlane(id: string, position: Vec3): Plane {
  const { right, forward, up } = initialFrame;
  return {
    id,
    position: { ...position },
    orientation: [
      [right.x, forward.x, up.x],
      [right.y, forward.y, up.y],
      [right.z, forward.z, up.z],
    ],
    right: { ...initialFrame.right },
    forward: { ...initialFrame.forward },
    up: { ...initialFrame.up },
    speed: 0, // start from rest
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

function createInitialPilotCamera(id: string, plane: Plane): Camera {
  return {
    id,
    position: { ...plane.position }, // will be offset in game loop
    orientation: mat3.identity,
  };
}

function addAirplaneObject(plane: Plane, objects: SceneObject[]): void {
  const obj: AirplaneSceneObject = {
    id: `sceneobj:${plane.id}`,
    kind: "airplane",
    mesh: airplaneModel,
    position: { ...plane.position },
    orientation: plane.orientation,
    scale: plane.scale,
    color: airplaneModel.color,
    lineWidth: 1,
    applyTransform: true,
    wireframeOnly: false,
  };
  objects.push(obj);
}

function createPlanetPathObject(id: string, color: RGB): PolylineSceneObject {
  const mesh = makePolylineMesh(color);

  return {
    id,
    kind: "polyline",
    mesh,
    position: { x: 0, y: 0, z: 0 },
    orientation: mat3.identity,
    scale: 1,
    color: mesh.color,
    lineWidth: 1,
    wireframeOnly: true,
    applyTransform: false, // polyline points are in world space
  };
}

function createEmptyOrbitPathObject(id: string): PolylineSceneObject {
  const mesh: Mesh = {
    points: [],
    faces: [],
    color: { r: 255, g: 255, b: 0 },
  };

  return {
    id,
    kind: "polyline",
    mesh,
    position: { x: 0, y: 0, z: 0 },
    orientation: mat3.identity,
    scale: 1,
    color: mesh.color,
    lineWidth: 1,
    wireframeOnly: true,
    applyTransform: false,
  };
}

/**
 * Add planets + their orbit paths from an arbitrary list of PlanetConfig.
 */
function addPlanetsFromConfig(
  configs: PlanetConfig[],
  objects: SceneObject[]
): void {
  const planetMeshTemplate: Mesh = generatePlanetMesh(3);

  // Define an orbital plane via two basis vectors:
  const radialAxis1 = vec.normalize(initialForward);
  const radialAxis2 = vec.normalize(initialUp);

  for (const cfg of configs) {
    const theta = cfg.orbit.angleRad;
    const radial = radialDirAtAngle(theta, radialAxis1, radialAxis2);
    const tangential = tangentialDirAtAngle(theta, radialAxis1, radialAxis2);

    // Physical orbit radius in meters
    const center: Vec3 = vec.scale(radial, cfg.orbit.radius);

    const planetMesh: Mesh = { ...planetMeshTemplate };
    planetMesh.color = cfg.color;

    const initialVelocity =
      cfg.orbit.radius > 0
        ? {
            x: tangential.x * cfg.tangentialSpeed,
            y: tangential.y * cfg.tangentialSpeed,
            z: tangential.z * cfg.tangentialSpeed,
          }
        : undefined; // Sun at origin has no initial orbital velocity

    const planetObj: PlanetSceneObject = {
      id: cfg.id,
      kind: "planet",
      mesh: planetMesh,
      position: center,
      orientation: mat3.identity,
      scale: cfg.physicalRadius,
      color: planetMesh.color,
      lineWidth: 1,
      applyTransform: true,
      wireframeOnly: false,
      initialVelocity,
      density: cfg.density,
      physicalRadius: cfg.physicalRadius,
    };

    objects.push(planetObj);
    objects.push(createPlanetPathObject(cfg.pathId, planetMesh.color));
  }
}

const sunDirection = vec.scaleToUnit({ x: 0.3, y: 0.5, z: 1.0 });

// 100 km above Earth's north pole
const PLANE_START_ALTITUDE_M = 100_000; // meters

function computePlaneStartPosFromEarth(objects: SceneObject[]): Vec3 {
  const earthObj = objects.find((o) => o.id === "planet:earth");
  if (!earthObj) {
    throw new Error("Earth not found in scene objects");
  }
  if (!isPlanetSceneObject(earthObj)) {
    throw new Error("Earth is not a planet");
  }

  // North pole direction: global +Z in this setup
  const north: Vec3 = { x: 0, y: 0, z: 1 };

  // Use Earth's physical radius from its scene object
  const offset = vec.scale(
    north,
    earthObj.physicalRadius + PLANE_START_ALTITUDE_M
  );

  return {
    x: earthObj.position.x + offset.x,
    y: earthObj.position.y + offset.y,
    z: earthObj.position.z + offset.z,
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
  const objects: SceneObject[] = [];

  // Build the whole planetary system from config
  const planetConfigs = buildDefaultSolarSystemConfigs();
  addPlanetsFromConfig(planetConfigs, objects);

  const planeStartPos = computePlaneStartPosFromEarth(objects);
  const mainPlane = createInitialPlane("plane:main", planeStartPos);

  // Add the airplane visual object at that position
  addAirplaneObject(mainPlane, objects);

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
