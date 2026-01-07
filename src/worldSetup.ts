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
  PlanetPhysics,
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
 * Helper: compute physical mass from radius and density.
 * Centralized here so both world setup and gravity share the same mapping.
 */
function computePlanetMass(physicalRadius: number, density: number): number {
  const volume =
    (4 / 3) * Math.PI * physicalRadius * physicalRadius * physicalRadius;
  return density * volume;
}

/**
 * Add planets + their orbit paths from an arbitrary list of PlanetConfig.
 *
 * This now:
 *  - Creates visual PlanetSceneObjects
 *  - Registers corresponding PlanetBody entries in world.planets
 *  - Registers PlanetPhysics entries for gravity
 */
function addPlanetsFromConfig(
  configs: PlanetConfig[],
  objects: SceneObject[],
  worldPlanets: WorldState["planets"],
  planetPhysics: PlanetPhysics[]
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
      physicalRadius: cfg.physicalRadius,
    };

    // Register physical planet body in world
    worldPlanets.push({
      id: cfg.id,
      position: { ...center },
      velocity: initialVelocity ? { ...initialVelocity } : { x: 0, y: 0, z: 0 },
    });

    // Register planet physics used by gravity (mass, radius, density)
    planetPhysics.push({
      id: cfg.id,
      physicalRadius: cfg.physicalRadius,
      density: cfg.density,
      mass: computePlanetMass(cfg.physicalRadius, cfg.density),
    });

    objects.push(planetObj);
    objects.push(createPlanetPathObject(cfg.pathId, planetMesh.color));
  }
}

const sunDirection = vec.scaleToUnit({ x: 0.3, y: 0.5, z: 1.0 });

// 100 km above Earth's north pole
const PLANE_START_ALTITUDE_M = 100_000; // meters

function computePlaneStartPosFromPlanet(
  objects: SceneObject[],
  planetId: string
): Vec3 {
  const planetObj = objects.find((o) => o.id === planetId);
  if (!planetObj) {
    throw new Error(`Home planet not found in scene objects: ${planetId}`);
  }
  if (!isPlanetSceneObject(planetObj)) {
    throw new Error(`Home planet is not a planet: ${planetId}`);
  }

  // North pole direction: global +Z in this setup
  const north: Vec3 = { x: 0, y: 0, z: 1 };

  // Use planet's physical radius from its scene object
  const offset = vec.scale(
    north,
    planetObj.physicalRadius + PLANE_START_ALTITUDE_M
  );

  return {
    x: planetObj.position.x + offset.x,
    y: planetObj.position.y + offset.y,
    z: planetObj.position.z + offset.z,
  };
}

export interface PlanetPathMapping {
  planetId: string;
  pathId: string;
}

export function createInitialSceneAndWorld(): {
  scene: Scene;
  world: WorldState;
  mainPlaneId: string;
  mainPilotViewId: string;
  topCameraId: string;
  pilotCameraId: string;
  planetPathMappings: PlanetPathMapping[];
} {
  const objects: SceneObject[] = [];

  const world: WorldState = {
    planes: [],
    cameras: [],
    pilotViews: [],
    planets: [],
    planetPhysics: [],
  };

  // Build the whole planetary system from config
  const planetConfigs = buildDefaultSolarSystemConfigs();
  addPlanetsFromConfig(
    planetConfigs,
    objects,
    world.planets,
    world.planetPhysics
  );

  // Choose which planet is treated as the "home" / starting planet.
  // This is a gameplay decision, so it lives in the setup layer instead of
  // inside the physical planet configuration.
  const homePlanetId = "planet:earth";
  const planeStartPos = computePlaneStartPosFromPlanet(objects, homePlanetId);
  const mainPlane = createInitialPlane("plane:main", planeStartPos);

  world.planes.push(mainPlane);

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

  world.cameras.push(topCamera, pilotCamera);
  world.pilotViews.push(pilotView);

  // Derive planet–path relationships once from the configs we just used.
  const planetPathMappings: PlanetPathMapping[] = planetConfigs.map((cfg) => ({
    planetId: cfg.id,
    pathId: cfg.pathId,
  }));

  return {
    scene,
    world,
    mainPlaneId: mainPlane.id,
    mainPilotViewId: pilotView.id,
    topCameraId: topCamera.id,
    pilotCameraId: pilotCamera.id,
    planetPathMappings,
  };
}

/**
 * Helper: propagate planet body positions from world.planets into their
 * corresponding planet SceneObjects. This keeps visual planets in sync
 * with simulated physics state, without coupling the gravity integrator
 * to scene wiring.
 */
export function syncPlanetsToSceneObjects(
  world: WorldState,
  scene: Scene
): void {
  for (const planetBody of world.planets) {
    const obj = scene.objects.find((o) => o.id === planetBody.id);
    if (!obj) continue;
    obj.position = { ...planetBody.position };
  }
}
