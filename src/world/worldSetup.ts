import {
  makeLocalFrameFromUp,
  mat3FromLocalFrame,
  rotateFrameAroundAxis,
} from "./localFrame.js";
import { mat3 } from "./mat3.js";
import { airplaneModel, generatePlanetMesh } from "./content/models.js";
import {
  buildDefaultSolarSystemConfigs,
  radialDirAtAngle,
  tangentialDirAtAngle,
  type PlanetConfig,
} from "./solar/solarSystemConfig.js";
import type {
  AirplaneSceneObject,
  Camera,
  Plane,
  PlanetSceneObject,
  PolylineSceneObject,
  Scene,
  SceneObject,
  StarSceneObject,
  WorldState,
} from "./types.js";
import type {
  Vec3,
  LocalFrame,
  Mesh,
  PlanetPhysics,
  StarBody,
  StarPhysics,
  RGB,
} from "./domain.js";
import { vec } from "./vec3.js";

const initialUp: Vec3 = { x: 0, y: 0, z: 1 };
const initialFrame: LocalFrame = makeLocalFrameFromUp(initialUp);
const initialForward: Vec3 = initialFrame.forward;

function createInitialPlane(
  id: string,
  position: Vec3,
  initialVelocity: Vec3
): Plane {
  const speed = vec.length(initialVelocity);

  let frame: LocalFrame = initialFrame;

  if (speed > 0) {
    const targetForward = vec.normalize(initialVelocity);

    // Start from the canonical initialFrame
    const baseForward = initialFrame.forward;

    // Compute rotation axis = baseForward × targetForward
    const axis = vec.cross(baseForward, targetForward);
    const axisLen = vec.length(axis);

    if (axisLen < 1e-6) {
      // Vectors are parallel or anti-parallel.
      const dot = vec.dot(baseForward, targetForward);
      if (dot > 0.999999) {
        // Same direction: no change needed.
        frame = initialFrame;
      } else {
        // Opposite direction: rotate 180° around "up" to flip forward.
        frame = {
          right: vec.scale(initialFrame.right, -1),
          forward: vec.scale(baseForward, -1),
          up: initialFrame.up,
        };
      }
    } else {
      // General case: rotate base frame so its forward matches targetForward.
      const axisN = vec.normalize(axis);
      const dot = Math.min(
        1,
        Math.max(-1, vec.dot(baseForward, targetForward))
      );
      const angle = Math.acos(dot);

      frame = rotateFrameAroundAxis(initialFrame, axisN, angle);
    }
  }

  return {
    id,
    position: { ...position },
    frame,
    speed,
    velocity: { ...initialVelocity },
  };
}

function createInitialTopCamera(id: string, plane: Plane): Camera {
  const offset: Vec3 = { x: 0, y: 0, z: 50 };

  return {
    id,
    position: vec.add(plane.position, offset),
    frame: initialFrame,
  };
}

function createInitialPilotCamera(id: string, plane: Plane): Camera {
  return {
    id,
    position: { ...plane.position }, // will be offset in game loop
    frame: initialFrame,
  };
}

const AIRPLANE_VISUAL_SCALE = 15;

function addAirplaneObject(plane: Plane, objects: SceneObject[]): void {
  const obj: AirplaneSceneObject = {
    id: plane.id,
    kind: "airplane",
    mesh: airplaneModel,
    position: { ...plane.position },
    orientation: mat3FromLocalFrame(plane.frame),
    scale: AIRPLANE_VISUAL_SCALE,
    color: { r: 0, g: 255, b: 255 },
    lineWidth: 1,
    applyTransform: true,
    wireframeOnly: false,
    backFaceCulling: false,
  };
  objects.push(obj);
}

function createPolylineSceneObject(
  id: string,
  color: RGB
): PolylineSceneObject {
  const mesh: Mesh = {
    points: [],
    faces: [],
  };
  return {
    id,
    kind: "polyline",
    mesh,
    position: { x: 0, y: 0, z: 0 },
    orientation: mat3.identity,
    scale: 1,
    color,
    lineWidth: 1,
    wireframeOnly: true,
    applyTransform: false, // polyline points are in world space
    backFaceCulling: false,
  };
}

function createPlanetPathObject(id: string, color: RGB): PolylineSceneObject {
  return createPolylineSceneObject(id, color);
}

function createEmptyOrbitPathObject(id: string): PolylineSceneObject {
  return createPolylineSceneObject(id, { r: 255, g: 255, b: 0 });
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
 * Add planets + stars + their orbit paths from an arbitrary list of PlanetConfig.
 *
 * This now:
 *  - Creates visual PlanetSceneObject or StarSceneObject
 *  - Registers corresponding PlanetBody / StarBody entries in world
 *  - Registers PlanetPhysics / StarPhysics entries for gravity
 */
function addPlanetsAndStarsFromConfig(
  configs: PlanetConfig[],
  objects: SceneObject[],
  worldPlanets: WorldState["planets"],
  worldPlanetPhysics: PlanetPhysics[],
  worldStars: WorldState["stars"],
  worldStarPhysics: StarPhysics[]
): void {
  const bodyMeshTemplate: Mesh = generatePlanetMesh(3);

  // Define an orbital plane via two basis vectors:
  const radialAxis1 = vec.normalize(initialForward);
  const radialAxis2 = vec.normalize(initialUp);

  for (const cfg of configs) {
    const theta = cfg.orbit.angleRad;
    const radial = radialDirAtAngle(theta, radialAxis1, radialAxis2);
    const tangential = tangentialDirAtAngle(theta, radialAxis1, radialAxis2);

    // Physical orbit radius in meters
    const center: Vec3 = vec.scale(radial, cfg.orbit.radius);

    const bodyMesh: Mesh = { ...bodyMeshTemplate };

    const initialVelocity =
      cfg.orbit.radius > 0
        ? {
            x: tangential.x * cfg.tangentialSpeed,
            y: tangential.y * cfg.tangentialSpeed,
            z: tangential.z * cfg.tangentialSpeed,
          }
        : { x: 0, y: 0, z: 0 };

    if (cfg.kind === "star") {
      const luminosity = cfg.luminosity ?? 0;

      const starObj: StarSceneObject = {
        id: cfg.id,
        kind: "star",
        mesh: bodyMesh,
        position: center,
        orientation: mat3.identity,
        scale: cfg.physicalRadius,
        color: cfg.color,
        lineWidth: 1,
        applyTransform: true,
        wireframeOnly: false,
        initialVelocity,
        physicalRadius: cfg.physicalRadius,
        backFaceCulling: true,
        velocity: { ...initialVelocity },
        luminosity,
      };

      const starBody: StarBody = {
        id: cfg.id,
        position: { ...center },
        velocity: { ...initialVelocity },
      };

      const starPhys: StarPhysics = {
        id: cfg.id,
        physicalRadius: cfg.physicalRadius,
        density: cfg.density,
        mass: computePlanetMass(cfg.physicalRadius, cfg.density),
        luminosity,
      };

      worldStars.push(starBody);
      worldStarPhysics.push(starPhys);
      objects.push(starObj);
    } else {
      const planetObj: PlanetSceneObject = {
        id: cfg.id,
        kind: "planet",
        mesh: bodyMesh,
        position: center,
        orientation: mat3.identity,
        scale: cfg.physicalRadius,
        color: cfg.color,
        lineWidth: 1,
        applyTransform: true,
        wireframeOnly: false,
        initialVelocity,
        physicalRadius: cfg.physicalRadius,
        backFaceCulling: true,
        velocity: { ...initialVelocity },
      };

      worldPlanets.push({
        id: cfg.id,
        position: { ...center },
        velocity: { ...initialVelocity },
      });

      worldPlanetPhysics.push({
        id: cfg.id,
        physicalRadius: cfg.physicalRadius,
        density: cfg.density,
        mass: computePlanetMass(cfg.physicalRadius, cfg.density),
      });

      objects.push(planetObj);
    }

    // All get a path polyline
    objects.push(createPlanetPathObject(cfg.pathId, cfg.color));
  }
}

// 100 km above Earth's north pole
const PLANE_START_ALTITUDE_M = 10_000_000; // meters

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

  return vec.add(planetObj.position, offset);
}

function isPlanetSceneObject(obj: SceneObject): obj is PlanetSceneObject {
  return obj.kind === "planet";
}

export interface PlanetPathMapping {
  planetId: string;
  pathId: string;
}

export function createInitialSceneAndWorld(): {
  scene: Scene;
  world: WorldState;
  mainPlaneId: string;
  topCameraId: string;
  pilotCameraId: string;
  planetPathMappings: PlanetPathMapping[];
} {
  const objects: SceneObject[] = [];

  const world: WorldState = {
    planes: [],
    cameras: [],
    planets: [],
    planetPhysics: [],
    stars: [],
    starPhysics: [],
  };

  // Build the whole planetary system from config
  const planetConfigs = buildDefaultSolarSystemConfigs();
  addPlanetsAndStarsFromConfig(
    planetConfigs,
    objects,
    world.planets,
    world.planetPhysics,
    world.stars,
    world.starPhysics
  );

  // Choose which planet is treated as the "home" / starting planet.
  const homePlanetId = "planet:earth";
  const planeStartPos = computePlaneStartPosFromPlanet(objects, homePlanetId);

  // Find Earth's scene object to get its initial orbital velocity
  const earthObj = objects.find(
    (o): o is PlanetSceneObject => o.id === homePlanetId && o.kind === "planet"
  );
  if (!earthObj) {
    throw new Error(`Home planet scene object not found: ${homePlanetId}`);
  }

  const mainPlane = createInitialPlane(
    "plane:main",
    planeStartPos,
    earthObj.initialVelocity
  );

  world.planes.push(mainPlane);

  // Add the airplane visual object at that position
  addAirplaneObject(mainPlane, objects);

  const mainPlanePath = createEmptyOrbitPathObject("path:plane:main");
  objects.push(mainPlanePath);

  const scene: Scene = {
    objects,
    lights: [],
  };

  const topCamera = createInitialTopCamera("camera:top", mainPlane);
  const pilotCamera = createInitialPilotCamera("camera:pilot", mainPlane);

  world.cameras.push(topCamera, pilotCamera);

  // Derive planet–path relationships once from the configs we just used.
  const planetPathMappings: PlanetPathMapping[] = planetConfigs.map((cfg) => ({
    planetId: cfg.id,
    pathId: cfg.pathId,
  }));

  // Build initial point lights from star bodies (e.g., Sun at origin).
  // Subsequent frames should call syncLightsToStars to keep this up to date.
  buildLightsFromStars(world, scene);

  return {
    scene,
    world,
    mainPlaneId: mainPlane.id,
    topCameraId: topCamera.id,
    pilotCameraId: pilotCamera.id,
    planetPathMappings,
  };
}

export function syncPlanesToSceneObjects(
  world: WorldState,
  scene: Scene
): void {
  for (const plane of world.planes) {
    const obj = scene.objects.find((o) => o.id === plane.id);
    if (!obj) continue;

    // Keep renderer-facing pose in sync with physics plane.
    obj.position = plane.position;
    obj.orientation = mat3FromLocalFrame(plane.frame);
  }
}

export function syncPlanetsToSceneObjects(
  world: WorldState,
  scene: Scene
): void {
  for (const planetBody of world.planets) {
    const obj = scene.objects.find(
      (o) => o.id === planetBody.id
    ) as PlanetSceneObject;
    if (!obj) continue;
    obj.position = planetBody.position;
    obj.velocity = planetBody.velocity;
  }
}

export function syncStarsToSceneObjects(world: WorldState, scene: Scene): void {
  for (const starBody of world.stars) {
    const obj = scene.objects.find(
      (o) => o.id === starBody.id
    ) as StarSceneObject;
    if (!obj) continue;
    obj.position = starBody.position;
    obj.velocity = starBody.velocity;
  }
}

/**
 * Internal helper: build the array of point lights from the current star bodies.
 * Used both at initial setup time and by syncLightsToStars on each frame.
 */
function buildLightsFromStars(world: WorldState, scene: Scene): void {
  const lights = [];

  for (const starBody of world.stars) {
    const phys = world.starPhysics.find((p) => p.id === starBody.id);
    if (!phys) continue;

    lights.push({
      position: { ...starBody.position },
      // Use physical luminosity directly; renderer is responsible for scaling.
      intensity: phys.luminosity,
    });
  }

  scene.lights = lights;
}

/**
 * Per‑frame adapter: keep Scene.lights in sync with the current star bodies.
 * This separates long‑lived world/physics state (WorldState) from the
 * renderer‑side Scene representation.
 */
export function syncLightsToStars(world: WorldState, scene: Scene): void {
  buildLightsFromStars(world, scene);
}
