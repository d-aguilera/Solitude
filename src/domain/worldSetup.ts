import type { PlanetBodyConfig, StarBodyConfig } from "./domainInternals.js";
import { colors } from "./domainInternals.js";
import type {
  AirplaneSceneObject,
  CameraPose,
  CelestialBody,
  LocalFrame,
  Mesh,
  Plane,
  PlanetPathMapping,
  PlanetPhysics,
  PlanetSceneObject,
  PolylineSceneObject,
  RGB,
  Scene,
  SceneObject,
  StarPhysics,
  StarSceneObject,
  Vec3,
  WorldState,
} from "./domainPorts.js";
import {
  makeLocalFrameFromUp,
  mat3FromLocalFrame,
  rotateFrameAroundAxis,
} from "./localFrame.js";
import { mat3 } from "./mat3.js";
import { airplaneModel, generatePlanetMesh } from "./models.js";
import { buildDefaultSolarSystemConfigs } from "./solarSystem.js";
import { trig } from "./trig.js";
import { vec3 } from "./vec3.js";
import { getStarPhysicsById } from "./worldLookup.js";

const initialUp: Vec3 = { x: 0, y: 0, z: 1 };
const initialFrame: LocalFrame = makeLocalFrameFromUp(initialUp);
const initialForward: Vec3 = initialFrame.forward;

function createInitialPlane(
  id: string,
  position: Vec3,
  initialVelocity: Vec3,
): Plane {
  const speed = vec3.length(initialVelocity);

  let frame: LocalFrame = initialFrame;

  if (speed > 0) {
    const targetForward = vec3.normalize(initialVelocity);

    // Start from the canonical initialFrame
    const baseForward = initialFrame.forward;

    // Compute rotation axis = baseForward × targetForward
    const axis = vec3.cross(baseForward, targetForward);
    const axisLen = vec3.length(axis);

    if (axisLen < 1e-6) {
      // Vectors are parallel or anti-parallel.
      const dot = vec3.dot(baseForward, targetForward);
      if (dot > 0.999999) {
        // Same direction: no change needed.
        frame = initialFrame;
      } else {
        // Opposite direction: rotate 180° around "up" to flip forward.
        frame = {
          right: vec3.scale(initialFrame.right, -1),
          forward: vec3.scale(baseForward, -1),
          up: initialFrame.up,
        };
      }
    } else {
      // General case: rotate base frame so its forward matches targetForward.
      const axisN = vec3.normalize(axis);
      const dot = Math.min(
        1,
        Math.max(-1, vec3.dot(baseForward, targetForward)),
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

function createInitialTopCamera(id: string, plane: Plane): CameraPose {
  const offset: Vec3 = { x: 0, y: 0, z: 50 };

  return {
    id,
    position: vec3.add(plane.position, offset),
    frame: initialFrame,
  };
}

function createInitialPilotCamera(id: string, plane: Plane): CameraPose {
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
    color: colors.airplane,
    lineWidth: 1,
    applyTransform: true,
    wireframeOnly: false,
    backFaceCulling: false,
  };
  objects.push(obj);
}

function createPolylineSceneObject(
  id: string,
  color: RGB,
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
  configs: (PlanetBodyConfig | StarBodyConfig)[],
  objects: SceneObject[],
  worldPlanets: WorldState["planets"],
  worldPlanetPhysics: PlanetPhysics[],
  worldStars: WorldState["stars"],
  worldStarPhysics: StarPhysics[],
): void {
  const bodyMeshTemplate: Mesh = generatePlanetMesh(3);

  // Define an orbital plane via two basis vectors:
  const radialAxis1 = vec3.normalize(initialForward);
  const radialAxis2 = vec3.normalize(initialUp);

  for (const cfg of configs) {
    const theta = cfg.orbit.angleRad;
    const radial = trig.radialDirAtAngle(theta, radialAxis1, radialAxis2);
    const tangential = trig.tangentialDirAtAngle(
      theta,
      radialAxis1,
      radialAxis2,
    );

    // Physical orbit radius in meters
    const center: Vec3 = vec3.scale(radial, cfg.orbit.radius);

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
        luminosity: cfg.luminosity,
      };

      const starBody: CelestialBody = {
        id: cfg.id,
        position: { ...center },
        velocity: { ...initialVelocity },
      };

      const starPhys: StarPhysics = {
        id: cfg.id,
        physicalRadius: cfg.physicalRadius,
        density: cfg.density,
        mass: computePlanetMass(cfg.physicalRadius, cfg.density),
        luminosity: cfg.luminosity,
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
    objects.push(createPolylineSceneObject(cfg.pathId, cfg.color));
  }
}

// 100 km above Earth's north pole
const PLANE_START_ALTITUDE_M = 10_000_000; // meters

function computePlaneStartPosFromPlanet(
  objects: SceneObject[],
  planetId: string,
): Vec3 {
  const planetObj = objects.find((o) => o.id === planetId);
  if (!planetObj) {
    throw new Error(`Home planet not found in scene objects: ${planetId}`);
  }
  if (planetObj.kind !== "planet") {
    throw new Error(`Home planet is not a planet: ${planetId}`);
  }

  // North pole direction: global +Z in this setup
  const north: Vec3 = { x: 0, y: 0, z: 1 };

  // Use planet's physical radius from its scene object
  const offset = vec3.scale(
    north,
    planetObj.physicalRadius + PLANE_START_ALTITUDE_M,
  );

  return vec3.add(planetObj.position, offset);
}

function computePlaneInitialNearEarthOrbitVelocity(
  planeStartPos: Vec3,
  earthObj: PlanetSceneObject,
): Vec3 {
  // Earth heliocentric velocity: dominant motion
  const vEarth = vec3.clone(earthObj.initialVelocity);

  // Radial offset Earth -> plane
  const earthCenter = earthObj.position;
  const offset = vec3.sub(planeStartPos, earthCenter);
  const r = vec3.length(offset);
  if (r === 0) {
    // Fallback: just use Earth's velocity
    return vEarth;
  }

  const radialDir = vec3.scale(offset, 1 / r);

  // Build a small tangential component around Earth, perpendicular to radialDir.
  // Use Earth's current orbital direction as a reference, projected to be orthogonal.
  const earthDir = vec3.normalize(vEarth);
  const tangentialUnnormalized = vec3.sub(
    earthDir,
    vec3.scale(radialDir, vec3.dot(earthDir, radialDir)),
  );
  const tangentialDir =
    vec3.length(tangentialUnnormalized) > 0
      ? vec3.normalize(tangentialUnnormalized)
      : earthDir;

  // Choose a modest orbital speed relative to Earth, much smaller than vEarth.
  //  For example ~3 km/s is LEO-ish; you are at 10_000 km altitude, so this
  //  will be bound to Earth but not dominate the heliocentric motion.
  const vRelMag = 3_000; // m/s
  const vRel = vec3.scale(tangentialDir, vRelMag);

  // Total: Earth's heliocentric velocity + small relative orbital component.
  return vec3.add(vEarth, vRel);
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
    world.starPhysics,
  );

  // Choose which planet is treated as the "home" / starting planet.
  const homePlanetId = "planet:earth";
  const planeStartPos = computePlaneStartPosFromPlanet(objects, homePlanetId);

  // Find Earth's scene object
  const earthObj = objects.find(
    (o): o is PlanetSceneObject => o.id === homePlanetId && o.kind === "planet",
  );
  if (!earthObj) {
    throw new Error(`Home planet scene object not found: ${homePlanetId}`);
  }

  // Look up Earth's mass from planet physics
  const earthPhys = world.planetPhysics.find((p) => p.id === homePlanetId);
  if (!earthPhys) {
    throw new Error(`Home planet physics not found: ${homePlanetId}`);
  }

  const planeInitialVelocity = computePlaneInitialNearEarthOrbitVelocity(
    planeStartPos,
    earthObj,
  );

  const mainPlane = createInitialPlane(
    "plane:main",
    planeStartPos,
    planeInitialVelocity,
  );

  world.planes.push(mainPlane);

  // Add the airplane visual object at that position
  addAirplaneObject(mainPlane, objects);

  const mainPlanePath = createPolylineSceneObject(
    "path:plane:main",
    colors.yellow,
  );
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
  scene: Scene,
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
  scene: Scene,
): void {
  for (const planetBody of world.planets) {
    const obj = scene.objects.find(
      (o) => o.id === planetBody.id,
    ) as PlanetSceneObject;
    if (!obj) continue;
    obj.position = planetBody.position;
    obj.velocity = planetBody.velocity;
  }
}

export function syncStarsToSceneObjects(world: WorldState, scene: Scene): void {
  for (const starBody of world.stars) {
    const obj = scene.objects.find(
      (o) => o.id === starBody.id,
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
    const phys = getStarPhysicsById(world, starBody.id);

    lights.push({
      position: { ...starBody.position },
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
